import type { Id } from "@/convex/_generated/dataModel";
import { pendingQuantity, type PurchaseOrderLine } from "@/lib/purchasing";
import type { ReceivedItemPayload } from "./types";

/**
 * Genera el mapa inicial de cantidades pendientes por cada línea de pedido.
 */
export function buildInitialQuantities(
  lines: readonly PurchaseOrderLine[],
): Record<string, string> {
  return Object.fromEntries(
    lines
      .filter((line) => pendingQuantity(line) > 0)
      .map((line) => [line.purchaseRequestId, String(pendingQuantity(line))]),
  );
}

/** Rellena a cero todas las líneas pendientes de una recepción parcial. */
export function buildZeroQuantities(
  lines: readonly PurchaseOrderLine[],
): Record<string, string> {
  return Object.fromEntries(
    lines
      .filter((line) => pendingQuantity(line) > 0)
      .map((line) => [line.purchaseRequestId, "0"]),
  );
}

/**
 * Transforma y filtra las cantidades introducidas a items numéricos válidos (> 0).
 */
export function parseReceivedItems(
  cantidades: Record<string, string>,
): ReceivedItemPayload[] {
  return Object.entries(cantidades)
    .map(([purchaseRequestId, valor]) => ({
      purchaseRequestId: purchaseRequestId as Id<"purchaseRequests">,
      quantity: Number(valor),
    }))
    .filter((item) => Number.isFinite(item.quantity) && item.quantity > 0);
}

/**
 * Valida que haya al menos un item con cantidad recibida (el albarán es opcional).
 */
export function validateReceiveInput(
  _archivo: File | null,
  items: readonly ReceivedItemPayload[],
): string | null {
  if (items.length === 0) {
    return "Escribe cuánto ha llegado.";
  }
  return null;
}
