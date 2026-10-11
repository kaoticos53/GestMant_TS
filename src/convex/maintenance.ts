import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { QueryCtx, mutation, query } from "./_generated/server";
import { hasCapability } from "./permissions";
import { richDocToStore } from "../lib/richDoc";

/** El historial requiere sesión iniciada (lo pueden consultar los técnicos). */
async function requireUser(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError(
      "Debes iniciar sesión para consultar el historial de mantenimiento.",
    );
  }
  return userId;
}

/** Escrituras: capacidad «manageEquipment» (fail-closed, admin siempre). */
async function requireManager(ctx: QueryCtx) {
  const userId = await requireUser(ctx);
  const user = await ctx.db.get(userId);
  if (!user || !(await hasCapability(ctx, user, "manageEquipment"))) {
    throw new ConvexError(
      "No tienes permisos para registrar intervenciones. Revisa la configuración de tu rol con el administrador.",
    );
  }
  return userId;
}

/** Historial completo, de la intervención más reciente a la más antigua. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const records = await ctx.db.query("maintenanceRecords").collect();
    return records.sort((a, b) => b.performedAt - a.performedAt);
  },
});

const recordArgs = {
  equipmentId: v.id("equipment"),
  kind: v.union(v.literal("repair"), v.literal("preventive")),
  title: v.string(),
  description: v.optional(v.string()),
  performedAt: v.number(),
  technician: v.optional(v.string()),
  requestId: v.optional(v.id("partRequests")),
};

async function validateRecord(
  ctx: QueryCtx,
  args: {
    equipmentId: Id<"equipment">;
    title: string;
    performedAt: number;
  },
) {
  if (!args.title.trim()) {
    throw new ConvexError("El resumen de la intervención es obligatorio.");
  }
  // Un día de margen para no tropezar con las franjas horarias
  if (args.performedAt > Date.now() + 24 * 60 * 60 * 1000) {
    throw new ConvexError("La fecha de la intervención no puede ser futura.");
  }
  const equipment = await ctx.db.get(args.equipmentId);
  if (!equipment) throw new ConvexError("El equipo ya no existe.");
}

export const create = mutation({
  args: recordArgs,
  handler: async (ctx, args) => {
    await requireManager(ctx);
    await validateRecord(ctx, args);

    const now = Date.now();
    // La descripción es la nota de la intervención y se escribe con formato: se
    // guarda su documento tal cual (y sin restos cuando se queda vacía). Una
    // nota de antes, en texto plano, se guarda igual que estaba.
    const description = richDocToStore(args.description);
    await ctx.db.insert("maintenanceRecords", {
      equipmentId: args.equipmentId,
      kind: args.kind,
      title: args.title.trim(),
      ...(description ? { description } : {}),
      performedAt: args.performedAt,
      ...(args.technician?.trim() ? { technician: args.technician.trim() } : {}),
      ...(args.requestId ? { requestId: args.requestId } : {}),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("maintenanceRecords"),
    ...recordArgs,
  },
  handler: async (ctx, args) => {
    await requireManager(ctx);
    const record = await ctx.db.get(args.id);
    if (!record) throw new ConvexError("La intervención ya no existe.");
    await validateRecord(ctx, args);

    await ctx.db.patch(args.id, {
      equipmentId: args.equipmentId,
      kind: args.kind,
      title: args.title.trim(),
      // `undefined` en patch elimina el campo: así se vacían los opcionales, y
      // una nota con formato se guarda tal cual la entrega el editor.
      description: richDocToStore(args.description),
      performedAt: args.performedAt,
      technician: args.technician?.trim() || undefined,
      requestId: args.requestId,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("maintenanceRecords") },
  handler: async (ctx, args) => {
    await requireManager(ctx);
    const record = await ctx.db.get(args.id);
    if (!record) throw new ConvexError("La intervención ya no existe.");
    await ctx.db.delete(args.id);
  },
});
