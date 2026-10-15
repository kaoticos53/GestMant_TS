import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { type MutationCtx, type QueryCtx, mutation, query } from "../_generated/server";
import { notifyUsers } from "../notify";
import { hasCapability } from "../permissions";
import { documentMoveAlert, summarizeAudit } from "../../lib/audit";
import { isClosedIncident } from "../../lib/incidentFlow";
import { richDocToStore } from "../../lib/richDoc";
import {
  DOCUMENT_ACTIONS,
  documentActionValidator,
  type DocumentAction,
} from "../schema";
import {
  type Actor,
  actorName,
  auditAlertRecipientIds,
  getIncident,
  isModerator,
  requireActor,
} from "./helpers";

async function requireDocumentEditor(
  ctx: QueryCtx | MutationCtx,
): Promise<Actor> {
  const actor = await requireActor(ctx);
  if (!(await hasCapability(ctx, actor, "manageIncidents"))) {
    throw new ConvexError(
      isModerator(actor)
        ? "No tienes permisos para gestionar los documentos de una incidencia. Revisa la configuración de tu rol con el administrador."
        : "Solo el coordinador puede adjuntar, editar o quitar documentos de una incidencia.",
    );
  }
  return actor;
}


async function logDocumentChange(
  ctx: MutationCtx,
  args: {
    incidentId: Id<"incidents">;
    documentId: Id<"incidentDocuments">;
    action: DocumentAction;
    name: string;
    previousName?: string;
    actor: Actor;
    at: number;
  },
): Promise<void> {
  await ctx.db.insert("incidentDocumentLog", {
    incidentId: args.incidentId,
    documentId: args.documentId,
    action: args.action,
    name: args.name,
    ...(args.previousName ? { previousName: args.previousName } : {}),
    by: actorName(args.actor),
    byId: args.actor._id,
    at: args.at,
  });
}

/**
 * Avisa a la audiencia del expediente de un movimiento que no debe pasar
 * desapercibido: un documento retirado —su movimiento es la única constancia
 * que queda de él— o cualquier movimiento del expediente de una incidencia ya
 * cerrada. Un alta o una edición al día no avisan a nadie. La decisión y el
 * texto viven en `lib/audit`, con sus pruebas; a quién le llega se decide en
 * «Ajustes del taller» (por defecto, quien audita).
 *
 * A diferencia del resto de avisos de la aplicación, aquí no se excluye a quien
 * provoca el movimiento: el aviso no cuenta una novedad a quien la conoce, es
 * la constancia de un cambio sensible en el expediente. Un taller con un solo
 * administrador no tendría de otra forma ninguna señal de que su expediente se
 * ha movido.
 */
async function notifyDocumentMove(
  ctx: MutationCtx,
  args: {
    incident: Doc<"incidents">;
    action: DocumentAction;
    name: string;
    previousName?: string;
  },
): Promise<void> {
  const text = documentMoveAlert({
    action: args.action,
    reference: args.incident.reference,
    name: args.name,
    ...(args.previousName ? { previousName: args.previousName } : {}),
    closed: isClosedIncident(args.incident.status),
  });
  if (text === null) return;
  await notifyUsers(
    ctx,
    await auditAlertRecipientIds(ctx),
    text,
    args.incident._id,
  );
}


