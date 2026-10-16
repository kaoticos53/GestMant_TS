import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import {
  MANUAL_FILE_FORMAT,
  MANUAL_TYPES,
  canDeleteManual,
  canEditManual,
  changedManualFields,
  isManualType,
  isPdfFile,
  manualTitleFromFile,
  sortManuals,
} from "../lib/manuals";
import { richDocToStore } from "../lib/richDoc";
import {
  MAX_MANUAL_FILE_SIZE,
  MAX_MANUAL_FILE_SIZE_LABEL,
  hasDangerousExtension,
  looksLikePdf,
} from "../lib/upload";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import {
  QueryCtx,
  action,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { hasCapability } from "./permissions";

/**
 * Manuales del taller: la documentación de los equipos y de sus modelos.
 *
 * Dos formas de manual, en la misma tabla: el archivo que se sube (un PDF, el
 * manual del fabricante) y la nota que escribe un técnico —un procedimiento,
 * una observación—, que vale por sí misma y no necesita equipo. La ficha se
 * clasifica por tipo, marca y modelo y puede apuntar a un equipo del inventario;
 * ni el vínculo ni la marca son obligatorios: hay manuales sin equipo y equipos
 * sin manuales.
 *
 * Quién puede qué: consultar y descargar lo hace quien tenga la capacidad
 * «viewManuals» (técnicos y responsables por defecto), escribir su propia nota
 * también, y subir, cambiar o borrar cualquier manual, quien tenga
 * «manageManuals». Las sesiones de invitado no entran, aunque su rol sea el de
 * técnico: un invitado no es del taller. Las reglas por manual —si es suyo, si
 * lo puede borrar— viven en `lib/manuals`, que es el mismo código que usa la
 * interfaz para enseñar los botones.
 */

/** Lo que se le dice a quien no puede consultar los manuales. */
const NO_VIEW_MESSAGE =
  "Los manuales son de uso interno del taller. Pide acceso a quien administra la aplicación.";

/** Lo que se le dice a quien no puede tocar el manual de otro. */
const NO_MANAGE_MESSAGE =
  "Subir, cambiar o borrar manuales es cosa de quien gestiona el módulo. Revisa la configuración de tu rol con el administrador.";

/** Lo que se le dice a quien intenta corregir algo que no es suyo. */
const NOT_YOURS_MESSAGE =
  "Ese manual lo subió otra persona: solo quien lo gestiona o su autor pueden cambiarlo.";

/** El nombre con el que firma quien sube o escribe un manual. */
function actorName(user: Doc<"users">): string {
  return user.name?.trim() || user.email?.trim() || "Usuario del taller";
}

/**
 * Quien mira: una sesión del taller. El invitado —la sesión anónima— no es
 * nadie del taller, así que se queda fuera aunque su rol sea el de técnico.
 */
async function requireMember(ctx: QueryCtx): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  const user = userId === null ? null : await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError("Debes iniciar sesión para consultar los manuales.");
  }
  if (user.active === false) {
    throw new ConvexError("Esta cuenta ha sido dada de baja.");
  }
  if (user.isAnonymous === true) {
    throw new ConvexError(NO_VIEW_MESSAGE);
  }
  return user;
}

/** Puede consultar y descargar manuales (las notas, además, escribirlas). */
async function requireViewer(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await requireMember(ctx);
  if (!(await hasCapability(ctx, user, "viewManuals"))) {
    throw new ConvexError(NO_VIEW_MESSAGE);
  }
  return user;
}

/** Puede subir, cambiar y borrar cualquier manual del módulo. */
async function requireManager(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await requireMember(ctx);
  if (!(await hasCapability(ctx, user, "manageManuals"))) {
    throw new ConvexError(NO_MANAGE_MESSAGE);
  }
  return user;
}

/** Lo que el almacén sabe de un archivo ya subido. */
async function storedFile(ctx: QueryCtx, storageId: Id<"_storage">) {
  const file = await ctx.db.system.get("_storage", storageId);
  if (!file) {
    throw new ConvexError(
      "El archivo del manual ya no está en el almacén: vuelve a subirlo.",
    );
  }
  return file;
}

