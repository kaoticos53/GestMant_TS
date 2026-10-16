import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { QueryCtx, mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import {
  hasAnyCapability,
  hasCapability,
  memberOrNull,
} from "./permissions";
import { richDocToStore } from "../lib/richDoc";

/** El catálogo de modelos requiere sesión iniciada. */
async function requireUser(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError("Debes iniciar sesión para consultar los modelos.");
  }
  const user = await ctx.db.get(userId);
  if (!user || user.active === false || user.isAnonymous === true) {
    throw new ConvexError(
      user?.active === false
        ? "Esta cuenta ha sido dada de baja o no está activa."
        : "Debes iniciar sesión con una cuenta registrada para gestionar los modelos.",
    );
  }
  return userId;
}

/** Escrituras en el catálogo: capacidad «manageEquipment» (admin siempre). */
async function requireManager(ctx: QueryCtx) {
  const userId = await requireUser(ctx);
  const user = await ctx.db.get(userId);
  if (!user || !(await hasCapability(ctx, user, "manageEquipment"))) {
    throw new ConvexError(
      "No tienes permisos para gestionar los modelos de equipos. Revisa la configuración de tu rol con el administrador.",
    );
  }
  return userId;
}

/**
 * Catálogo completo de modelos de equipos, ordenado por modelo.
 * Accesible para miembros con capacidad de ver equipos o consultar catálogo.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const me = await memberOrNull(ctx);
    if (
      !me ||
      !(await hasAnyCapability(ctx, me, [
        "viewEquipment",
        "lookupCatalog",
        "lookupEquipment",
      ]))
    ) {
      return [];
    }
    const models = await ctx.db.query("equipmentModels").collect();
    return models.sort((a, b) =>
      a.model.localeCompare(b.model, "es") ||
      (a.brand ?? "").localeCompare(b.brand ?? "", "es"),
    );
  },
});

/** Obtener un modelo por su ID. */
export const get = query({
  args: { id: v.id("equipmentModels") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db.get(args.id);
  },
});

/** Buscar un modelo por su código/denominación comercial exacta. */
export const byModelName = query({
  args: { model: v.string() },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const trimmed = args.model.trim();
    if (!trimmed) return null;
    return await ctx.db
      .query("equipmentModels")
      .withIndex("by_model", (q) => q.eq("model", trimmed))
      .first();
  },
});

const modelArgs = {
  brand: v.optional(v.string()),
  model: v.string(),
  name: v.string(),
  category: v.optional(v.string()),
  defaultMaintenanceIntervalDays: v.optional(v.number()),
  defaultSupplier: v.optional(v.string()),
  description: v.optional(v.string()),
};

