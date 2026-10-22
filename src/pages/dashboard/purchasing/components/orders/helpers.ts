import type { PurchaseOrderDoc } from "@/lib/purchasing";
import { formatDate } from "@/lib/workshop";

/**
 * Genera el subtítulo descriptivo de una orden de compra con proveedor, fecha, número de artículos y unidades.
 */
export function formatOrderSubtitle(
  order: PurchaseOrderDoc,
  received: number,
  quantity: number
): string {
  const lineCount = order.lines.length;
  const articlesLabel = `${lineCount} artículo${lineCount === 1 ? "" : "s"}`;
  return `${order.supplier} · ${formatDate(order.orderedAt)} · ${articlesLabel} · ${received}/${quantity} ud recibidas`;
}

/**
 * Concatena y formatea las referencias a las peticiones que originaron la orden.
 */
export function formatOrderRequestRefs(
  requestRefs: PurchaseOrderDoc["requestRefs"]
): string {
  if (requestRefs.length === 0) return "";
  return requestRefs
    .map((ref) => `${ref.reference} (${formatDate(ref.requestedAt)})`)
    .join(" · ");
}

/**
 * Construye el mensaje explicativo para el toast tras anular una orden de compra.
 */
export function formatCancelSuccessDescription(returned: number): string {
  if (returned > 0) {
    return `${returned} ${returned === 1 ? "petición de compra vuelve" : "peticiones de compra vuelven"} a la cola.`;
  }
  return "No había nada por devolver: lo recibido se queda.";
}
