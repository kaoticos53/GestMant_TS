import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { QueryCtx, mutation, query } from "./_generated/server";
import {
  hasAnyCapability,
  hasCapability,
  memberOrNull,
} from "./permissions";
import { richDocToStore } from "../lib/richDoc";

/** El inventario de equipos requiere sesión iniciada. */
async function requireUser(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError("Debes iniciar sesión para gestionar los equipos.");
  }
  const user = await ctx.db.get(userId);
  if (!user || user.active === false || user.isAnonymous === true) {
    throw new ConvexError(
      user?.active === false
        ? "Esta cuenta ha sido dada de baja o no está activa."
        : "Debes iniciar sesión con una cuenta registrada para gestionar los equipos.",
    );
  }
  return userId;
}

/** Escrituras en el inventario: capacidad «manageEquipment» (admin siempre). */
async function requireManager(ctx: QueryCtx) {
  const userId = await requireUser(ctx);
  const user = await ctx.db.get(userId);
  if (!user || !(await hasCapability(ctx, user, "manageEquipment"))) {
    throw new ConvexError(
      "No tienes permisos para gestionar los equipos. Revisa la configuración de tu rol con el administrador.",
    );
  }
  return userId;
}

/**
 * Inventario completo, ordenado por modelo. Se lee desde el módulo de equipos,
 * desde el formulario de peticiones (equipo afectado) y desde la verificación
 * y el cierre de incidencias (vincular el equipo). Basta con una de las tres
 * capacidades: ver el módulo, consultar el catálogo al pedir material o
 * consultar el inventario al vincular una incidencia. Sin ninguna devuelve
 * vacío en vez de un error, para no tumbar esos flujos: el Dashboard pide esta
 * lista al montar y sus consumidores degradan a «sin opciones».
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    // Invitado o cuenta de baja: vacío en vez de error. El panel pide esta lista
    // al montar y sus consumidores degradan a «sin opciones»; las escrituras
    // siguen exigiendo una cuenta con `requireManager`.
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
    const equipment = await ctx.db.query("equipment").collect();
    return equipment.sort(
      (a, b) =>
        a.model.localeCompare(b.model, "es") ||
        a.name.localeCompare(b.name, "es"),
    );
  },
});

/**
 * Modelos únicos del inventario. Lista alfabética de los nombres comerciales
 * de los equipos dados de alta en el taller, utilizada para autocompletar
 * el campo de modelo tanto en el panel como en el formulario público
 * de notificación de incidencias.
 */
