import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { QueryCtx, mutation, query } from "./_generated/server";
import { richDocToStore } from "../lib/richDoc";
import {
  hasAnyCapability,
  hasCapability,
  memberOrNull,
} from "./permissions";

/** Toda la gestión de repuestos requiere sesión iniciada. */
async function requireUser(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError("Debes iniciar sesión para gestionar los repuestos.");
  }
  const user = await ctx.db.get(userId);
  if (!user || user.active === false || user.isAnonymous === true) {
    throw new ConvexError(
      user?.active === false
        ? "Esta cuenta ha sido dada de baja o no está activa."
        : "Debes iniciar sesión con una cuenta registrada para gestionar los repuestos.",
    );
  }
  return userId;
}

/** Escrituras en el catálogo: capacidad «manageInventory» (admin siempre). */
async function requireManager(ctx: QueryCtx) {
  const userId = await requireUser(ctx);
  const user = await ctx.db.get(userId);
  if (!user || !(await hasCapability(ctx, user, "manageInventory"))) {
    throw new ConvexError(
      "No tienes permisos para gestionar el catálogo. Revisa la configuración de tu rol con el administrador.",
    );
  }
  return userId;
}

/** Valida que los equipos existan y devuelve sus ids. */
async function compatibleIds(
  ctx: QueryCtx,
  ids: Id<"equipment">[],
): Promise<Id<"equipment">[]> {
  const unique = [...new Set(ids)];
  for (const id of unique) {
    const item = await ctx.db.get(id);
    if (!item) {
      throw new ConvexError("Uno de los equipos seleccionados ya no existe en el inventario.");
    }
  }
  return unique;
}

/** Valida que los modelos de equipo existan y devuelve sus ids. */
async function compatibleModelIds(
  ctx: QueryCtx,
  ids: Id<"equipmentModels">[],
): Promise<Id<"equipmentModels">[]> {
  const unique = [...new Set(ids)];
  for (const id of unique) {
    const item = await ctx.db.get(id);
    if (!item) {
      throw new ConvexError("Uno de los modelos seleccionados ya no existe en el catálogo.");
    }
  }
  return unique;
}

/** Igual que `compatibleIds`, listo para esparcir en un insert. */
async function compatibleDocs(
  ctx: QueryCtx,
  equipmentIds: Id<"equipment">[] | undefined,
  modelIds: Id<"equipmentModels">[] | undefined,
) {
  const result: {
    compatibleWith?: Id<"equipment">[];
    compatibleModels?: Id<"equipmentModels">[];
  } = {};
  const modelsSet = new Set<Id<"equipmentModels">>();
  if (modelIds) {
    const validModelIds = await compatibleModelIds(ctx, modelIds);
    for (const id of validModelIds) modelsSet.add(id);
  }
  if (equipmentIds) {
    result.compatibleWith = await compatibleIds(ctx, equipmentIds);
    // Derivar también sus modelos técnicos correspondientes
    for (const eqId of result.compatibleWith) {
      const eq = await ctx.db.get(eqId);
      if (eq?.modelId) modelsSet.add(eq.modelId);
    }
  }
  if (modelsSet.size > 0) {
    result.compatibleModels = Array.from(modelsSet);
  }
  return result;
}