/**
 * Comprueba el archivo de un manual: tiene que estar en el almacén, ser un PDF
 * legítimo, no contener extensiones ejecutables o polimórficas y caber en el
 * límite de manuales técnicos (25 MB). Devuelve lo que se guarda de él.
 */
async function validateFile(
  ctx: QueryCtx,
  storageId: Id<"_storage">,
  fileName: string | undefined,
) {
  const file = await storedFile(ctx, storageId);
  if (fileName && hasDangerousExtension(fileName)) {
    throw new ConvexError(
      "El nombre de archivo contiene una extensión no permitida o potencialmente peligrosa.",
    );
  }
  if (
    !isPdfFile({ name: fileName, contentType: file.contentType ?? undefined })
  ) {
    throw new ConvexError(
      `El manual se carga en ${MANUAL_FILE_FORMAT}. Convierte el documento antes de subirlo.`,
    );
  }
  if (file.size > MAX_MANUAL_FILE_SIZE) {
    throw new ConvexError(
      `El manual puede pesar como mucho ${MAX_MANUAL_FILE_SIZE_LABEL}.`,
    );
  }
  const name = fileName?.trim();
  return {
    fileName: name ? name : `Manual.pdf`,
    contentType: file.contentType ?? "application/pdf",
    size: file.size,
  };
}

/** Los campos de clasificación, ya comprobados y listos para guardar. */
interface Classification {
  type: string;
  brand?: string;
  model?: string;
  modelId?: Id<"equipmentModels">;
  equipmentId?: Id<"equipment">;
}

/**
 * Valida la clasificación. El tipo tiene que ser uno del catálogo —es lo que
 * hace que los filtros sirvan— y, si el manual se asigna a un equipo o a un modelo,
 * la marca y el modelo se heredan de él cuando no se indican.
 */
async function validateClassification(
  ctx: QueryCtx,
  args: {
    type: string;
    brand?: string;
    model?: string;
    modelId?: Id<"equipmentModels"> | null;
    equipmentId?: Id<"equipment"> | null;
  },
): Promise<Classification> {
  const type = args.type.trim();
  if (!isManualType(type)) {
    throw new ConvexError(
      `Ese tipo de manual no está en el catálogo (${MANUAL_TYPES.join(", ")}).`,
    );
  }
  let brand = args.brand?.trim() || undefined;
  let model = args.model?.trim() || undefined;
  let modelId = args.modelId ?? undefined;
  const equipmentId = args.equipmentId ?? undefined;

  if (equipmentId) {
    const equipment = await ctx.db.get(equipmentId);
    if (!equipment) {
      throw new ConvexError(
        "El equipo al que se asigna el manual ya no está en el inventario.",
      );
    }
    brand = brand ?? (equipment.brand?.trim() || undefined);
    model = model ?? (equipment.model.trim() || undefined);
    modelId = modelId ?? equipment.modelId;
  }

  if (modelId) {
    const eqModel = await ctx.db.get(modelId);
    if (eqModel) {
      brand = brand ?? (eqModel.brand?.trim() || undefined);
      model = model ?? (eqModel.model.trim() || undefined);
    }
  } else if (model) {
    // Si no vino modelId pero tenemos model, buscar si existe en equipmentModels
    const foundModel = await ctx.db
      .query("equipmentModels")
      .withIndex("by_model", (q) => q.eq("model", model!))
      .first();
    if (foundModel) {
      modelId = foundModel._id;
      brand = brand ?? (foundModel.brand?.trim() || undefined);
    }
  }

  return {
    type,
    ...(brand ? { brand } : {}),
    ...(model ? { model } : {}),
    ...(modelId ? { modelId } : {}),
    ...(equipmentId ? { equipmentId } : {}),
  };
}