export const uniqueModels = query({
  args: {},
  handler: async (ctx) => {
    const equipment = await ctx.db.query("equipment").collect();
    const set = new Set<string>();
    for (const eq of equipment) {
      const trimmed = eq.model?.trim();
      if (trimmed) set.add(trimmed);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  },
});

const equipmentArgs = {
  code: v.optional(v.string()),
  brand: v.optional(v.string()),
  name: v.string(),
  model: v.string(),
  location: v.optional(v.string()),
  description: v.optional(v.string()),
  // Ficha de compra y ciclo de vida
  serialNumber: v.optional(v.string()),
  supplier: v.optional(v.string()),
  purchaseDate: v.optional(v.number()),
  decommissionDate: v.optional(v.number()),
  warrantyEndDate: v.optional(v.number()),
  // Plan de mantenimiento preventivo: días entre revisiones
  maintenanceIntervalDays: v.optional(v.number()),
};

function validate(code: string, name: string, model: string) {
  if (!name.trim())
    throw new ConvexError("La designación del equipo es obligatoria.");
  if (!model.trim())
    throw new ConvexError("El modelo del equipo es obligatorio.");
  if (!code.trim())
    throw new ConvexError("El código de inventario es obligatorio.");
}

/** Las fechas de ciclo de vida deben ser coherentes entre sí. */
function validateDates(
  purchaseDate?: number,
  decommissionDate?: number,
  warrantyEndDate?: number,
) {
  if (
    purchaseDate !== undefined &&
    decommissionDate !== undefined &&
    decommissionDate < purchaseDate
  ) {
    throw new ConvexError(
      "La fecha de baja no puede ser anterior a la fecha de alta.",
    );
  }
  if (
    purchaseDate !== undefined &&
    warrantyEndDate !== undefined &&
    warrantyEndDate < purchaseDate
  ) {
    throw new ConvexError(
      "El fin de garantía no puede ser anterior a la fecha de alta.",
    );
  }
}

/** El intervalo del plan preventivo, si se indica, debe ser positivo. */
function validateInterval(interval?: number) {
  if (interval !== undefined && (!Number.isFinite(interval) || interval <= 0)) {
    throw new ConvexError(
      "El intervalo de revisión debe ser un número de días mayor que cero.",
    );
  }
}

async function codeClash(ctx: QueryCtx, code: string, excludeId?: string) {
  const existing = await ctx.db
    .query("equipment")
    .withIndex("by_code", (q) => q.eq("code", code))
    .collect();
  return existing.some((item) => item._id !== excludeId);
}

export const create = mutation({
  args: equipmentArgs,
  handler: async (ctx, args) => {
    await requireManager(ctx);
    const code = args.code?.trim().toUpperCase() || "";
    validate(code, args.name, args.model);
    validateDates(
      args.purchaseDate,
      args.decommissionDate,
      args.warrantyEndDate,
    );
    validateInterval(args.maintenanceIntervalDays);
    if (await codeClash(ctx, code)) {
      throw new ConvexError(`Ya existe un equipo con el código ${code}.`);
    }

    const now = Date.now();
    // La descripción es la nota del equipo y se escribe con formato: se guarda
    // su documento tal cual (y sin restos cuando se queda vacía). Una nota de
    // antes, escrita en texto plano, se guarda igual que estaba.
    const description = richDocToStore(args.description);
    await ctx.db.insert("equipment", {
      code,
      ...(args.brand?.trim() ? { brand: args.brand.trim() } : {}),
      name: args.name.trim(),
      model: args.model.trim(),
      ...(args.location?.trim() ? { location: args.location.trim() } : {}),
      ...(description ? { description } : {}),
      ...(args.serialNumber?.trim()
        ? { serialNumber: args.serialNumber.trim() }
        : {}),
      ...(args.supplier?.trim() ? { supplier: args.supplier.trim() } : {}),
      ...(args.purchaseDate !== undefined
        ? { purchaseDate: args.purchaseDate }
        : {}),
      ...(args.decommissionDate !== undefined
        ? { decommissionDate: args.decommissionDate }
        : {}),
      ...(args.warrantyEndDate !== undefined
        ? { warrantyEndDate: args.warrantyEndDate }
        : {}),
      ...(args.maintenanceIntervalDays !== undefined
        ? { maintenanceIntervalDays: args.maintenanceIntervalDays }
        : {}),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("equipment"),
    ...equipmentArgs,
  },
  handler: async (ctx, args) => {
    await requireManager(ctx);
    const item = await ctx.db.get(args.id);
    if (!item) throw new ConvexError("El equipo ya no existe.");

    const code = args.code?.trim().toUpperCase() || "";
    validate(code, args.name, args.model);
    validateDates(
      args.purchaseDate,
      args.decommissionDate,
      args.warrantyEndDate,
    );
    validateInterval(args.maintenanceIntervalDays);
    if (await codeClash(ctx, code, args.id)) {
      throw new ConvexError(`Ya existe un equipo con el código ${code}.`);
    }

    await ctx.db.patch(args.id, {
      code,
      brand: args.brand?.trim() || undefined,
      name: args.name.trim(),
      model: args.model.trim(),
      location: args.location?.trim() || undefined,
      // `undefined` aquí borra la nota: una descripción vacía deja el equipo
      // sin ella, y el documento del editor se guarda tal cual llega.
      description: richDocToStore(args.description),
      serialNumber: args.serialNumber?.trim() || undefined,
      supplier: args.supplier?.trim() || undefined,
      // `undefined` en patch elimina el campo: así se borran fechas vacías
      purchaseDate: args.purchaseDate,
      decommissionDate: args.decommissionDate,
      warrantyEndDate: args.warrantyEndDate,
      maintenanceIntervalDays: args.maintenanceIntervalDays,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Borrado protegido: no se elimina un equipo que sea compatible de
 * referencias del catálogo (para no romper los filtros); las peticiones que
 * lo mencionen conservan su texto y se desvinculan.
 */
export const remove = mutation({
  args: { id: v.id("equipment") },
  handler: async (ctx, args) => {
    await requireManager(ctx);
    const item = await ctx.db.get(args.id);
    if (!item) throw new ConvexError("El equipo ya no existe.");

    const parts = await ctx.db.query("spareParts").collect();
    const referencing = parts.filter((part) =>
      part.compatibleWith?.includes(args.id),
    );
    if (referencing.length > 0) {
      const compatibles =
        referencing.length === 1
          ? "1 repuesto del catálogo es compatible"
          : `${referencing.length} repuestos del catálogo son compatibles`;
      throw new ConvexError(
        `${compatibles} con ${item.model}. Quita esa relación antes de borrar el equipo.`,
      );
    }

    const requests = await ctx.db.query("partRequests").collect();
    for (const request of requests) {
      if (request.equipmentId === args.id) {
        await ctx.db.patch(request._id, { equipmentId: undefined });
      }
    }

    // Los manuales del equipo no se borran con él: un manual es documentación
    // del modelo y sigue valiendo para los demás equipos, así que se quedan
    // sin equipo asignado y con su marca y modelo, que es su clasificación.
    const manuals = await ctx.db
      .query("manuals")
      .withIndex("by_equipment", (q) => q.eq("equipmentId", args.id))
      .collect();
    for (const manual of manuals) {
      await ctx.db.patch(manual._id, {
        equipmentId: undefined,
        updatedAt: Date.now(),
      });
    }

    await ctx.db.delete(args.id);
  },
});