/**
 * Catálogo completo, ordenado por nombre. Se lee desde el módulo de repuestos
 * y desde el formulario de peticiones (elegir referencias), así que basta con
 * una de las dos capacidades; sin ninguna devuelve vacío en vez de un error,
 * para no romper el módulo de peticiones.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    // Invitado o cuenta de baja: vacío en vez de error. El panel pide esta lista
    // al montar, así que lanzar aquí rompía la entrada como invitado; las
    // escrituras siguen exigiendo una cuenta con `requireManager`.
    const me = await memberOrNull(ctx);
    if (
      !me ||
      !(await hasAnyCapability(ctx, me, ["viewInventory", "lookupCatalog"]))
    ) {
      return [];
    }
    const parts = await ctx.db
      .query("spareParts")
      .withIndex("by_name")
      .collect();

    // Normalización transparente: si existen registros antiguos con compatibleWith pero sin
    // compatibleModels, resolvemos el modelId de los equipos para que no queden desvinculados.
    const hasLegacy = parts.some(
      (p) =>
        (!p.compatibleModels || p.compatibleModels.length === 0) &&
        p.compatibleWith &&
        p.compatibleWith.length > 0,
    );
    if (hasLegacy) {
      const allEquipment = await ctx.db.query("equipment").collect();
      const eqMap = new Map(allEquipment.map((eq) => [eq._id, eq]));
      return parts
        .map((part) => {
          if (
            (!part.compatibleModels || part.compatibleModels.length === 0) &&
            part.compatibleWith &&
            part.compatibleWith.length > 0
          ) {
            const derivedModelIds = [
              ...new Set(
                part.compatibleWith
                  .map((eqId) => eqMap.get(eqId)?.modelId)
                  .filter((id): id is Id<"equipmentModels"> => Boolean(id)),
              ),
            ];
            if (derivedModelIds.length > 0) {
              return {
                ...part,
                compatibleModels: derivedModelIds,
              };
            }
          }
          return part;
        })
        .sort(
          (a, b) =>
            a.name.localeCompare(b.name, "es") ||
            a.code.localeCompare(b.code, "es"),
        );
    }

    return parts.sort(
      (a, b) =>
        a.name.localeCompare(b.name, "es") || a.code.localeCompare(b.code, "es"),
    );
  },
});

/**
 * Consulta paginada del catálogo de repuestos mediante cursor de Convex (para usePaginatedQuery).
 */
export const paginatedList = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const me = await memberOrNull(ctx);
    if (
      !me ||
      !(await hasAnyCapability(ctx, me, ["viewInventory", "lookupCatalog"]))
    ) {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
      };
    }
    return await ctx.db
      .query("spareParts")
      .withIndex("by_name")
      .paginate(args.paginationOpts);
  },
});