/**
 * Lista completa de manuales, con la dirección de su archivo y la de cada
 * versión anterior que guarde su historial. Requiere sesión del taller y la
 * capacidad de verlos; para quien no la tiene —o para un invitado— devuelve
 * vacío en vez de un error, porque el panel pide esta lista al montar y no debe
 * tumbarse por un módulo al que no se tiene acceso.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const me = userId === null ? null : await ctx.db.get(userId);
    if (!me || me.isAnonymous === true) return [];
    if (!(await hasCapability(ctx, me, "viewManuals"))) return [];
    const rows = await ctx.db.query("manuals").collect();
    return await Promise.all(
      sortManuals(rows).map(async (manual) => ({
        ...manual,
        // La dirección se resuelve al vuelo: el archivo sigue siendo del
        // almacén del taller, no del texto de la ficha. Vale igual para las
        // versiones anteriores: sustituir un PDF no lo borra, así que se sigue
        // descargando desde el historial.
        url: manual.storageId
          ? await ctx.storage.getUrl(manual.storageId)
          : null,
        history: await Promise.all(
          (manual.history ?? []).map(async (entry) => ({
            ...entry,
            url: entry.file
              ? await ctx.storage.getUrl(entry.file.storageId)
              : null,
          })),
        ),
      })),
    );
  },
});

/** URL de subida para el archivo de un manual (PDF). */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireManager(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Comprobación interna de identidad y capacidades para las acciones de manuales.
 * Rechaza usuarios no autenticados, anónimos o inactivos.
 */
export const verifyManualActor = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const user = userId === null ? null : await ctx.db.get(userId);
    if (!user || user.active === false || user.isAnonymous === true) {
      return null;
    }
    const canManage = await hasCapability(ctx, user, "manageManuals");
    return canManage ? user : null;
  },
});

/**
 * Inspección profunda de seguridad para manuales subidos al almacén:
 * Comprueba que el usuario tiene permisos de gestión, que el archivo no excede 25 MB,
 * y que la cabecera del archivo en el almacén coincide con el número mágico `%PDF-` (`0x25, 0x50, 0x44, 0x46`).
 * Si el archivo es inválido, corrupto o polimórfico, se purga inmediatamente de `ctx.storage`
 * para prevenir DoS y almacenamiento de ejecutables.
 */
export const verifyManualPdf = action({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const actor = await ctx.runQuery(internal.manuals.verifyManualActor);
    if (!actor) {
      throw new ConvexError(NO_MANAGE_MESSAGE);
    }
    const file = await ctx.storage.get(args.storageId);
    if (!file) {
      throw new ConvexError(
        "El archivo del manual ya no está en el almacén: vuelve a subirlo.",
      );
    }
    if (file.size > MAX_MANUAL_FILE_SIZE) {
      await ctx.storage.delete(args.storageId);
      throw new ConvexError(
        `El manual puede pesar como mucho ${MAX_MANUAL_FILE_SIZE_LABEL}.`,
      );
    }
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    if (!looksLikePdf(head)) {
      await ctx.storage.delete(args.storageId);
      throw new ConvexError(
        `El manual se carga en ${MANUAL_FILE_FORMAT}. El archivo no contiene una firma PDF válida (%PDF-).`,
      );
    }
    return { ok: true, size: file.size };
  },
});

/**
 * Alta de un manual: la nota que escribe un técnico o el archivo que sube
 * quien gestiona el módulo. El título se puede dejar vacío si se sube un
 * archivo con nombre: se propone el del fichero, sin extensión.
 */
