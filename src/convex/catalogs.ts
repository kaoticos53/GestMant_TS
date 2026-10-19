import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { normalizeCatalogString } from "../lib/catalogs";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx, mutation, query } from "./_generated/server";

export const catalogKindValidator = v.union(
  v.literal("brand"),
  v.literal("equipmentLocation"),
  v.literal("partLocation"),
  v.literal("supplier"),
  v.literal("position"),
  v.literal("partCategory"),
);

type Ctx = QueryCtx | MutationCtx;

/** Requiere usuario autenticado y activo (cualquier miembro del taller). */
async function requireUser(ctx: Ctx): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError("Debes iniciar sesión para consultar catálogos.");
  }
  const user = await ctx.db.get(userId);
  if (!user || user.active === false || user.isAnonymous === true) {
    throw new ConvexError(
      user?.active === false
        ? "Esta cuenta ha sido dada de baja o no está activa."
        : "Debes iniciar sesión con una cuenta registrada.",
    );
  }
  return user;
}

/**
 * Lista todos los valores de un tipo de catálogo ordenados alfabéticamente.
 * Disponible para cualquier usuario registrado del taller.
 */
export const list = query({
  args: {
    kind: catalogKindValidator,
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const items = await ctx.db
      .query("catalogs")
      .withIndex("by_kind", (q) => q.eq("kind", args.kind))
      .collect();

    return items.sort((a, b) =>
      a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
    );
  },
});

/**
 * Lista pública de valores sugeridos para el formulario de notificación de incidencias.
 * Permite autocompletar puesto, ubicación y categoría sin exigir sesión previa (de la misma
 * forma que `equipment.uniqueModels` para los modelos comerciales).
 */
export const listPublic = query({
  args: {
    kind: catalogKindValidator,
  },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("catalogs")
      .withIndex("by_kind", (q) => q.eq("kind", args.kind))
      .collect();

    return items.sort((a, b) =>
      a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
    );
  },
});

/**
 * Lista todos los elementos de todos los tipos de catálogos (para la vista de Ajustes).
 */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const items = await ctx.db.query("catalogs").collect();
    return items.sort((a, b) =>
      a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
    );
  },
});

/**
 * Da de alta o devuelve el elemento de catálogo si ya existe con esa normalización.
 * Diseñado para ser invocado transparentemente al guardar formularios si el valor es nuevo.
 */
