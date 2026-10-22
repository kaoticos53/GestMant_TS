import {
  lineDelivered,
  lineRemaining,
  requestDelivery,
  requestMaterialState,
  type RequestMaterialState,
} from "@/lib/requestFlow";
import { richDocToPlainText } from "@/lib/richDoc";
import { STATUS_META as REQUEST_STATUS_META } from "@/lib/workshop";
import type { RequestDoc, RequestLine } from "./types";

export const MATERIAL_STATE_LABEL: Record<RequestMaterialState, string> = {
  pending: "sin entregar",
  partial: "entrega parcial",
  delivered: "entregado",
  returned: "devuelto",
  dropped: "no se sirvió",
};

/**
 * Etiqueta para una línea que no ha registrado entregas aún,
 * distinguiendo si la petición global está en entrega parcial/total o en otro estado.
 */
export function untouchedLineLabel(material: RequestMaterialState): string {
  return material === "partial" || material === "delivered"
    ? MATERIAL_STATE_LABEL.pending
    : MATERIAL_STATE_LABEL[material];
}

/**
 * Resuelve todos los metadatos calculados de entrega, archivo y descripción de una petición.
 */
export function resolveRequestDeliveryMeta(request: RequestDoc) {
  const statusMeta = REQUEST_STATUS_META[request.status];
  const archived = request.archivedAt !== undefined;
  const delivery = requestDelivery(request.lines, request.status);
  const material = requestMaterialState(request.status, delivery);
  const deliveredAt =
    material === "delivered"
      ? request.issuedAt
      : material === "returned"
        ? request.returnedAt
        : undefined;
  const described = richDocToPlainText(request.description);

  return {
    statusMeta,
    archived,
    delivery,
    material,
    deliveredAt,
    described,
  };
}

/**
 * Calcula las cantidades entregadas y pendientes de una línea de repuesto específica.
 */
export function getLineProgress(line: RequestLine, status: RequestDoc["status"]) {
  return {
    delivered: lineDelivered(line, status),
    remaining: lineRemaining(line, status),
  };
}
