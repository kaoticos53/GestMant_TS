import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { QueryCtx, MutationCtx, mutation, query } from "./_generated/server";
import { identityNotice, secureMutation } from "./_auth/secureMutation";
import { hasAnyCapability, memberOrNull } from "./permissions";
import { richDocToStore } from "../lib/richDoc";
import {
  findMatchingEquipmentForIncident,
  requestMatchesEquipment,
} from "../lib/workshop";
import { detectEquipmentChanges } from "../lib/movements";
import { recordEquipmentMovement } from "./_inventory/movements";
import { syncEquipmentOperationalState } from "./_inventory/equipmentState";
import { resolveCatalogId } from "./_catalogs/resolve";
import { adjustDashboardStats } from "./_stats/dashboardStats";
import { markDestinationDeleted } from "./_mailShares/orphans";

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
    // pasan por `secureMutation`, que exige identidad y «manageEquipment».
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
  modelId: v.optional(v.id("equipmentModels")),
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

/**
 * Genera el siguiente código de inventario libre y único para un equipo («EQ-001», «EQ-002»...).
 * Inspecciona los equipos existentes, calcula el correlativo más alto y busca el primer código libre.
 */
export async function generateFreeEquipmentCode(
  ctx: QueryCtx,
): Promise<string> {
  const all = await ctx.db.query("equipment").collect();
  let highest = 0;
  for (const item of all) {
    if (!item.code) continue;
    const match = /^EQ-(\d+)$/i.exec(item.code.trim());
    if (match) {
      const num = parseInt(match[1], 10);
      if (Number.isFinite(num) && num > highest) {
        highest = num;
      }
    }
  }

  let candidateNum = highest + 1;
  while (true) {
    const candidateCode = `EQ-${String(candidateNum).padStart(3, "0")}`;
    const clashInList = all.some(
      (eq) => eq.code?.trim().toUpperCase() === candidateCode.toUpperCase(),
    );
    if (!clashInList) {
      const existing = await ctx.db
        .query("equipment")
        .withIndex("by_code", (q) => q.eq("code", candidateCode))
        .first();
      if (!existing) {
        return candidateCode;
      }
    }
    candidateNum++;
  }
}

/**
 * Consulta el próximo código libre y correlativo sugerido para un nuevo equipo.
 */
export const nextCode = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await generateFreeEquipmentCode(ctx);
  },
});

async function linkMatchingIncidents(
  ctx: MutationCtx,
  equipmentId: Id<"equipment">,
) {
  const allEquipment = await ctx.db.query("equipment").collect();
  const unlinked = await ctx.db
    .query("incidents")
    .filter((q) => q.eq(q.field("equipmentId"), undefined))
    .collect();
  for (const inc of unlinked) {
    if (inc.deletedAt !== undefined) continue;
    const matched = findMatchingEquipmentForIncident(inc, allEquipment);
    if (matched?._id === equipmentId) {
      await ctx.db.patch(inc._id, { equipmentId });
    }
  }
}