export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireDocumentEditor(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Adjunta un documento a la incidencia: el archivo de verdad (`storageId`), su
 * nombre visible, la nota opcional y el autor, que es quien lo adjunta —queda
 * firmado en el expediente—.
 *
 * El archivo es opcional para poder seguir llamando a esto con documentos de
 * solo nombre (la muestra y las pruebas del expediente): los que adjunta la
 * aplicación siempre suben uno antes.
 */
export const attachDocument = mutation({
  args: {
    incidentId: v.id("incidents"),
    name: v.string(),
    storageId: v.optional(v.id("_storage")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireDocumentEditor(ctx);
    const incident = await getIncident(ctx, args.incidentId);
    const author = actorName(actor);
    // Una sola marca de tiempo para la fila y para la copia de la ficha: si no,
    // pueden quedar separadas por un milisegundo y no cuadrar entre sí.
    const now = Date.now();
    const id = await ctx.db.insert("incidentDocuments", {
      incidentId: args.incidentId,
      name: args.name.trim(),
      ...(args.storageId ? { storageId: args.storageId } : {}),
      note: richDocToStore(args.note),
      author,
      createdAt: now,
    });
    await ctx.db.patch(args.incidentId, {
      updatedAt: now,
      documents: [
        ...(incident.documents ?? []),
        {
          _id: id,
          name: args.name.trim(),
          ...(args.storageId ? { storageId: args.storageId } : {}),
          note: richDocToStore(args.note),
          author,
          createdAt: now,
        },
      ],
    });
    await logDocumentChange(ctx, {
      incidentId: args.incidentId,
      documentId: id,
      action: DOCUMENT_ACTIONS.ATTACHED,
      name: args.name.trim(),
      actor,
      at: now,
    });
    await notifyDocumentMove(ctx, {
      incident,
      action: DOCUMENT_ACTIONS.ATTACHED,
      name: args.name.trim(),
    });
    return id;
  },
});


export const updateDocument = mutation({
  args: {
    incidentId: v.id("incidents"),
    documentId: v.id("incidentDocuments"),
    name: v.optional(v.string()),
    note: v.optional(v.string()),
    /** Archivo nuevo que sustituye al del documento. */
    storageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const actor = await requireDocumentEditor(ctx);
    const incident = await getIncident(ctx, args.incidentId);
    const doc = (incident.documents ?? []).find(
      (item) => item._id === args.documentId,
    );
    if (!doc) {
      throw new ConvexError("Ese documento no pertenece a esta incidencia.");
    }
    const newName = args.name?.trim() || doc.name;
    const newNote = richDocToStore(args.note);
    if (!newName) {
      throw new ConvexError("El nombre del documento es obligatorio.");
    }
    // Volver a mandar el mismo archivo no es reemplazarlo: el cambio real es
    // que el documento pase a apuntar a otro.
    const replacedFile =
      args.storageId !== undefined && args.storageId !== doc.storageId;
    const newStorageId = args.storageId ?? doc.storageId;
    const now = Date.now();
    await ctx.db.patch(args.documentId, {
      name: newName,
      note: newNote,
      ...(newStorageId ? { storageId: newStorageId } : {}),
    });
    await ctx.db.patch(args.incidentId, {
      updatedAt: now,
      documents: (incident.documents ?? []).map((item) =>
        item._id === args.documentId
          ? {
              ...item,
              name: newName,
              note: newNote,
              ...(newStorageId ? { storageId: newStorageId } : {}),
            }
          : item,
      ),
    });
    // Con el archivo nuevo ya enlazado, el sustituido se va del almacén. Del
    // que estuvo queda su movimiento en el rastro y, si el reemplazo vino con
    // un renombrado, el nombre con el que se adjuntó.
    if (replacedFile && doc.storageId) {
      await ctx.storage.delete(doc.storageId);
    }
    // Guardar sin cambiar nada no deja rastro: el registro es de cambios
    // reales, no de pulsaciones del botón.
    if (replacedFile || newName !== doc.name || newNote !== doc.note) {
      const action = replacedFile
        ? DOCUMENT_ACTIONS.REPLACED
        : DOCUMENT_ACTIONS.EDITED;
      await logDocumentChange(ctx, {
        incidentId: args.incidentId,
        documentId: args.documentId,
        action,
        name: newName,
        // Solo cuando cambió el nombre visible: así el rastro distingue un
        // renombrado de una corrección de la nota del adjunto.
        ...(newName !== doc.name ? { previousName: doc.name } : {}),
        actor,
        at: now,
      });
      await notifyDocumentMove(ctx, {
        incident,
        action,
        name: newName,
        ...(newName !== doc.name ? { previousName: doc.name } : {}),
      });
    }
  },
});

/** Quita un documento adjunto sin borrar notas ni el resto de la incidencia. */
export const removeDocument = mutation({
  args: {
    incidentId: v.id("incidents"),
    documentId: v.id("incidentDocuments"),
  },
  handler: async (ctx, args) => {
    const actor = await requireDocumentEditor(ctx);
    const incident = await getIncident(ctx, args.incidentId);
    const doc = (incident.documents ?? []).find(
      (item) => item._id === args.documentId,
    );
    if (!doc) {
      throw new ConvexError("Ese documento ya no está en esta incidencia.");
    }
    const now = Date.now();
    await ctx.db.delete(args.documentId);
    await ctx.db.patch(args.incidentId, {
      updatedAt: now,
      documents: (incident.documents ?? []).filter(
        (item) => item._id !== args.documentId,
      ),
    });
    // El archivo se va con la ficha: retirar un documento del expediente es
    // dejarlo fuera, no esconderlo. Lo que queda es su movimiento en el rastro,
    // que es la constancia de quién lo quitó y con qué nombre estuvo.
    if (doc.storageId) await ctx.storage.delete(doc.storageId);
    // Al rastro se le da el nombre que tenía: es lo único que quedará de él.
    await logDocumentChange(ctx, {
      incidentId: args.incidentId,
      documentId: args.documentId,
      action: DOCUMENT_ACTIONS.REMOVED,
      name: doc.name,
      actor,
      at: now,
    });
    await notifyDocumentMove(ctx, {
      incident,
      action: DOCUMENT_ACTIONS.REMOVED,
      name: doc.name,
    });
  },
});

/**
 * Rastro de auditoría de los documentos de una incidencia, del más reciente al
 * más antiguo: quién adjuntó, editó o quitó cada uno y cuándo. Es información
 * de coordinación —y la única constancia de un adjunto retirado—, así que la
 * lee quien puede gestionar el expediente, no cualquiera que vea la cola.
 */

export const documentTrail = query({
  args: { incidentId: v.id("incidents") },
  handler: async (ctx, args) => {
    await requireDocumentEditor(ctx);
    const entries = await ctx.db
      .query("incidentDocumentLog")
      .withIndex("by_incident", (q) => q.eq("incidentId", args.incidentId))
      .collect();
    // Del más reciente al más antiguo, con la fecha del cambio como
    // referencia y el orden de escritura como desempate: dos cambios del mismo
    // milisegundo (adjuntar y renombrar del tirón) se leen siempre igual. El
    // rastro de una incidencia es corto y se lee entero.
    return entries.sort(
      (a, b) => b.at - a.at || b._creationTime - a._creationTime,
    );
  },
});

/**
 * El rastro de varias incidencias de una vez, para el lote de informes de un
 * periodo: una sola lectura del rastro, recortada a las incidencias pedidas, en
 * vez de una consulta por incidencia. Mismo permiso que `documentTrail` —el
 * expediente lo lee quien coordina—, y se ordena igual: del movimiento más
 * reciente al más antiguo, con el orden de escritura como desempate.
 */
export const documentTrails = query({
  args: { incidentIds: v.array(v.id("incidents")) },
  handler: async (ctx, args) => {
    await requireDocumentEditor(ctx);
    if (args.incidentIds.length === 0) return [];
    const wanted = new Set(args.incidentIds);
    // El rastro de documentos del taller es corto y se lee entero: recortarlo
    // por la lista de incidencias es más barato que una consulta por cada una.
    const entries = await ctx.db
      .query("incidentDocumentLog")
      .withIndex("by_at")
      .order("desc")
      .collect();
    return entries
      .filter((entry) => wanted.has(entry.incidentId))
      .sort((a, b) => b.at - a.at || b._creationTime - a._creationTime);
  },
});

/**
 * Auditoría de documentos de todo el taller: cada alta, edición y retirada que
 * ha quedado anotada en el rastro, con filtros por persona, por fechas y por
 * tipo de movimiento. A diferencia de `documentTrail`, que cuenta la historia
 * de una incidencia, esto recorre el expediente de todas: es una lectura de
 * administración, así que la pide quien tiene la capacidad bloqueada
 * `viewAudit` (solo el administrador).
 *
 * Se devuelve del movimiento más reciente al más antiguo, la lista de personas
 * que firman movimientos —siempre completa, del histórico entero, para que
 * elegir una no vacíe el desplegable desde el que se elige— y el resumen de lo
 * que pasa el filtro.
 */
export const documentAudit = query({
  args: {
    /** Persona que hizo el movimiento. */
    userId: v.optional(v.id("users")),
    /** Primer instante incluido. */
    from: v.optional(v.number()),
    /** Último instante incluido (el día final se manda hasta su último ms). */
    to: v.optional(v.number()),
    /** Tipo de movimiento. */
    action: v.optional(documentActionValidator),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    if (!(await hasCapability(ctx, actor, "viewAudit"))) {
      throw new ConvexError(
        "Solo el administrador puede consultar la auditoría de documentos.",
      );
    }

    const { userId, from, to, action } = args;

    // El histórico entero, del más reciente al más antiguo, por la fecha del
    // movimiento. Se lee completo a propósito: los filtros no pueden recortar
    // la lectura, porque de ella salen también el total sin filtrar y la lista
    // de firmantes —elegir a una persona no debe vaciar el desplegable desde el
    // que se la elige—. El rastro de documentos del taller es corto.
    const all = await ctx.db
      .query("incidentDocumentLog")
      .withIndex("by_at")
      .order("desc")
      .collect();

    const matches = all.filter(
      (entry) =>
        (userId === undefined || entry.byId === userId) &&
        (from === undefined || entry.at >= from) &&
        (to === undefined || entry.at <= to) &&
        (action === undefined || entry.action === action),
    );

    const people = new Map<
      Id<"users">,
      { id: Id<"users">; name: string; movements: number }
    >();
    for (const entry of all) {
      const found = people.get(entry.byId);
      if (found) {
        found.movements += 1;
        continue;
      }
      people.set(entry.byId, {
        id: entry.byId,
        name: entry.by,
        movements: 1,
      });
    }
    const authors = [...people.values()].sort(
      (a, b) => b.movements - a.movements || a.name.localeCompare(b.name, "es"),
    );

    // La ficha de cada incidencia afectada, para nombrarla y poder abrirla.
    const incidents = new Map<Id<"incidents">, Doc<"incidents">>();
    for (const entry of matches) {
      if (incidents.has(entry.incidentId)) continue;
      const incident = await ctx.db.get(entry.incidentId);
      if (incident) incidents.set(entry.incidentId, incident);
    }

    return {
      entries: matches.map((entry) => {
        const incident = incidents.get(entry.incidentId);
        return {
          _id: entry._id,
          incidentId: entry.incidentId,
          reference: incident?.reference ?? "—",
          title: incident
            ? `${incident.equipmentKind} ${incident.model}`.trim()
            : "",
          status: incident?.status,
          archived: incident?.archivedAt !== undefined,
          documentId: entry.documentId,
          action: entry.action,
          name: entry.name,
          previousName: entry.previousName,
          by: entry.by,
          byId: entry.byId,
          at: entry.at,
        };
      }),
      authors,
      summary: summarizeAudit(
        matches.map((entry) => ({
          action: entry.action,
          byId: entry.byId,
          incidentId: entry.incidentId,
        })),
      ),
      /** Movimientos en el histórico completo, para decir cuánto se está filtrando. */
      unfilteredTotal: all.length,
    };
  },
});