/** Crear un nuevo modelo en el catálogo. */
export const create = mutation({
  args: modelArgs,
  handler: async (ctx, args) => {
    await requireManager(ctx);
    const model = args.model.trim();
    const name = args.name.trim();
    if (!model) throw new ConvexError("El código o nombre del modelo es obligatorio.");
    if (!name) throw new ConvexError("La designación genérica del modelo es obligatoria.");

    // Evitar modelos duplicados exactos
    const existing = await ctx.db
      .query("equipmentModels")
      .withIndex("by_model", (q) => q.eq("model", model))
      .first();
    if (existing) {
      throw new ConvexError(`Ya existe un modelo registrado como «${model}».`);
    }

    const now = Date.now();
    const id = await ctx.db.insert("equipmentModels", {
      brand: args.brand?.trim() || undefined,
      model,
      name,
      category: args.category?.trim() || undefined,
      defaultMaintenanceIntervalDays: args.defaultMaintenanceIntervalDays,
      defaultSupplier: args.defaultSupplier?.trim() || undefined,
      description: args.description ? richDocToStore(args.description) : undefined,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

/** Actualizar un modelo existente. */
export const update = mutation({
  args: {
    id: v.id("equipmentModels"),
    ...modelArgs,
  },
  handler: async (ctx, args) => {
    await requireManager(ctx);
    const current = await ctx.db.get(args.id);
    if (!current) throw new ConvexError("El modelo no existe.");

    const model = args.model.trim();
    const name = args.name.trim();
    if (!model) throw new ConvexError("El código o nombre del modelo es obligatorio.");
    if (!name) throw new ConvexError("La designación genérica del modelo es obligatoria.");

    if (model !== current.model) {
      const duplicate = await ctx.db
        .query("equipmentModels")
        .withIndex("by_model", (q) => q.eq("model", model))
        .first();
      if (duplicate && duplicate._id !== args.id) {
        throw new ConvexError(`Ya existe otro modelo registrado como «${model}».`);
      }
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      brand: args.brand?.trim() || undefined,
      model,
      name,
      category: args.category?.trim() || undefined,
      defaultMaintenanceIntervalDays: args.defaultMaintenanceIntervalDays,
      defaultSupplier: args.defaultSupplier?.trim() || undefined,
      description: args.description ? richDocToStore(args.description) : undefined,
      updatedAt: now,
    });
  },
});

/**
 * Asegurar que un modelo existe (idempotente).
 * Si ya existe uno con ese nombre comercial, lo devuelve. Si no, lo crea con los datos básicos.
 * Útil para el alta de incidencias y manuales.
 */
export const ensureModel = mutation({
  args: {
    model: v.string(),
    name: v.optional(v.string()),
    brand: v.optional(v.string()),
    defaultSupplier: v.optional(v.string()),
    defaultMaintenanceIntervalDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireManager(ctx);
    const trimmedModel = args.model.trim();
    if (!trimmedModel) {
      throw new ConvexError("El modelo no puede estar en blanco.");
    }

    const existing = await ctx.db
      .query("equipmentModels")
      .withIndex("by_model", (q) => q.eq("model", trimmedModel))
      .first();

    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    return await ctx.db.insert("equipmentModels", {
      model: trimmedModel,
      name: args.name?.trim() || trimmedModel,
      brand: args.brand?.trim() || undefined,
      defaultSupplier: args.defaultSupplier?.trim() || undefined,
      defaultMaintenanceIntervalDays: args.defaultMaintenanceIntervalDays,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Eliminar un modelo si no tiene equipos asociados ni manuales vinculados. */
export const remove = mutation({
  args: { id: v.id("equipmentModels") },
  handler: async (ctx, args) => {
    await requireManager(ctx);
    const model = await ctx.db.get(args.id);
    if (!model) return;

    // Comprobar si hay equipos usando este modelId
    const linkedEquipment = await ctx.db
      .query("equipment")
      .withIndex("by_modelId", (q) => q.eq("modelId", args.id))
      .first();

    if (linkedEquipment) {
      throw new ConvexError(
        "No se puede eliminar el modelo porque hay equipos en el inventario asociados a él.",
      );
    }

    // Comprobar si hay manuales usando este modelId
    const linkedManual = await ctx.db
      .query("manuals")
      .withIndex("by_modelId", (q) => q.eq("modelId", args.id))
      .first();

    if (linkedManual) {
      throw new ConvexError(
        "No se puede eliminar el modelo porque tiene manuales técnicos vinculados.",
      );
    }

    await ctx.db.delete(args.id);
  },
});

/**
 * Migración / Backfill inicial:
 * Recorre todos los equipos existentes en inventario, crea los modelos faltantes en `equipmentModels`
 * y asigna `modelId` a cada equipo que aún no lo tenga.
 */
export const backfillModelsFromEquipment = mutation({
  args: {},
  handler: async (ctx) => {
    await requireManager(ctx);
    const allEquipment = await ctx.db.query("equipment").collect();
    const modelMap = new Map<string, Id<"equipmentModels">>();

    // Cargar modelos existentes en el mapa
    const existingModels = await ctx.db.query("equipmentModels").collect();
    for (const m of existingModels) {
      modelMap.set(m.model.trim().toLowerCase(), m._id);
    }

    let createdCount = 0;
    let linkedCount = 0;
    const now = Date.now();

    for (const eq of allEquipment) {
      const modelName = eq.model?.trim();
      if (!modelName) continue;

      const key = modelName.toLowerCase();
      let modelId = modelMap.get(key);

      if (!modelId) {
        modelId = await ctx.db.insert("equipmentModels", {
          model: modelName,
          name: eq.name?.trim() || modelName,
          brand: eq.brand?.trim() || undefined,
          defaultSupplier: eq.supplier?.trim() || undefined,
          defaultMaintenanceIntervalDays: eq.maintenanceIntervalDays,
          description: eq.description,
          createdAt: now,
          updatedAt: now,
        });
        modelMap.set(key, modelId);
        createdCount++;
      }

      if (eq.modelId !== modelId) {
        await ctx.db.patch(eq._id, { modelId });
        linkedCount++;
      }
    }

    // Vincular también manuales que tengan 'model' coincidente y no tengan 'modelId'
    const allManuals = await ctx.db.query("manuals").collect();
    let manualsLinkedCount = 0;
    for (const man of allManuals) {
      if (!man.modelId && man.model) {
        const key = man.model.trim().toLowerCase();
        const modelId = modelMap.get(key);
        if (modelId) {
          await ctx.db.patch(man._id, { modelId });
          manualsLinkedCount++;
        }
      }
    }

    return {
      createdModels: createdCount,
      linkedEquipment: linkedCount,
      linkedManuals: manualsLinkedCount,
    };
  },
});
