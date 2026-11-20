/**
 * Dominio puro de trazabilidad: movimientos de stock de repuestos y
 * desplazamientos / ciclo de vida de equipos.
 */

export type StockMovementKind =
  | "initial"
  | "manual_adjust"
  | "request_reserve"
  | "request_return"
  | "purchase_reception";

export type EquipmentMovementKind =
  | "created"
  | "location_change"
  | "decommission"
  | "reactivation";

export const STOCK_MOVEMENT_META: Record<
  StockMovementKind,
  { label: string; signTone: "in" | "out" | "neutral" }
> = {
  initial: { label: "Alta inicial", signTone: "in" },
  manual_adjust: { label: "Ajuste manual", signTone: "neutral" },
  request_reserve: { label: "Reserva en petición", signTone: "out" },
  request_return: { label: "Devolución de petición", signTone: "in" },
  purchase_reception: { label: "Recepción de compra", signTone: "in" },
};

export const EQUIPMENT_MOVEMENT_META: Record<
  EquipmentMovementKind,
  { label: string }
> = {
  created: { label: "Alta en inventario" },
  location_change: { label: "Traslado" },
  decommission: { label: "Baja" },
  reactivation: { label: "Reactivación" },
};

export interface StockDelta {
  previousStock: number;
  delta: number;
  nextStock: number;
}

/**
 * Calcula la variación neta de stock. Devuelve `null` si no hubo cambio real.
 */
export function computeStockDelta(
  previousStock: number,
  nextStock: number,
): StockDelta | null {
  const delta = nextStock - previousStock;
  if (delta === 0) return null;
  return { previousStock, delta, nextStock };
}

export type DetectedEquipmentChange =
  | {
      kind: "location_change";
      fromLocation?: string;
      toLocation?: string;
    }
  | {
      kind: "decommission" | "reactivation";
    };

function normalizeLocation(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Detecta desplazamientos de ubicación y transiciones de baja/reactivación
 * comparando el estado anterior y posterior de un equipo.
 */
export function detectEquipmentChanges(
  before: { location?: string; decommissionDate?: number },
  after: { location?: string; decommissionDate?: number },
): DetectedEquipmentChange[] {
  const changes: DetectedEquipmentChange[] = [];

  const prevLoc = normalizeLocation(before.location);
  const nextLoc = normalizeLocation(after.location);
  if (prevLoc !== nextLoc) {
    changes.push({
      kind: "location_change",
      ...(prevLoc !== undefined ? { fromLocation: prevLoc } : {}),
      ...(nextLoc !== undefined ? { toLocation: nextLoc } : {}),
    });
  }

  const wasDecommissioned = before.decommissionDate !== undefined;
  const isDecommissioned = after.decommissionDate !== undefined;
  if (!wasDecommissioned && isDecommissioned) {
    changes.push({ kind: "decommission" });
  } else if (wasDecommissioned && !isDecommissioned) {
    changes.push({ kind: "reactivation" });
  }

  return changes;
}
