import { equipmentLabel } from "@/lib/workshop";
import type { EquipmentDoc } from "./types";

/** Cuántas referencias se enseñan en el resumen antes de decir «y N más». */
export const PREVIEW_LIMIT = 6;

/**
 * Da formato a la vista previa de referencias limitando la cantidad visible.
 */
export function buildReferencePreview(
  references: string[],
  limit: number = PREVIEW_LIMIT,
): string {
  if (references.length === 0) return "";
  const head = references.slice(0, limit).join(" · ");
  return references.length > limit
    ? `${head} y ${references.length - limit} más`
    : head;
}

/**
 * Formatea el conteo total de incidencias junto a su desglose por estado.
 */
export function buildReportsCountLabel(
  count: number,
  breakdown: string[],
): string {
  const countText = count === 1 ? "1 incidencia" : `${count} incidencias`;
  return breakdown.length > 0 ? `${countText} · ${breakdown.join(" · ")}` : countText;
}

/**
 * Agrupa los rastros de documentos por el identificador de cada incidencia.
 */
export function groupTrailsByIncident<T extends { incidentId?: string }>(
  trails: T[] | undefined,
  incidentIds: string[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  if (trails !== undefined) {
    for (const incidentId of incidentIds) {
      map.set(
        incidentId,
        trails.filter((entry) => entry.incidentId === incidentId),
      );
    }
  }
  return map;
}

/**
 * Agrupa las peticiones de repuesto por la incidencia a la que están asociadas.
 */
export function groupRequestsByIncident<T extends { incidentId?: string }>(
  requests: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const req of requests) {
    if (req.incidentId) {
      const list = map.get(req.incidentId) ?? [];
      list.push(req);
      map.set(req.incidentId, list);
    }
  }
  return map;
}

/**
 * Obtiene la etiqueta del equipo vinculado a una incidencia si existe en el inventario.
 */
export function getLinkedEquipmentName(
  incident: { equipmentId?: string },
  equipmentList: EquipmentDoc[],
): string | undefined {
  const linked = incident.equipmentId
    ? equipmentList.find((item) => item._id === incident.equipmentId)
    : undefined;
  return linked ? equipmentLabel(linked) : undefined;
}
