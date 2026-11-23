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
  | "reactivation"
  | "loan_out"
  | "loan_return";

export type EquipmentOperationalState =
  | "operational"
  | "in_workshop"
  | "external_repair"
  | "loaned"
  | "decommissioned";

export const EQUIPMENT_OPERATIONAL_META: Record<
  EquipmentOperationalState,
  { label: string; badgeClassName: string }
> = {
  operational: {
    label: "Operativo",
    badgeClassName:
      "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  in_workshop: {
    label: "En taller",
    badgeClassName:
      "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  external_repair: {
    label: "En SAT externo",
    badgeClassName:
      "border-purple-500/25 bg-purple-500/10 text-purple-700 dark:text-purple-300",
  },
  loaned: {
    label: "Prestado",
    badgeClassName: "border-signal/25 bg-signal/10 text-signal",
  },
  decommissioned: {
    label: "De baja",
    badgeClassName: "border-border bg-muted text-muted-foreground",
  },
};

export function resolveOperationalState(item: {
  operationalState?: EquipmentOperationalState;
  decommissionDate?: number;
  currentLoan?: unknown;
}): EquipmentOperationalState {
  if (item.decommissionDate !== undefined) return "decommissioned";
  if (item.currentLoan) return "loaned";
  return item.operationalState ?? "operational";
}

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
  loan_out: { label: "Préstamo temporal" },
  loan_return: { label: "Devolución de préstamo" },
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
