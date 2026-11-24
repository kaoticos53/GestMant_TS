import { isClosedIncident } from "./incidentFlow";
import { STOCK_MOVEMENT_META, type StockMovementKind } from "./movements";
import { isRequestInMotion } from "./requestFlow";
import { INCIDENT_STATUS_META, type IncidentStatus } from "./workshop";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export interface AnalyticsIncidentInput {
  status: string;
  reportedAt: number;
  closedAt?: number;
  model?: string;
  equipmentKind?: string;
}

export interface AnalyticsRequestInput {
  status: string;
  priority: string;
}

export interface AnalyticsPartInput {
  code: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  unit: string;
}

export interface AnalyticsEquipmentInput {
  code?: string;
  name: string;
  model: string;
  decommissionDate?: number;
}

export interface AnalyticsMovementInput {
  kind: StockMovementKind;
  delta: number;
  createdAt: number;
}

export interface WorkshopAnalyticsResult {
  kpis: {
    activeIncidents: number;
    totalIncidents: number;
    resolvedLast30d: number;
    resolutionRatePct: number;
    avgResolutionHours: number | null;
    activeRequests: number;
    urgentRequests: number;
    totalParts: number;
    lowStockParts: number;
    outOfStockParts: number;
    totalEquipment: number;
    decommissionedEquipment: number;
    pendingPurchases: number;
  };
  incidentsByStatus: Array<{
    status: IncidentStatus;
    label: string;
    count: number;
  }>;
  weeklyTrend: Array<{
    weekLabel: string;
    reported: number;
    resolved: number;
  }>;
  partsByCategory: Array<{
    category: string;
    total: number;
    normal: number;
    lowStock: number;
  }>;
  stockMovementsSummary: Array<{
    kind: StockMovementKind;
    label: string;
    entries: number;
    units: number;
  }>;
  topProblematicEquipment: Array<{
    label: string;
    count: number;
    openCount: number;
  }>;
  criticalParts: Array<{
    code: string;
    name: string;
    stock: number;
    minStock: number;
    unit: string;
  }>;
}