export const create = mutation({
  args: {
    title: v.string(),
    kind: v.union(v.literal("file"), v.literal("note")),
    type: v.string(),
    brand: v.optional(v.string()),
    model: v.optional(v.string()),
    modelId: v.optional(v.id("equipmentModels")),
    equipmentId: v.optional(v.id("equipment")),
    storageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    /** La nota del manual, tal y como sale del editor (documento de `richDoc`). */
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Subir un manual es cosa de quien gestiona el módulo: la nota de taller,
    // en cambio, la escribe cualquiera que pueda consultar los manuales.
    const actor =
      args.kind === "file"
        ? await requireManager(ctx)
        : await requireViewer(ctx);
    const notes = richDocToStore(args.notes);
    let file: { fileName: string; contentType: string; size: number } | null =
      null;
    if (args.kind === "file") {
      if (!args.storageId) {
        throw new ConvexError("Elige el archivo del manual.");
      }
      file = await validateFile(ctx, args.storageId, args.fileName);
    } else if (!notes) {
      throw new ConvexError("Escribe la nota del manual: es su contenido.");
    }

    const fileName = file?.fileName;
    const title =
      args.title.trim() || (fileName ? manualTitleFromFile(fileName) : "");
    if (!title) throw new ConvexError("Ponle un título al manual.");

    const classification = await validateClassification(ctx, args);
    const now = Date.now();
    const by = actorName(actor);
    await ctx.db.insert("manuals", {
      title,
      kind: args.kind,
      ...classification,
      ...(file
        ? {
            storageId: args.storageId,
            fileName: file.fileName,
            contentType: file.contentType,
            size: file.size,
          }
        : {}),
      ...(notes ? { notes } : {}),
      author: by,
      authorId: actor._id,
      // El primer movimiento del historial: quién lo subió o lo escribió.
      history: [{ at: now, action: "created", by, byId: actor._id }],
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Edición de un manual: los datos de la ficha, su nota y, para quien gestiona,
 * el archivo que lo sustituye. El PDF que sale no se borra: queda como versión
 * anterior en el historial de la ficha, con su nombre y su tamaño, y se puede
 * seguir descargando. La forma del manual —nota o archivo— no cambia al
 * editar: una nota no se convierte en archivo.
 *
 * Cada cambio real deja su movimiento en el historial —quién lo hizo y qué
 * tocó—; guardar sin cambiar nada no apunta nada.
 */
export const update = mutation({
  args: {
    id: v.id("manuals"),
    title: v.optional(v.string()),
    type: v.optional(v.string()),
    brand: v.optional(v.string()),
    model: v.optional(v.string()),
    modelId: v.optional(v.union(v.id("equipmentModels"), v.null())),
    /** Un equipo del inventario, o `null` para desvincularlo del que tuviera. */
    equipmentId: v.optional(v.union(v.id("equipment"), v.null())),
    /** Archivo nuevo (PDF) que sustituye al del manual. */
    storageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const manual = await ctx.db.get(args.id);
    if (!manual) throw new ConvexError("El manual ya no existe.");
    const actor = await requireMember(ctx);
    const manage = await hasCapability(ctx, actor, "manageManuals");
    const rights = { manage, userId: actor._id };
    if (!canEditManual(manual, rights)) {
      throw new ConvexError(NOT_YOURS_MESSAGE);
    }

    const patch: Partial<Doc<"manuals">> = {};
    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) throw new ConvexError("Ponle un título al manual.");
      patch.title = title;
    }
    // La clasificación se valida entera y de una vez, con lo que ya tenía el
    // manual en los campos que no se mandan.
    let reclassified = false;
    if (
      args.type !== undefined ||
      args.brand !== undefined ||
      args.model !== undefined ||
      args.modelId !== undefined ||
      args.equipmentId !== undefined
    ) {
      const classification = await validateClassification(ctx, {
        type: args.type ?? manual.type,
        brand: args.brand ?? manual.brand,
        model: args.model ?? manual.model,
        modelId:
          args.modelId === undefined ? manual.modelId : args.modelId,
        equipmentId:
          args.equipmentId === undefined
            ? manual.equipmentId
            : args.equipmentId,
      });
      // `validateClassification` omite lo que no hay: al esparcirlo, un campo
      // que se queda sin valor se borra de la ficha, que es lo que se pide al
      // desvincular un equipo o al dejar la marca en blanco.
      patch.type = classification.type;
      patch.brand = classification.brand;
      patch.model = classification.model;
      patch.modelId = classification.modelId;
      patch.equipmentId = classification.equipmentId;
      reclassified = true;
    }
    if (args.notes !== undefined) {
      const notes = richDocToStore(args.notes);
      if (manual.kind === "note" && !notes) {
        throw new ConvexError(
          "La nota es el contenido del manual: no puede quedarse vacía.",
        );
      }
      patch.notes = notes;
    }

    // El archivo solo lo cambia quien gestiona el módulo, y solo en un manual
    // que ya tenga archivo: la forma del manual no cambia al editar. El que se
    // sustituye no se borra del almacén: se guarda en el historial como versión
    // anterior, con lo que hace falta para seguir descargándolo.
    let retired: {
      storageId: Id<"_storage">;
      fileName: string;
      contentType: string;
      size: number;
    } | null = null;
    if (args.storageId !== undefined && args.storageId !== manual.storageId) {
      if (!manage) throw new ConvexError(NO_MANAGE_MESSAGE);
      if (manual.kind !== "file") {
        throw new ConvexError(
          "Una nota del taller no se convierte en archivo: crea otro manual para el PDF.",
        );
      }
      const file = await validateFile(ctx, args.storageId, args.fileName);
      patch.storageId = args.storageId;
      patch.fileName = file.fileName;
      patch.contentType = file.contentType;
      patch.size = file.size;
      if (manual.storageId) {
        retired = {
          storageId: manual.storageId,
          fileName: manual.fileName ?? "Manual.pdf",
          contentType: manual.contentType ?? "application/pdf",
          size: manual.size ?? 0,
        };
      }
    }

    // Qué cambió, para el historial: los campos que no se mandan quedan como
    // estaban, así que no cuentan como cambio.
    const changed = changedManualFields(
      {
        title: manual.title,
        type: manual.type,
        brand: manual.brand,
        model: manual.model,
        equipmentId: manual.equipmentId,
        notes: manual.notes,
      },
      {
        title: patch.title ?? manual.title,
        type: reclassified ? patch.type : manual.type,
        brand: reclassified ? patch.brand : manual.brand,
        model: reclassified ? patch.model : manual.model,
        equipmentId: reclassified
          ? (patch.equipmentId ?? null)
          : manual.equipmentId,
        notes: patch.notes ?? manual.notes,
      },
    );

    const now = Date.now();
    const by = actorName(actor);
    const entry =
      retired !== null
        ? {
            at: now,
            action: "fileReplaced" as const,
            by,
            byId: actor._id,
            ...(changed.length > 0 ? { fields: changed } : {}),
            file: retired,
          }
        : changed.length > 0
          ? {
              at: now,
              action: "edited" as const,
              by,
              byId: actor._id,
              fields: changed,
            }
          : null;
    await ctx.db.patch(args.id, {
      ...patch,
      updatedAt: now,
      // El historial solo crece cuando hay algo que contar.
      ...(entry ? { history: [...(manual.history ?? []), entry] } : {}),
    });
  },
});

/**
 * Borrado de un manual. Se lleva consigo sus archivos —el que está en uso y las
 * versiones anteriores que guarde su historial—: dejarlos en el almacén sin
 * ficha que los cite no los guarda, solo los deja a la espera de que la limpieza
 * nocturna los barra. Así que solo lo borra quien gestiona el módulo; su autor
 * puede borrar la nota que escribió, que no tiene archivo.
 */
export const remove = mutation({
  args: { id: v.id("manuals") },
  handler: async (ctx, args) => {
    const manual = await ctx.db.get(args.id);
    if (!manual) throw new ConvexError("El manual ya no existe.");
    const actor = await requireMember(ctx);
    const manage = await hasCapability(ctx, actor, "manageManuals");
    if (!canDeleteManual(manual, { manage, userId: actor._id })) {
      throw new ConvexError(NOT_YOURS_MESSAGE);
    }
    // Con la ficha se van todas sus versiones, no solo la última.
    for (const entry of manual.history ?? []) {
      if (entry.file) await ctx.storage.delete(entry.file.storageId);
    }
    if (manual.storageId) await ctx.storage.delete(manual.storageId);
    await ctx.db.delete(args.id);
  },
});

/**
 * Manuales y notas técnicas asociados a un modelo concreto (por modelId o por nombre de modelo).
 * Permite que cualquier equipo de ese modelo muestre inmediatamente su documentación técnica.
 */
export const byModel = query({
  args: {
    modelId: v.optional(v.id("equipmentModels")),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const me = userId === null ? null : await ctx.db.get(userId);
    if (!me || me.isAnonymous === true) return [];
    if (!(await hasCapability(ctx, me, "viewManuals"))) return [];

    let rows: Doc<"manuals">[] = [];
    if (args.modelId) {
      rows = await ctx.db
        .query("manuals")
        .withIndex("by_modelId", (q) => q.eq("modelId", args.modelId))
        .collect();
    } else if (args.model?.trim()) {
      const target = args.model.trim().toLowerCase();
      const all = await ctx.db.query("manuals").collect();
      rows = all.filter(
        (m) => m.model && m.model.trim().toLowerCase() === target,
      );
    }

    return await Promise.all(
      sortManuals(rows).map(async (manual) => ({
        ...manual,
        url: manual.storageId ? await ctx.storage.getUrl(manual.storageId) : null,
      })),
    );
  },
});

