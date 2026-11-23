import {
  computeReservedFromRequests,
  reservedUnits,
} from "../../lib/inventoryStock";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { REQUEST_STATUSES } from "../schema";

/**
 * Ajusta de forma atómica `spareParts.reservedStock` sumando `delta` (positivo
 * al aprobar una petición, negativo al entregar material o cancelar una reserva).
 */
export async function adjustReservedStock(
  ctx: MutationCtx,
  sparePartId: Id<"spareParts">,
  delta: number,
  now: number,
): Promise<void> {
  if (delta === 0) return;
  const part = await ctx.db.get(sparePartId);
  if (!part) return;
  const current = reservedUnits(part.reservedStock);
  const next = Math.max(0, current + Math.trunc(delta));
  if (next === current && part.reservedStock !== undefined) return;
  await ctx.db.patch(sparePartId, {
    reservedStock: next,
    updatedAt: now,
  });
}

/**
 * Recalcula de forma idempotente `reservedStock` en todo el catálogo a partir de
 * las peticiones activas aprobadas (o suspendidas desde aprobada) con unidades
 * pendientes de entrega.
 */
export async function reconcileReservedStockImpl(
  ctx: MutationCtx,
): Promise<{ updatedParts: number }> {
  const [approved, onHold] = await Promise.all([
    ctx.db
      .query("partRequests")
      .withIndex("by_status", (q) => q.eq("status", REQUEST_STATUSES.APPROVED))
      .collect(),
    ctx.db
      .query("partRequests")
      .withIndex("by_status", (q) => q.eq("status", REQUEST_STATUSES.ON_HOLD))
      .collect(),
  ]);

  const expectedByPart = computeReservedFromRequests([...approved, ...onHold]);
  const allParts = await ctx.db.query("spareParts").collect();
  const now = Date.now();
  let updatedParts = 0;

  for (const part of allParts) {
    const expected = expectedByPart.get(part._id) ?? 0;
    const current = reservedUnits(part.reservedStock);
    if (current !== expected) {
      await ctx.db.patch(part._id, {
        reservedStock: expected,
        updatedAt: now,
      });
      updatedParts += 1;
    }
  }

  return { updatedParts };
}