export const create = mutation({
  args: {
    code: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    unit: v.string(),
    stock: v.number(),
    minStock: v.number(),
    location: v.optional(v.string()),
    supplier: v.optional(v.string()),
    partNumber: v.optional(v.string()),
    unitPrice: v.optional(v.number()),
    purchaseUrl: v.optional(v.string()),
    compatibleWith: v.optional(v.array(v.id("equipment"))),
    compatibleModels: v.optional(v.array(v.id("equipmentModels"))),
  },
  handler: async (ctx, args) => {
    await requireManager(ctx);
    const code = args.code.trim().toUpperCase();
    const name = args.name.trim();
    if (!code) throw new ConvexError("El código del repuesto es obligatorio.");
    if (!name) throw new ConvexError("El nombre del repuesto es obligatorio.");

    const existing = await ctx.db
      .query("spareParts")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (existing) {
      throw new ConvexError(`Ya existe un repuesto con el código ${code}.`);
    }

    // La descripción llega del editor enriquecido como bloques con formato: se
    // guarda el documento ya normalizado (recortado de párrafos vacíos) y se
    // omite cuando no dice nada. Una descripción escrita en un campo de texto
    // plano —de las de antes— se guarda tal cual se escribió.
    const description = richDocToStore(args.description);
    const now = Date.now();
    return await ctx.db.insert("spareParts", {
      code,
      name,
      ...(description ? { description } : {}),
      category: args.category,
      unit: args.unit.trim() || "ud",
      stock: Math.max(0, Math.floor(args.stock)),
      minStock: Math.max(0, Math.floor(args.minStock)),
      ...(args.location?.trim() ? { location: args.location.trim().toUpperCase() } : {}),
      ...(args.supplier?.trim() ? { supplier: args.supplier.trim() } : {}),
      ...(args.partNumber?.trim() ? { partNumber: args.partNumber.trim() } : {}),
      ...(typeof args.unitPrice === "number" && args.unitPrice >= 0
        ? { unitPrice: args.unitPrice }
        : {}),
      ...(args.purchaseUrl?.trim() ? { purchaseUrl: args.purchaseUrl.trim() } : {}),
      ...(await compatibleDocs(ctx, args.compatibleWith, args.compatibleModels)),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("spareParts"),
    code: v.optional(v.string()),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    unit: v.optional(v.string()),
    stock: v.optional(v.number()),
    minStock: v.optional(v.number()),
    location: v.optional(v.string()),
    supplier: v.optional(v.string()),
    partNumber: v.optional(v.string()),
    unitPrice: v.optional(v.number()),
    purchaseUrl: v.optional(v.string()),
    compatibleWith: v.optional(v.array(v.id("equipment"))),
    compatibleModels: v.optional(v.array(v.id("equipmentModels"))),
  },
  handler: async (ctx, args) => {
    await requireManager(ctx);
    const part = await ctx.db.get(args.id);
    if (!part) throw new ConvexError("El repuesto ya no existe.");

    const patch: Partial<Doc<"spareParts">> = {};
    if (args.code !== undefined) {
      const code = args.code.trim().toUpperCase();
      if (!code) throw new ConvexError("El código del repuesto es obligatorio.");
      if (code !== part.code) {
        const clash = await ctx.db
          .query("spareParts")
          .withIndex("by_code", (q) => q.eq("code", code))
          .unique();
        if (clash) throw new ConvexError(`Ya existe un repuesto con el código ${code}.`);
      }
      patch.code = code;
    }
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new ConvexError("El nombre del repuesto es obligatorio.");
      patch.name = name;
    }
    // Mismo trato que en el alta: lo que emite el editor, normalizado. Si se
    // borra la descripción, el repuesto queda sin nota (en blanco), como hasta
    // ahora.
    if (args.description !== undefined)
      patch.description = richDocToStore(args.description) ?? "";
    if (args.category !== undefined) patch.category = args.category;
    if (args.unit !== undefined) patch.unit = args.unit.trim() || "ud";
    if (args.stock !== undefined) patch.stock = Math.max(0, Math.floor(args.stock));
    if (args.minStock !== undefined) patch.minStock = Math.max(0, Math.floor(args.minStock));
    if (args.location !== undefined) patch.location = args.location.trim().toUpperCase();
    if (args.supplier !== undefined) patch.supplier = args.supplier.trim();
    if (args.partNumber !== undefined) patch.partNumber = args.partNumber.trim();
    if (args.purchaseUrl !== undefined) patch.purchaseUrl = args.purchaseUrl.trim();
    if (args.compatibleWith !== undefined) {
      patch.compatibleWith = await compatibleIds(ctx, args.compatibleWith);
    }
    if (args.compatibleModels !== undefined) {
      patch.compatibleModels = await compatibleModelIds(ctx, args.compatibleModels);
    } else if (args.compatibleWith !== undefined) {
      const derived = new Set<Id<"equipmentModels">>();
      for (const eqId of patch.compatibleWith ?? []) {
        const eq = await ctx.db.get(eqId);
        if (eq?.modelId) derived.add(eq.modelId);
      }
      if (derived.size > 0) {
        patch.compatibleModels = Array.from(derived);
      }
    }
    if (args.unitPrice !== undefined) {
      if (args.unitPrice < 0) throw new ConvexError("El precio no puede ser negativo.");
      patch.unitPrice = args.unitPrice;
    }

    await ctx.db.patch(args.id, { ...patch, updatedAt: Date.now() });
  },
});

/** Ajuste rápido de stock desde la tabla (+/- unidades). */
export const adjustStock = mutation({
  args: {
    id: v.id("spareParts"),
    delta: v.number(),
  },
  handler: async (ctx, args) => {
    await requireManager(ctx);
    const part = await ctx.db.get(args.id);
    if (!part) throw new ConvexError("El repuesto ya no existe.");
    const next = Math.max(0, part.stock + Math.trunc(args.delta));
    if (next === part.stock) return;
    await ctx.db.patch(args.id, { stock: next, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("spareParts") },
  handler: async (ctx, args) => {
    await requireManager(ctx);
    const part = await ctx.db.get(args.id);
    if (!part) throw new ConvexError("El repuesto ya no existe.");
    await ctx.db.delete(args.id);
  },
});