export const create = mutation({
  args: equipmentArgs,
  handler: secureMutation(
    {
      capability: "manageEquipment",
      identityMessage: identityNotice(
        "Debes iniciar sesión con una cuenta registrada para gestionar los equipos.",
      ),
      denyMessage:
        "No tienes permisos para gestionar los equipos. Revisa la configuración de tu rol con el administrador.",
    },
    equipmentArgs,
    async (ctx, args, actor) => {
      let code = args.code?.trim().toUpperCase() || "";
      if (!code) {
        code = await generateFreeEquipmentCode(ctx);
      }
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

      // Resolver modelId si no vino explícito, asegurando su existencia en equipmentModels
      let modelId = args.modelId;
      if (!modelId) {
        const found = await ctx.db
          .query("equipmentModels")
          .withIndex("by_model", (q) => q.eq("model", args.model.trim()))
          .first();
        if (found) {
          modelId = found._id;
        } else {
          modelId = await ctx.db.insert("equipmentModels", {
            model: args.model.trim(),
            name: args.name.trim(),
            ...(args.brand?.trim() ? { brand: args.brand.trim() } : {}),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
      }

      const now = Date.now();
      // La descripción es la nota del equipo y se escribe con formato: se guarda
      // su documento tal cual (y sin restos cuando se queda vacía). Una nota de
      // antes, escrita en texto plano, se guarda igual que estaba.
      const description = richDocToStore(args.description);
      const supplierName = args.supplier?.trim() || undefined;
      const supplierId = await resolveCatalogId(ctx, "supplier", supplierName);
      const id = await ctx.db.insert("equipment", {
        code,
        ...(modelId ? { modelId } : {}),
        ...(args.brand?.trim() ? { brand: args.brand.trim() } : {}),
        name: args.name.trim(),
        model: args.model.trim(),
        ...(args.location?.trim() ? { location: args.location.trim() } : {}),
        ...(description ? { description } : {}),
        ...(args.serialNumber?.trim()
          ? { serialNumber: args.serialNumber.trim() }
          : {}),
        ...(supplierName ? { supplier: supplierName } : {}),
        ...(supplierId ? { supplierId } : {}),
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
        operationalState:
          args.decommissionDate !== undefined
            ? "decommissioned"
            : "operational",
        createdAt: now,
        updatedAt: now,
      });
      await recordEquipmentMovement(ctx, {
        equipmentId: id,
        equipmentCode: code,
        equipmentName: args.name.trim(),
        kind: "created",
        ...(args.location?.trim() ? { toLocation: args.location.trim() } : {}),
        actorId: actor._id,
        actorName: actor.name?.trim() || actor.email?.trim() || "Técnico",
        createdAt: now,
      });
      await linkMatchingIncidents(ctx, id);
      await adjustDashboardStats(ctx, { equipmentTotal: 1 });
      return id;
    },
  ),
});

export const update = mutation({
  args: {
    id: v.id("equipment"),
    ...equipmentArgs,
  },
  handler: secureMutation(
    {
      capability: "manageEquipment",
      identityMessage: identityNotice(
        "Debes iniciar sesión con una cuenta registrada para gestionar los equipos.",
      ),
      denyMessage:
        "No tienes permisos para gestionar los equipos. Revisa la configuración de tu rol con el administrador.",
    },
    { ...equipmentArgs, id: v.id("equipment") },
    async (ctx, args, actor) => {
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

      let modelId = args.modelId ?? item.modelId;
      if (!modelId) {
        const found = await ctx.db
          .query("equipmentModels")
          .withIndex("by_model", (q) => q.eq("model", args.model.trim()))
          .first();
        if (found) {
          modelId = found._id;
        } else {
          modelId = await ctx.db.insert("equipmentModels", {
            model: args.model.trim(),
            name: args.name.trim(),
            ...(args.brand?.trim() ? { brand: args.brand.trim() } : {}),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
      }

      const now = Date.now();
      const nextLocation = args.location?.trim() || undefined;
      const supplierName = args.supplier?.trim() || undefined;
      const supplierId = await resolveCatalogId(ctx, "supplier", supplierName);
      await ctx.db.patch(args.id, {
        code,
        modelId: modelId || undefined,
        brand: args.brand?.trim() || undefined,
        name: args.name.trim(),
        model: args.model.trim(),
        location: nextLocation,
        // `undefined` aquí borra la nota: una descripción vacía deja el equipo
        // sin ella, y el documento del editor se guarda tal cual llega.
        description: richDocToStore(args.description),
        serialNumber: args.serialNumber?.trim() || undefined,
        supplier: supplierName,
        supplierId,
        // `undefined` en patch elimina el campo: así se borran fechas vacías
        purchaseDate: args.purchaseDate,
        decommissionDate: args.decommissionDate,
        warrantyEndDate: args.warrantyEndDate,
        maintenanceIntervalDays: args.maintenanceIntervalDays,
        updatedAt: now,
      });

      const changes = detectEquipmentChanges(
        { location: item.location, decommissionDate: item.decommissionDate },
        { location: nextLocation, decommissionDate: args.decommissionDate },
      );
      const actorName = actor.name?.trim() || actor.email?.trim() || "Técnico";
      for (const change of changes) {
        await recordEquipmentMovement(ctx, {
          equipmentId: args.id,
          equipmentCode: code,
          equipmentName: args.name.trim(),
          kind: change.kind,
          ...(change.kind === "location_change"
            ? {
                fromLocation: change.fromLocation,
                toLocation: change.toLocation,
              }
            : {}),
          actorId: actor._id,
          actorName,
          createdAt: now,
        });
      }
      await linkMatchingIncidents(ctx, args.id);
      await syncEquipmentOperationalState(ctx, args.id, now);
    },
  ),
});

const loanOutArgs = {
  id: v.id("equipment"),
  borrowerName: v.string(),
  location: v.optional(v.string()),
  expectedReturnAt: v.optional(v.number()),
  notes: v.optional(v.string()),
};

/** Registra un préstamo temporal de equipo y deja traza en `equipmentMovements`. */
export const loanOut = mutation({
  args: loanOutArgs,
  handler: secureMutation(
    {
      capability: "manageEquipment",
      identityMessage: identityNotice(
        "Debes iniciar sesión con una cuenta registrada para gestionar los equipos.",
      ),
      denyMessage:
        "No tienes permisos para gestionar los equipos. Revisa la configuración de tu rol con el administrador.",
    },
    loanOutArgs,
    async (ctx, args, actor) => {
      const item = await ctx.db.get(args.id);
      if (!item) throw new ConvexError("El equipo ya no existe.");
      if (item.decommissionDate !== undefined) {
        throw new ConvexError(
          "No se puede prestar un equipo que está dado de baja.",
        );
      }
      if (item.currentLoan) {
        throw new ConvexError(
          `El equipo ya está prestado a ${item.currentLoan.borrowerName}. Registra primero su devolución.`,
        );
      }
      const borrowerName = args.borrowerName.trim();
      if (!borrowerName) {
        throw new ConvexError("Indica la persona o departamento receptor.");
      }

      const now = Date.now();
      const loanLocation = args.location?.trim() || undefined;
      const notes = args.notes?.trim() || undefined;
      const currentLoan = {
        borrowerName,
        ...(loanLocation ? { location: loanLocation } : {}),
        loanedAt: now,
        ...(args.expectedReturnAt !== undefined
          ? { expectedReturnAt: args.expectedReturnAt }
          : {}),
        ...(notes ? { notes } : {}),
      };

      await ctx.db.patch(args.id, {
        currentLoan,
        operationalState: "loaned",
        updatedAt: now,
      });

      await recordEquipmentMovement(ctx, {
        equipmentId: args.id,
        equipmentCode: item.code,
        equipmentName: item.name,
        kind: "loan_out",
        ...(item.location ? { fromLocation: item.location } : {}),
        ...(loanLocation ? { toLocation: loanLocation } : {}),
        borrowerName,
        ...(args.expectedReturnAt !== undefined
          ? { expectedReturnAt: args.expectedReturnAt }
          : {}),
        ...(notes ? { note: notes } : {}),
        actorId: actor._id,
        actorName: actor.name?.trim() || actor.email?.trim() || "Técnico",
        createdAt: now,
      });
    },
  ),
});

const returnLoanArgs = {
  id: v.id("equipment"),
  notes: v.optional(v.string()),
};

/** Registra la devolución de un equipo prestado temporalmente. */
export const returnLoan = mutation({
  args: returnLoanArgs,
  handler: secureMutation(
    {
      capability: "manageEquipment",
      identityMessage: identityNotice(
        "Debes iniciar sesión con una cuenta registrada para gestionar los equipos.",
      ),
      denyMessage:
        "No tienes permisos para gestionar los equipos. Revisa la configuración de tu rol con el administrador.",
    },
    returnLoanArgs,
    async (ctx, args, actor) => {
      const item = await ctx.db.get(args.id);
      if (!item) throw new ConvexError("El equipo ya no existe.");
      if (!item.currentLoan) {
        throw new ConvexError("Este equipo no tiene ningún préstamo activo.");
      }

      const now = Date.now();
      const previousLoan = item.currentLoan;
      const notes = args.notes?.trim() || undefined;

      await ctx.db.patch(args.id, {
        currentLoan: undefined,
        updatedAt: now,
      });

      await recordEquipmentMovement(ctx, {
        equipmentId: args.id,
        equipmentCode: item.code,
        equipmentName: item.name,
        kind: "loan_return",
        ...(previousLoan.location
          ? { fromLocation: previousLoan.location }
          : {}),
        ...(item.location ? { toLocation: item.location } : {}),
        borrowerName: previousLoan.borrowerName,
        ...(notes ? { note: notes } : {}),
        actorId: actor._id,
        actorName: actor.name?.trim() || actor.email?.trim() || "Técnico",
        createdAt: now,
      });

      await syncEquipmentOperationalState(ctx, args.id, now);
    },
  ),
});

/**
 * Borrado de equipo físico: la compatibilidad de los repuestos pertenece al
 * modelo técnico (equipmentModels) y no se altera al retirar ejemplares físicos
 * del inventario. Las peticiones y manuales que lo mencionen se desvinculan.
 */
export const remove = mutation({
  args: { id: v.id("equipment") },
  handler: secureMutation(
    {
      capability: "manageEquipment",
      identityMessage: identityNotice(
        "Debes iniciar sesión con una cuenta registrada para gestionar los equipos.",
      ),
      denyMessage:
        "No tienes permisos para gestionar los equipos. Revisa la configuración de tu rol con el administrador.",
    },
    { id: v.id("equipment") },
    async (ctx, args) => {
      const item = await ctx.db.get(args.id);
      if (!item) throw new ConvexError("El equipo ya no existe.");

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
      await adjustDashboardStats(ctx, { equipmentTotal: -1 });
      // La copia del correo no se purga en el acto: queda huérfana siete días
      // en la papelera administrativa, porque su ficha ya no existe.
      await markDestinationDeleted(ctx, "equipment", args.id, Date.now());
    },
  ),
});

/**
 * Devuelve las peticiones y repuestos compatibles de un equipo concreto
 * sin obligar al cliente a cruzar colecciones completas en memoria.
 */
export const relatedSummary = query({
  args: { equipmentId: v.id("equipment") },
  handler: async (ctx, args) => {
    const me = await memberOrNull(ctx);
    if (
      !me ||
      !(await hasAnyCapability(ctx, me, [
        "viewEquipment",
        "manageEquipment",
        "lookupEquipment",
        "lookupCatalog",
      ]))
    ) {
      return null;
    }

    const item = await ctx.db.get(args.equipmentId);
    if (!item) return null;

    let resolvedModelId = item.modelId;
    if (!resolvedModelId) {
      const normalizedModel = item.model.trim().toLowerCase();
      const models = await ctx.db.query("equipmentModels").collect();
      resolvedModelId = models.find(
        (m) => m.model.trim().toLowerCase() === normalizedModel,
      )?._id;
    }

    const allParts = await ctx.db.query("spareParts").collect();
    const compatible = resolvedModelId
      ? allParts.filter((part) =>
          part.compatibleModels?.includes(resolvedModelId!),
        )
      : [];

    const allRequests = await ctx.db
      .query("partRequests")
      .order("desc")
      .collect();
    const requests = allRequests.filter(
      (req) => req.deletedAt === undefined && requestMatchesEquipment(req, item),
    );

    return { compatible, requests };
  },
});
