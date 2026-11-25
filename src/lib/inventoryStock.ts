import { lineRemaining } from "./requestFlow";
import type { RequestStatus } from "./workshop";

export interface ReservableLine {
  sparePartId: string;
  quantity: number;
  deliveredQuantity?: number;
}

export interface ReservableRequest {
  status: RequestStatus;
  heldFrom?: RequestStatus;
  deletedAt?: number;
  lines: readonly ReservableLine[];
}

/**
 * Devuelve las unidades reservadas normalizadas (entero >= 0).
 */
export function reservedUnits(reservedStock?: number | null): number {
  if (typeof reservedStock !== "number" || !Number.isFinite(reservedStock)) {
    return 0;
  }
  return Math.max(0, Math.floor(reservedStock));
}

/**
 * Indica si un repuesto tiene unidades comprometidas pendientes de entrega.
 */
export function hasReservedStock(part: {
  reservedStock?: number | null;
}): boolean {
  return reservedUnits(part.reservedStock) > 0;
}

/**
 * Stock disponible (no comprometido) de un repuesto.
 * En GestMant_TS `spareParts.stock` ya refleja el stock disponible tras aprobar
 * peticiones; esta función garantiza un entero no negativo.
 */
export function availableStock(
  stock: number,
  _reservedStock?: number | null,
): number {
  if (!Number.isFinite(stock)) return 0;
  return Math.max(0, Math.floor(stock));
}

/**
 * Stock físico total en almacén = stock disponible (`stock`) + stock reservado
 * (`reservedStock`) en peticiones aprobadas pendientes de entrega al técnico.
 */
export function physicalStock(
  stock: number,
  reservedStock?: number | null,
): number {
  return availableStock(stock) + reservedUnits(reservedStock);
}

/**
 * Determina si una petición mantiene material reservado en almacén pendiente
 * de entrega física al técnico.
 */
export function isRequestReservingStock(
  status: RequestStatus,
  heldFrom?: RequestStatus,
): boolean {
  return status === "approved" || (status === "onHold" && heldFrom === "approved");
}

/**
 * Calcula las unidades reservadas por `sparePartId` a partir de las peticiones
 * vivas (`deletedAt === undefined`) que tienen material apartado pendiente de
 * entrega física.
 */
export function computeReservedFromRequests(
  requests: Iterable<ReservableRequest>,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const request of requests) {
    if (request.deletedAt !== undefined) continue;
    if (!isRequestReservingStock(request.status, request.heldFrom)) continue;
    const effectiveStatus: RequestStatus =
      request.status === "onHold" && request.heldFrom === "approved"
        ? "approved"
        : request.status;
    for (const line of request.lines) {
      const remaining = lineRemaining(line, effectiveStatus);
      if (remaining <= 0) continue;
      totals.set(
        line.sparePartId,
        (totals.get(line.sparePartId) ?? 0) + remaining,
      );
    }
  }
  return totals;
}

export interface InventoryCountDelta<IdType extends string = string> {
  sparePartId: IdType;
  code: string;
  name: string;
  previousStock: number;
  nextStock: number;
  delta: number;
}

/**
 * Calcula las diferencias entre el stock del catálogo y el recuento físico,
 * omitiendo los artículos sin variación y validando valores no negativos.
 */
export function computeInventoryCountDeltas<
  T extends { _id: string; code: string; name: string; stock: number },
>(
  parts: readonly T[],
  counts: readonly { sparePartId: string; countedStock: number }[],
): InventoryCountDelta<T["_id"]>[] {
  const partById = new Map(parts.map((part) => [part._id, part]));
  const seen = new Set<string>();
  const deltas: InventoryCountDelta<T["_id"]>[] = [];

  for (const entry of counts) {
    if (seen.has(entry.sparePartId)) continue;
    const part = partById.get(entry.sparePartId);
    if (!part) continue;
    if (!Number.isFinite(entry.countedStock) || entry.countedStock < 0) {
      throw new Error(
        `El recuento de ${part.code} (${part.name}) no puede ser negativo.`,
      );
    }
    const nextStock = Math.floor(entry.countedStock);
    seen.add(entry.sparePartId);
    if (nextStock === part.stock) continue;
    deltas.push({
      sparePartId: part._id as T["_id"],
      code: part.code,
      name: part.name,
      previousStock: part.stock,
      nextStock,
      delta: nextStock - part.stock,
    });
  }

  return deltas;
}