export const ensureItem = mutation({
  args: {
    kind: catalogKindValidator,
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const cleanName = args.name.trim();
    if (!cleanName) {
      throw new ConvexError("El nombre no puede estar vacío.");
    }
    const normalized = normalizeCatalogString(cleanName);

    const existing = await ctx.db
      .query("catalogs")
      .withIndex("by_kind_normalized", (q) =>
        q.eq("kind", args.kind).eq("normalized", normalized),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    return await ctx.db.insert("catalogs", {
      kind: args.kind,
      name: cleanName,
      normalized,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
/**
 * Propaga un cambio de nombre o fusión de catálogo en caliente a todas las tablas del sistema
 * que citan ese valor literal (equipos, modelos, manuales, repuestos, compras, peticiones,
 * usuarios e incidencias).
 */
async function propagateCatalogRename(
  ctx: MutationCtx,
  kind: "brand" | "equipmentLocation" | "partLocation" | "supplier" | "position" | "partCategory",
  oldName: string,
  newName: string,
) {
  const normOld = normalizeCatalogString(oldName);
  if (normOld === normalizeCatalogString(newName)) return;

  if (kind === "brand") {
    // Equipos
    const equipment = await ctx.db.query("equipment").collect();
    for (const eq of equipment) {
      if (eq.brand && normalizeCatalogString(eq.brand) === normOld) {
        await ctx.db.patch(eq._id, { brand: newName });
      }
    }
    // Modelos
    const models = await ctx.db.query("equipmentModels").collect();
    for (const m of models) {
      if (m.brand && normalizeCatalogString(m.brand) === normOld) {
        await ctx.db.patch(m._id, { brand: newName });
      }
    }
    // Manuales
    const manuals = await ctx.db.query("manuals").collect();
    for (const man of manuals) {
      if (man.brand && normalizeCatalogString(man.brand) === normOld) {
        await ctx.db.patch(man._id, { brand: newName });
      }
    }
  } else if (kind === "equipmentLocation") {
    // Ubicaciones de Equipos e Incidencias (plató, control, unidad móvil...)
    const equipment = await ctx.db.query("equipment").collect();
    for (const eq of equipment) {
      if (eq.location && normalizeCatalogString(eq.location) === normOld) {
        await ctx.db.patch(eq._id, { location: newName });
      }
    }
    // Miembros / usuarios (ubicación de trabajo habitual)
    const users = await ctx.db.query("users").collect();
    for (const u of users) {
      if (u.location && normalizeCatalogString(u.location) === normOld) {
        await ctx.db.patch(u._id, { location: newName });
      }
    }
    // Incidencias
    const incidents = await ctx.db.query("incidents").collect();
    for (const inc of incidents) {
      if (inc.location && normalizeCatalogString(inc.location) === normOld) {
        await ctx.db.patch(inc._id, { location: newName });
      }
    }
  } else if (kind === "partLocation") {
    // Ubicaciones físicas en almacén de Repuestos (estanterías, cajones, baldas)
    const parts = await ctx.db.query("spareParts").collect();
    for (const sp of parts) {
      if (sp.location && normalizeCatalogString(sp.location) === normOld) {
        await ctx.db.patch(sp._id, { location: newName });
      }
    }
  } else if (kind === "supplier") {
    // Repuestos
    const parts = await ctx.db.query("spareParts").collect();
    for (const sp of parts) {
      if (sp.supplier && normalizeCatalogString(sp.supplier) === normOld) {
        await ctx.db.patch(sp._id, { supplier: newName });
      }
    }
    // Equipos
    const equipment = await ctx.db.query("equipment").collect();
    for (const eq of equipment) {
      if (eq.supplier && normalizeCatalogString(eq.supplier) === normOld) {
        await ctx.db.patch(eq._id, { supplier: newName });
      }
    }
    // Plantillas de modelos
    const models = await ctx.db.query("equipmentModels").collect();
    for (const m of models) {
      if (m.defaultSupplier && normalizeCatalogString(m.defaultSupplier) === normOld) {
        await ctx.db.patch(m._id, { defaultSupplier: newName });
      }
    }
    // Peticiones de compra
    const purchaseRequests = await ctx.db.query("purchaseRequests").collect();
    for (const pr of purchaseRequests) {
      if (pr.supplier && normalizeCatalogString(pr.supplier) === normOld) {
        await ctx.db.patch(pr._id, { supplier: newName });
      }
    }
    // Órdenes de compra
    const purchaseOrders = await ctx.db.query("purchaseOrders").collect();
    for (const po of purchaseOrders) {
      if (po.supplier && normalizeCatalogString(po.supplier) === normOld) {
        await ctx.db.patch(po._id, { supplier: newName });
      }
    }
    // Recepciones
    const receptions = await ctx.db.query("receptions").collect();
    for (const rec of receptions) {
      if (rec.supplier && normalizeCatalogString(rec.supplier) === normOld) {
        await ctx.db.patch(rec._id, { supplier: newName });
      }
    }
  } else if (kind === "position") {
    // Miembros / usuarios
    const users = await ctx.db.query("users").collect();
    for (const u of users) {
      if (u.position && normalizeCatalogString(u.position) === normOld) {
        await ctx.db.patch(u._id, { position: newName });
      }
    }
    // Peticiones de repuestos (requesterTeam)
    const requests = await ctx.db.query("partRequests").collect();
    for (const req of requests) {
      if (req.requesterTeam && normalizeCatalogString(req.requesterTeam) === normOld) {
        await ctx.db.patch(req._id, { requesterTeam: newName });
      }
    }
    // Incidencias notificadas (reporterRole)
    const incidents = await ctx.db.query("incidents").collect();
    for (const inc of incidents) {
      if (inc.reporterRole && normalizeCatalogString(inc.reporterRole) === normOld) {
        await ctx.db.patch(inc._id, { reporterRole: newName });
      }
    }
  } else if (kind === "partCategory") {
    // Repuestos
    const parts = await ctx.db.query("spareParts").collect();
    for (const sp of parts) {
      if (sp.category && normalizeCatalogString(sp.category) === normOld) {
        await ctx.db.patch(sp._id, { category: newName });
      }
    }
  }
}

/**
 * Modifica el nombre de un elemento existente y propaga el cambio a todas las
 * tablas y documentos que citan este valor.
 */
export const update = mutation({
  args: {
    id: v.id("catalogs"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const cleanName = args.name.trim();
    if (!cleanName) {
      throw new ConvexError("El nombre no puede estar vacío.");
    }

    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new ConvexError("Elemento de catálogo no encontrado.");
    }

    const oldName = item.name;
    const normalized = normalizeCatalogString(cleanName);
    const duplicate = await ctx.db
      .query("catalogs")
      .withIndex("by_kind_normalized", (q) =>
        q.eq("kind", item.kind).eq("normalized", normalized),
      )
      .first();

    if (duplicate && duplicate._id !== args.id) {
      throw new ConvexError("Ya existe otro elemento con ese nombre en este catálogo.");
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      name: cleanName,
      normalized,
      updatedAt: now,
    });

    // Propagación en cascada a todos los registros vinculados
    await propagateCatalogRename(ctx, item.kind, oldName, cleanName);

    return args.id;
  },
});

/**
 * Elimina un elemento del catálogo maestro.
 */
export const remove = mutation({
  args: {
    id: v.id("catalogs"),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new ConvexError("Elemento no encontrado.");
    }
    await ctx.db.delete(args.id);
  },
});

/**
 * Fusiona un valor duplicado o erróneo en un valor canónico de destino.
 * Actualiza todas las referencias en las tablas del sistema y elimina el duplicado.
 */
export const mergeDuplicates = mutation({
  args: {
    sourceId: v.id("catalogs"),
    targetId: v.id("catalogs"),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    if (args.sourceId === args.targetId) {
      throw new ConvexError("No puedes fusionar un elemento consigo mismo.");
    }

    const source = await ctx.db.get(args.sourceId);
    const target = await ctx.db.get(args.targetId);

    if (!source || !target) {
      throw new ConvexError("Uno de los elementos no fue encontrado.");
    }

    if (source.kind !== target.kind) {
      throw new ConvexError("No se pueden fusionar elementos de distintos catálogos.");
    }

    const oldName = source.name;
    const newName = target.name;

    // Propagación en caliente según el tipo de catálogo
    await propagateCatalogRename(ctx, source.kind, oldName, newName);

    // Borramos el duplicado
    await ctx.db.delete(args.sourceId);

    return { merged: true, oldName, newName };
  },
});
