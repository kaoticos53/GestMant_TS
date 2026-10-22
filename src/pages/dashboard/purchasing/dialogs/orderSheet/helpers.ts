import type { PurchaseOrderStatus } from "@/lib/purchasing";
import { formatDateTime } from "@/lib/workshop";

/**
 * Devuelve el mensaje explicativo para el tramo siguiente de la orden.
 */
export function getOrderSheetNextHint(
  canManage: boolean,
  status: PurchaseOrderStatus,
): string {
  if (!canManage) {
    return "La llevan quienes gestionan las compras.";
  }
  if (status === "completed") {
    return "La orden está completada: entró todo lo que se pidió.";
  }
  if (status === "cancelled") {
    return "La orden está anulada: sus peticiones volvieron a la cola.";
  }
  return "Sin pasos disponibles ahora mismo.";
}

/**
 * Genera el texto descriptivo de la cabecera de la orden.
 */
export function formatOrderHeaderDescription(
  order: { supplier: string; orderedAt: number; orderedBy: string },
  total: { received: number; quantity: number },
): string {
  return `${order.supplier} · pedida el ${formatDateTime(order.orderedAt)} por ${order.orderedBy} · ${total.received}/${total.quantity} ud recibidas`;
}

/**
 * Resumen de líneas recibidas en una entrega para el histórico de recepciones.
 */
export function formatReceptionLinesSummary(
  lines: { code: string; quantity: number }[],
): string {
  return lines.map((line) => `${line.code} × ${line.quantity}`).join(" · ");
}
