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
 * Valida que el albarán esté adjunto y que haya al menos un item con cantidad recibida.
 */
export function validateReceiveInput(
  archivo: File | null,
  items: readonly ReceivedItemPayload[],
): string | null {
  if (!archivo) {
    return "Adjunta el albarán de entrega: sin él no se da la entrada.";
  }
  if (items.length === 0) {
    return "Escribe cuánto ha llegado.";
  }
  return null;
}
