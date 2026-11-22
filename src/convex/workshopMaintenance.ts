import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { ROLES } from "./schema";

/**
 * La reserva de mantenimiento del taller.
 *
 * Restaurar una copia y vaciar el taller no pueden solaparse: la primera vacía e
 * inserta por tandas y la segunda borra las mismas tablas —incluida la foto que
 * permite recuperar una restauración cortada—. Tampoco puede entrar una escritura
 * normal mientras el taller está a medio restaurar: una Incidencia o una Petición
 * de repuesto creada en ese hueco desaparecería al seguir el vaciado o quedaría
 * sobre datos mezclados.
 *
 * La reserva es una fila singleton con caducidad. Se adquiere antes de tocar
 * nada, se renueva con el mismo latido que la foto y se retira al terminar. Si la
 * acción muere, deja de renovarse y caduca: el taller no se queda bloqueado para
 * siempre.
 */

/** Una reserva sin latido durante este tiempo se considera abandonada. */
export const MAINTENANCE_LEASE_MS = 30_000;

const LEASE_KEY = "maintenance" as const;

const BUSY_MESSAGE =
  "Hay una operación de mantenimiento en marcha: una restauración o un vaciado del taller. Espera a que termine.";

const WRITE_BLOCKED_MESSAGE =
  "El taller está en mantenimiento y no admite cambios mientras se restaura una copia o se vacía el taller.";

const LEASE_LOST_MESSAGE =
  "La operación de mantenimiento ha perdido su reserva; se detiene para no pisar otra.";

/** La reserva vigente, si la hay. Las caducadas no cuentan. */
export async function activeMaintenanceLease(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"workshopMaintenance"> | null> {
  const lease = await ctx.db
    .query("workshopMaintenance")
    .withIndex("by_key", (q) => q.eq("key", LEASE_KEY))
    .unique();
  if (!lease) return null;
  return lease.aliveAt > Date.now() - MAINTENANCE_LEASE_MS ? lease : null;
}

/** La puerta de las escrituras del taller: con mantenimiento en marcha, no. */
export async function assertWorkshopWritable(ctx: MutationCtx): Promise<void> {
  if ((await activeMaintenanceLease(ctx)) !== null) {
    throw new ConvexError(WRITE_BLOCKED_MESSAGE);
  }
}

async function assertActiveAdmin(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const user = await ctx.db.get(userId);
  if (
    !user ||
    user.active === false ||
    user.isAnonymous === true ||
    user.role !== ROLES.ADMIN
  ) {
    throw new ConvexError(
      "Solo un administrador activo puede reservar el mantenimiento del taller.",
    );
  }
}

/**
 * Toma la reserva y devuelve su testigo. Falla si otra operación sigue viva; una
 * caducada se reutiliza en la misma fila, así que la tabla nunca acumula
 * reservas. El testigo distingue esta operación de otra del mismo administrador:
 * la foto que se recupera puede ser de un lote anterior, pero la reserva que se
 * renueva es siempre la de la acción en curso.
 */
export const acquireMaintenanceLease = internalMutation({
  args: {
    userId: v.id("users"),
    kind: v.union(v.literal("restore"), v.literal("reset")),
    batch: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    await assertActiveAdmin(ctx, args.userId);
    const now = Date.now();
    const existing = await ctx.db
      .query("workshopMaintenance")
      .withIndex("by_key", (q) => q.eq("key", LEASE_KEY))
      .unique();
    if (existing !== null && existing.aliveAt > now - MAINTENANCE_LEASE_MS) {
      throw new ConvexError(BUSY_MESSAGE);
    }
    const token = `${now}-${Math.random().toString(36).slice(2)}`;
    const values = {
      key: LEASE_KEY,
      kind: args.kind,
      ownerId: args.userId,
      token,
      batch: args.batch,
      acquiredAt: now,
      aliveAt: now,
    };
    if (existing === null) {
      await ctx.db.insert("workshopMaintenance", values);
    } else {
      await ctx.db.patch(existing._id, values);
    }
    return token;
  },
});

/**
 * Renueva la reserva. Si ya no es nuestra —caducó y la tomó otra operación—,
 * falla en vez de seguir sin protección.
 */
export const renewMaintenanceLease = internalMutation({
  args: {
    userId: v.id("users"),
    kind: v.union(v.literal("restore"), v.literal("reset")),
    token: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    await assertActiveAdmin(ctx, args.userId);
    const lease = await ctx.db
      .query("workshopMaintenance")
      .withIndex("by_key", (q) => q.eq("key", LEASE_KEY))
      .unique();
    if (
      lease === null ||
      lease.kind !== args.kind ||
      lease.ownerId !== args.userId ||
      lease.token !== args.token
    ) {
      throw new ConvexError(LEASE_LOST_MESSAGE);
    }
    await ctx.db.patch(lease._id, { aliveAt: Date.now() });
  },
});

/**
 * Suelta la reserva si sigue siendo la nuestra. Es idempotente: si caducó y otra
 * operación la tomó, no se la quita.
 */
export const releaseMaintenanceLease = internalMutation({
  args: {
    userId: v.id("users"),
    kind: v.union(v.literal("restore"), v.literal("reset")),
    token: v.string(),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const lease = await ctx.db
      .query("workshopMaintenance")
      .withIndex("by_key", (q) => q.eq("key", LEASE_KEY))
      .unique();
    if (
      lease === null ||
      lease.kind !== args.kind ||
      lease.ownerId !== args.userId ||
      lease.token !== args.token
    ) {
      return false;
    }
    await ctx.db.delete(lease._id);
    return true;
  },
});
