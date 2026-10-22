import { lineRemaining } from "@/lib/requestFlow";
import type { RequestStatus } from "@/lib/workshop";
import type { PartDoc, RequestLine } from "./types";

/**
 * Filtra las líneas de la petición cuyo stock en el inventario sea insuficiente.
 */
export function calculateShortages(
  lines: RequestLine[],
  parts: PartDoc[],
): RequestLine[] {
  const partById = new Map(parts.map((part) => [part._id, part]));
  return lines.filter((line) => {
    const part = partById.get(line.sparePartId);
    return !part || part.stock < line.quantity;
  });
}

/**
 * Genera el estado inicial de entregas con lo que queda pendiente por línea.
 */
export function buildInitialDeliveryQuantities(
  lines: RequestLine[],
  status: RequestStatus,
): Record<string, number> {
  return Object.fromEntries(
    lines.map((line) => [line.sparePartId, lineRemaining(line, status)]),
  );
}

/**
 * Acota una cantidad de entrega para que esté entre 0 y el máximo pendiente.
 */
export function clampDeliveryQuantity(
  rawValue: number,
  remaining: number,
): number {
  const value = Math.floor(rawValue);
  return Number.isFinite(value) ? Math.max(0, Math.min(remaining, value)) : 0;
}

/**
 * Construye la lista de líneas que se van a entregar, excluyendo aquellas en cero.
 */
export function buildIssueBatchLines(
  lines: RequestLine[],
  entrega: Record<string, number>,
): { sparePartId: string; quantity: number }[] {
  return lines
    .map((line) => ({
      sparePartId: line.sparePartId,
      quantity: entrega[line.sparePartId] ?? 0,
    }))
    .filter((line) => line.quantity > 0);
}

/**
 * Suma las unidades de entrega de todas las líneas en esta tanda.
 */
export function calculateTotalDeliveryQuantity(
  lines: RequestLine[],
  entrega: Record<string, number>,
): number {
  return lines.reduce(
    (sum, line) => sum + (entrega[line.sparePartId] ?? 0),
    0,
  );
}

/**
 * Construye el mensaje explicativo para stock insuficiente y peticiones vivas en compras.
 */
export function formatShortagePurchasesHint(
  shortageCount: number,
  livePurchasesCount: number,
): string {
  if (livePurchasesCount > 0) {
    const comprasText =
      livePurchasesCount === 1
        ? "ya hay una petición de compra viva"
        : `ya hay ${livePurchasesCount} peticiones de compra vivas`;
    return `Stock insuficiente en ${shortageCount} líneas, pero ${comprasText} para ellas: entra en el almacén cuando llegue el material.`;
  }
  return `Stock insuficiente en ${shortageCount} líneas. Rechaza la petición o repón el catálogo antes de aprobar.`;
}