function formatShortDay(ts: number): string {
  const d = new Date(ts);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

export function buildWorkshopAnalytics(input: {
  now: number;
  incidents: readonly AnalyticsIncidentInput[];
  requests: readonly AnalyticsRequestInput[];
  parts: readonly AnalyticsPartInput[];
  equipment: readonly AnalyticsEquipmentInput[];
  stockMovements: readonly AnalyticsMovementInput[];
  pendingPurchaseRequests: number;
}): WorkshopAnalyticsResult {
  const { now, incidents, requests, parts, equipment, stockMovements } = input;
  const cutoff30d = now - 30 * DAY_MS;

  let activeIncidents = 0;
  let resolvedTotal = 0;
  let resolvedLast30d = 0;
  let durationHoursSum = 0;
  let durationCount = 0;

  const statusCounts = new Map<IncidentStatus, number>();
  for (const key of Object.keys(INCIDENT_STATUS_META) as IncidentStatus[]) {
    statusCounts.set(key, 0);
  }

  const equipmentFailures = new Map<string, { count: number; openCount: number }>();

  for (const inc of incidents) {
    const isClosed = isClosedIncident(inc.status);
    if (!isClosed) {
      activeIncidents += 1;
    } else {
      resolvedTotal += 1;
    }

    if (inc.status in INCIDENT_STATUS_META) {
      const st = inc.status as IncidentStatus;
      statusCounts.set(st, (statusCounts.get(st) ?? 0) + 1);
    }

    if (inc.closedAt !== undefined && inc.closedAt >= cutoff30d) {
      resolvedLast30d += 1;
    }
    if (inc.closedAt !== undefined && inc.closedAt >= inc.reportedAt) {
      durationHoursSum += (inc.closedAt - inc.reportedAt) / (60 * 60 * 1000);
      durationCount += 1;
    }

    const eqLabel = (inc.model || inc.equipmentKind || "").trim();
    if (eqLabel) {
      const prev = equipmentFailures.get(eqLabel) ?? { count: 0, openCount: 0 };
      prev.count += 1;
      if (!isClosed) prev.openCount += 1;
      equipmentFailures.set(eqLabel, prev);
    }
  }

  const resolutionRatePct =
    incidents.length > 0
      ? Math.round((resolvedTotal / incidents.length) * 100)
      : 0;
  const avgResolutionHours =
    durationCount > 0 ? Math.round(durationHoursSum / durationCount) : null;

  const incidentsByStatus = (
    Object.keys(INCIDENT_STATUS_META) as IncidentStatus[]
  ).map((status) => ({
    status,
    label: INCIDENT_STATUS_META[status].label,
    count: statusCounts.get(status) ?? 0,
  }));

  // Tendencia semanal en una sola pasada O(n) (últimas 8 semanas, de más antigua a actual)
  const windowStart = now - 8 * WEEK_MS;
  const reportedBuckets = new Array<number>(8).fill(0);
  const resolvedBuckets = new Array<number>(8).fill(0);

  for (const inc of incidents) {
    if (inc.reportedAt >= windowStart && inc.reportedAt < now) {
      const idx = Math.floor((inc.reportedAt - windowStart) / WEEK_MS);
      if (idx >= 0 && idx < 8) reportedBuckets[idx] += 1;
    }
    if (
      inc.closedAt !== undefined &&
      inc.closedAt >= windowStart &&
      inc.closedAt < now
    ) {
      const idx = Math.floor((inc.closedAt - windowStart) / WEEK_MS);
      if (idx >= 0 && idx < 8) resolvedBuckets[idx] += 1;
    }
  }

  const weeklyTrend: WorkshopAnalyticsResult["weeklyTrend"] = [];
  for (let i = 0; i < 8; i += 1) {
    const end = now - (7 - i) * WEEK_MS;
    weeklyTrend.push({
      weekLabel: formatShortDay(end),
      reported: reportedBuckets[i]!,
      resolved: resolvedBuckets[i]!,
    });
  }

  // Peticiones activas / urgentes
  let activeRequests = 0;
  let urgentRequests = 0;
  for (const req of requests) {
    if (isRequestInMotion(req.status)) {
      activeRequests += 1;
      if (req.priority === "urgent") urgentRequests += 1;
    }
  }

  // Repuestos por categoría y críticos
  let lowStockParts = 0;
  let outOfStockParts = 0;
  const catMap = new Map<string, { total: number; lowStock: number }>();
  const lowList: WorkshopAnalyticsResult["criticalParts"] = [];

  for (const p of parts) {
    const isLow = p.stock <= p.minStock;
    if (isLow) {
      lowStockParts += 1;
      lowList.push({
        code: p.code,
        name: p.name,
        stock: p.stock,
        minStock: p.minStock,
        unit: p.unit,
      });
    }
    if (p.stock === 0) outOfStockParts += 1;

    const cat = p.category || "Otros";
    const prev = catMap.get(cat) ?? { total: 0, lowStock: 0 };
    prev.total += 1;
    if (isLow) prev.lowStock += 1;
    catMap.set(cat, prev);
  }

  const partsByCategory = Array.from(catMap.entries())
    .map(([category, vals]) => ({
      category,
      total: vals.total,
      normal: vals.total - vals.lowStock,
      lowStock: vals.lowStock,
    }))
    .sort((a, b) => b.total - a.total);

  const criticalParts = lowList
    .sort((a, b) => a.stock - a.minStock - (b.stock - b.minStock))
    .slice(0, 6);

  // Movimientos de stock (últimos 30 días)
  const movMap = new Map<StockMovementKind, { entries: number; units: number }>();
  for (const kind of Object.keys(STOCK_MOVEMENT_META) as StockMovementKind[]) {
    movMap.set(kind, { entries: 0, units: 0 });
  }
  for (const mov of stockMovements) {
    if (mov.createdAt < cutoff30d) continue;
    const prev = movMap.get(mov.kind) ?? { entries: 0, units: 0 };
    prev.entries += 1;
    prev.units += Math.abs(mov.delta);
    movMap.set(mov.kind, prev);
  }
  const stockMovementsSummary = (
    Object.keys(STOCK_MOVEMENT_META) as StockMovementKind[]
  ).map((kind) => ({
    kind,
    label: STOCK_MOVEMENT_META[kind].label,
    entries: movMap.get(kind)?.entries ?? 0,
    units: movMap.get(kind)?.units ?? 0,
  }));

  const topProblematicEquipment = Array.from(equipmentFailures.entries())
    .map(([label, vals]) => ({ label, ...vals }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const decommissionedEquipment = equipment.filter(
    (e) => e.decommissionDate !== undefined,
  ).length;

  return {
    kpis: {
      activeIncidents,
      totalIncidents: incidents.length,
      resolvedLast30d,
      resolutionRatePct,
      avgResolutionHours,
      activeRequests,
      urgentRequests,
      totalParts: parts.length,
      lowStockParts,
      outOfStockParts,
      totalEquipment: equipment.length,
      decommissionedEquipment,
      pendingPurchases: input.pendingPurchaseRequests,
    },
    incidentsByStatus,
    weeklyTrend,
    partsByCategory,
    stockMovementsSummary,
    topProblematicEquipment,
    criticalParts,
  };
}
