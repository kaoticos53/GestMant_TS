import { isClosedIncident } from "./incidentFlow";
import { STOCK_MOVEMENT_META, type StockMovementKind } from "./movements";
import { isRequestInMotion } from "./requestFlow";
import {
  DEFAULT_WORK_WITHOUT_TRACE_DAYS,
  INCIDENT_PRIORITY_META,
  INCIDENT_STATUS_META,
  STATUS_META,
  incidentPriorityRank,
  normalizeIncidentPriority,
  workWithoutTraceDays,
  type IncidentPriority,
  type IncidentStatus,
  type RequestStatus,
} from "./workshop";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export type AnalyticsPeriodDays = 7 | 30 | 90;

export type AnalyticsLensId =
  | "my_day"
  | "workshop"
  | "inventory_purchasing"
  | "system";

export interface AnalyticsCapabilities {
  incidents: boolean;
  manageIncidents: boolean;
  requests: boolean;
  decideRequests: boolean;
  inventory: boolean;
  equipment: boolean;
  purchasing: boolean;
  admin: boolean;
}

export const DEFAULT_ANALYTICS_CAPABILITIES: AnalyticsCapabilities = {
  incidents: true,
  manageIncidents: true,
  requests: true,
  decideRequests: true,
  inventory: true,
  equipment: true,
  purchasing: true,
  admin: false,
};

export interface AnalyticsExternalRepairInput {
  companyName: string;
  expectedReturnAt?: number;
  receivedAt?: number;
  quoteStatus?: string;
}

export interface AnalyticsIncidentInput {
  id?: string;
  reference?: string;
  status: string;
  priority?: string;
  reportedAt: number;
  closedAt?: number;
  model?: string;
  equipmentKind?: string;
  assigneeId?: string;
  assigneeName?: string;
  workshopAssigneeId?: string;
  workshopAssigneeName?: string;
  history?: ReadonlyArray<{ status: IncidentStatus; at: number }>;
  lifecycleNotes?: ReadonlyArray<{ authorId?: string; deletedAt?: number }>;
  externalRepair?: AnalyticsExternalRepairInput;
}

export interface AnalyticsRequestInput {
  id?: string;
  reference?: string;
  status: string;
  priority: string;
  requesterId?: string;
  requesterName?: string;
  equipment?: string;
  createdAt?: number;
  linesCount?: number;
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

export interface AnalyticsOpenOrderInput {
  id: string;
  reference: string;
  supplier: string;
  status: string;
  orderedAt: number;
  pendingUnits: number;
  totalUnits: number;
}

export interface AnalyticsSystemHealth {
  activeUsers: number;
  inactiveUsers: number;
  failedJobs: number;
  activeJobs: number;
  trashFilesCount: number;
  unreadableFiles: number;
  lastCleanupAt: number | null;
  recentAuditEvents: number;
}

export interface WorkshopAnalyticsResult {
  capabilities: AnalyticsCapabilities;
  trendGranularity: "day" | "week";
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
  myDay: {
    assignedOpenCount: number;
    assignedUrgentOrHighCount: number;
    unassignedReportedCount: number;
    myRequestsReadyCount: number;
    myRequestsWaitingCount: number;
    myStaleCount: number;
    myPriorityIncidents: Array<{
      id: string;
      reference: string;
      label: string;
      status: string;
      statusLabel: string;
      priority: IncidentPriority;
      priorityLabel: string;
      reportedAt: number;
    }>;
    myReadyRequests: Array<{
      id: string;
      reference: string;
      status: string;
      statusLabel: string;
      equipment?: string;
      createdAt: number;
    }>;
  };
  incidentsByStatus: Array<{
    status: IncidentStatus;
    label: string;
    count: number;
  }>;
  incidentsByPriority: Array<{
    priority: IncidentPriority;
    label: string;
    count: number;
  }>;
  workloadByTechnician: Array<{
    name: string;
    count: number;
    urgentCount: number;
    unassigned: boolean;
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
    onOrder: boolean;
  }>;
  staleWork: Array<{
    id: string;
    reference: string;
    status: string;
    statusLabel: string;
    assigneeName?: string;
    days: number;
    isMine: boolean;
  }>;
  externalRepairs: Array<{
    id: string;
    reference: string;
    equipmentLabel: string;
    companyName: string;
    expectedReturnAt?: number;
    overdue: boolean;
    quoteStatus?: string;
  }>;
  purchasingSummary: {
    pendingRequestsToDecide: number;
    requestsWithoutReference: number;
    materialReceivedPendingDelivery: number;
    openOrdersCount: number;
    openOrders: Array<{
      id: string;
      reference: string;
      supplier: string;
      status: string;
      orderedAt: number;
      ageDays: number;
      pendingUnits: number;
      totalUnits: number;
    }>;
  };
  systemHealth: AnalyticsSystemHealth | null;
}

/** Lentes disponibles para un conjunto de capacidades del usuario. */
export function getAvailableAnalyticsLenses(
  caps: AnalyticsCapabilities,
): AnalyticsLensId[] {
  const lenses: AnalyticsLensId[] = [];
  if (caps.incidents || caps.requests) lenses.push("my_day");
  if (caps.incidents || caps.equipment) lenses.push("workshop");
  if (caps.inventory || caps.purchasing || caps.decideRequests) {
    lenses.push("inventory_purchasing");
  }
  if (caps.admin) lenses.push("system");
  return lenses;
}

/** Lente inicial recomendada según el perfil efectivo de capacidades. */
export function getDefaultAnalyticsLens(
  caps: AnalyticsCapabilities,
): AnalyticsLensId {
  const available = getAvailableAnalyticsLenses(caps);
  if (
    !caps.manageIncidents &&
    !caps.inventory &&
    !caps.purchasing &&
    available.includes("my_day")
  ) {
    return "my_day";
  }
  if (!caps.incidents && available.includes("inventory_purchasing")) {
    return "inventory_purchasing";
  }
  if (available.includes("workshop")) {
    return "workshop";
  }
  return available[0] ?? "my_day";
}

function formatShortDay(ts: number): string {
  const d = new Date(ts);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function incidentStatusLabel(status: string): string {
  if (status in INCIDENT_STATUS_META) {
    return INCIDENT_STATUS_META[status as IncidentStatus].label;
  }
  return status;
}

function requestStatusLabel(status: string): string {
  if (status in STATUS_META) {
    return STATUS_META[status as RequestStatus].label;
  }
  return status;
}

function isOwnedIncident(
  inc: AnalyticsIncidentInput,
  currentUserId?: string,
): boolean {
  if (!currentUserId) return false;
  return (
    inc.assigneeId === currentUserId ||
    inc.workshopAssigneeId === currentUserId
  );
}

function resolveTrendConfig(periodDays?: AnalyticsPeriodDays): {
  granularity: "day" | "week";
  bucketCount: number;
  bucketMs: number;
} {
  if (periodDays === 7) {
    return { granularity: "day", bucketCount: 7, bucketMs: DAY_MS };
  }
  if (periodDays === 30) {
    return { granularity: "week", bucketCount: 5, bucketMs: WEEK_MS };
  }
  if (periodDays === 90) {
    return { granularity: "week", bucketCount: 12, bucketMs: WEEK_MS };
  }
  return { granularity: "week", bucketCount: 8, bucketMs: WEEK_MS };
}

export function buildWorkshopAnalytics(input: {
  now: number;
  periodDays?: AnalyticsPeriodDays;
  incidents: readonly AnalyticsIncidentInput[];
  requests: readonly AnalyticsRequestInput[];
  parts: readonly AnalyticsPartInput[];
  equipment: readonly AnalyticsEquipmentInput[];
  stockMovements: readonly AnalyticsMovementInput[];
  pendingPurchaseRequests: number;
  currentUserId?: string;
  staleMarginDays?: number;
  capabilities?: AnalyticsCapabilities;
  orderedPartCodes?: readonly string[];
  openPurchaseOrders?: readonly AnalyticsOpenOrderInput[];
  systemHealth?: AnalyticsSystemHealth | null;
}): WorkshopAnalyticsResult {
  const {
    now,
    periodDays,
    requests,
    parts,
    equipment,
    stockMovements,
    currentUserId,
  } = input;
  const capabilities = input.capabilities ?? DEFAULT_ANALYTICS_CAPABILITIES;
  const staleMarginDays =
    input.staleMarginDays ?? DEFAULT_WORK_WITHOUT_TRACE_DAYS;
  const periodCutoff =
    periodDays !== undefined ? now - periodDays * DAY_MS : null;
  const cutoff30d = periodCutoff ?? now - 30 * DAY_MS;

  // El backlog vivo nunca se recorta por periodo; solo las incidencias cerradas
  // antiguas salen del filtro de periodo.
  const scopedIncidents =
    periodCutoff !== null
      ? input.incidents.filter(
          (inc) =>
            !isClosedIncident(inc.status) ||
            (inc.closedAt ?? inc.reportedAt) >= periodCutoff,
        )
      : input.incidents;

  let activeIncidents = 0;
  let resolvedTotal = 0;
  let resolvedLast30d = 0;
  let durationHoursSum = 0;
  let durationCount = 0;

  const statusCounts = new Map<IncidentStatus, number>();
  for (const key of Object.keys(INCIDENT_STATUS_META) as IncidentStatus[]) {
    statusCounts.set(key, 0);
  }

  const priorityCounts = new Map<IncidentPriority, number>([
    ["urgent", 0],
    ["high", 0],
    ["medium", 0],
    ["low", 0],
  ]);

  const techWorkload = new Map<
    string,
    { name: string; count: number; urgentCount: number; unassigned: boolean }
  >();
  const equipmentFailures = new Map<
    string,
    { count: number; openCount: number }
  >();

  let assignedOpenCount = 0;
  let assignedUrgentOrHighCount = 0;
  let unassignedReportedCount = 0;
  let myStaleCount = 0;

  const myOpenIncidents: WorkshopAnalyticsResult["myDay"]["myPriorityIncidents"] =
    [];
  const allStaleWork: WorkshopAnalyticsResult["staleWork"] = [];
  const allExternalRepairs: WorkshopAnalyticsResult["externalRepairs"] = [];

  for (const inc of scopedIncidents) {
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
      const prev = equipmentFailures.get(eqLabel) ?? {
        count: 0,
        openCount: 0,
      };
      prev.count += 1;
      if (!isClosed) prev.openCount += 1;
      equipmentFailures.set(eqLabel, prev);
    }

    if (!isClosed) {
      const priority = normalizeIncidentPriority(inc.priority);
      priorityCounts.set(priority, (priorityCounts.get(priority) ?? 0) + 1);

      const workerName = (
        inc.workshopAssigneeName ||
        inc.assigneeName ||
        ""
      ).trim();
      const unassigned = workerName === "";
      const key = unassigned ? "__unassigned__" : workerName;
      const prevTech = techWorkload.get(key) ?? {
        name: unassigned ? "Sin asignar" : workerName,
        count: 0,
        urgentCount: 0,
        unassigned,
      };
      prevTech.count += 1;
      if (priority === "urgent" || priority === "high") {
        prevTech.urgentCount += 1;
      }
      techWorkload.set(key, prevTech);

      if (inc.status === "reported" && !inc.assigneeId) {
        unassignedReportedCount += 1;
      }

      const mine = isOwnedIncident(inc, currentUserId);
      if (mine) {
        assignedOpenCount += 1;
        if (priority === "urgent" || priority === "high") {
          assignedUrgentOrHighCount += 1;
        }
        if (inc.id) {
          myOpenIncidents.push({
            id: inc.id,
            reference: inc.reference ?? "INC",
            label: eqLabel || "Incidencia sin equipo",
            status: inc.status,
            statusLabel: incidentStatusLabel(inc.status),
            priority,
            priorityLabel: INCIDENT_PRIORITY_META[priority].label,
            reportedAt: inc.reportedAt,
          });
        }
      }

      if (inc.id && inc.history && inc.status in INCIDENT_STATUS_META) {
        const staleDays = workWithoutTraceDays(
          {
            status: inc.status as IncidentStatus,
            history: [...inc.history],
            assigneeId: inc.assigneeId,
            workshopAssigneeId: inc.workshopAssigneeId,
            lifecycleNotes: inc.lifecycleNotes ? [...inc.lifecycleNotes] : [],
          },
          now,
          staleMarginDays,
        );
        if (staleDays !== null) {
          if (mine) myStaleCount += 1;
          allStaleWork.push({
            id: inc.id,
            reference: inc.reference ?? "INC",
            status: inc.status,
            statusLabel: incidentStatusLabel(inc.status),
            assigneeName: workerName || undefined,
            days: staleDays,
            isMine: mine,
          });
        }
      }

      if (inc.id && inc.externalRepair && inc.externalRepair.receivedAt === undefined) {
        const expected = inc.externalRepair.expectedReturnAt;
        allExternalRepairs.push({
          id: inc.id,
          reference: inc.reference ?? "INC",
          equipmentLabel: eqLabel || "Equipo",
          companyName: inc.externalRepair.companyName,
          expectedReturnAt: expected,
          overdue: expected !== undefined && expected < now,
          quoteStatus: inc.externalRepair.quoteStatus,
        });
      }
    }
  }

  const resolutionRatePct =
    scopedIncidents.length > 0
      ? Math.round((resolvedTotal / scopedIncidents.length) * 100)
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

  const incidentsByPriority = (
    ["urgent", "high", "medium", "low"] as const
  ).map((priority) => ({
    priority,
    label: INCIDENT_PRIORITY_META[priority].label,
    count: priorityCounts.get(priority) ?? 0,
  }));

  const workloadByTechnician = Array.from(techWorkload.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const trendConfig = resolveTrendConfig(periodDays);
  const windowStart = now - trendConfig.bucketCount * trendConfig.bucketMs;
  const reportedBuckets = new Array<number>(trendConfig.bucketCount).fill(0);
  const resolvedBuckets = new Array<number>(trendConfig.bucketCount).fill(0);

  for (const inc of scopedIncidents) {
    if (inc.reportedAt >= windowStart && inc.reportedAt < now) {
      const idx = Math.floor(
        (inc.reportedAt - windowStart) / trendConfig.bucketMs,
      );
      if (idx >= 0 && idx < trendConfig.bucketCount) {
        reportedBuckets[idx] += 1;
      }
    }
    if (
      inc.closedAt !== undefined &&
      inc.closedAt >= windowStart &&
      inc.closedAt < now
    ) {
      const idx = Math.floor(
        (inc.closedAt - windowStart) / trendConfig.bucketMs,
      );
      if (idx >= 0 && idx < trendConfig.bucketCount) {
        resolvedBuckets[idx] += 1;
      }
    }
  }

  const weeklyTrend: WorkshopAnalyticsResult["weeklyTrend"] = [];
  for (let i = 0; i < trendConfig.bucketCount; i += 1) {
    const end = now - (trendConfig.bucketCount - 1 - i) * trendConfig.bucketMs;
    weeklyTrend.push({
      weekLabel: formatShortDay(end),
      reported: reportedBuckets[i]!,
      resolved: resolvedBuckets[i]!,
    });
  }

  // Peticiones activas / urgentes / cola de almacén y peticiones del técnico
  let activeRequests = 0;
  let urgentRequests = 0;
  let pendingRequestsToDecide = 0;
  let requestsWithoutReference = 0;
  let materialReceivedPendingDelivery = 0;
  let myRequestsReadyCount = 0;
  let myRequestsWaitingCount = 0;
  const myReadyRequests: WorkshopAnalyticsResult["myDay"]["myReadyRequests"] =
    [];

  for (const req of requests) {
    if (isRequestInMotion(req.status)) {
      activeRequests += 1;
      if (req.priority === "urgent") urgentRequests += 1;
    }
    if (req.status === "pending") {
      pendingRequestsToDecide += 1;
      if ((req.linesCount ?? 1) === 0) {
        requestsWithoutReference += 1;
      }
    }
    if (req.status === "materialReceived") {
      materialReceivedPendingDelivery += 1;
    }

    if (currentUserId && req.requesterId === currentUserId) {
      if (req.status === "materialReceived" || req.status === "approved") {
        myRequestsReadyCount += 1;
        if (req.id) {
          myReadyRequests.push({
            id: req.id,
            reference: req.reference ?? "PET",
            status: req.status,
            statusLabel: requestStatusLabel(req.status),
            equipment: req.equipment,
            createdAt: req.createdAt ?? 0,
          });
        }
      } else if (isRequestInMotion(req.status)) {
        myRequestsWaitingCount += 1;
      }
    }
  }

  myOpenIncidents.sort((a, b) => {
    const rankDiff =
      incidentPriorityRank(b.priority) - incidentPriorityRank(a.priority);
    if (rankDiff !== 0) return rankDiff;
    return a.reportedAt - b.reportedAt;
  });

  myReadyRequests.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "materialReceived" ? -1 : 1;
    }
    return a.createdAt - b.createdAt;
  });

  // Repuestos por categoría y críticos
  const orderedCodes = new Set(input.orderedPartCodes ?? []);
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
        onOrder: orderedCodes.has(p.code),
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

  // Movimientos de stock
  const movMap = new Map<
    StockMovementKind,
    { entries: number; units: number }
  >();
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

  const staleWork = allStaleWork.sort((a, b) => b.days - a.days).slice(0, 8);
  const externalRepairs = allExternalRepairs
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return (
        (a.expectedReturnAt ?? Number.MAX_SAFE_INTEGER) -
        (b.expectedReturnAt ?? Number.MAX_SAFE_INTEGER)
      );
    })
    .slice(0, 6);

  const rawOpenOrders = input.openPurchaseOrders ?? [];
  const openOrders = [...rawOpenOrders]
    .sort((a, b) => a.orderedAt - b.orderedAt)
    .slice(0, 6)
    .map((order) => ({
      ...order,
      ageDays: Math.max(0, Math.floor((now - order.orderedAt) / DAY_MS)),
    }));

  return {
    capabilities,
    trendGranularity: trendConfig.granularity,
    kpis: {
      activeIncidents,
      totalIncidents: scopedIncidents.length,
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
    myDay: {
      assignedOpenCount,
      assignedUrgentOrHighCount,
      unassignedReportedCount,
      myRequestsReadyCount,
      myRequestsWaitingCount,
      myStaleCount,
      myPriorityIncidents: myOpenIncidents.slice(0, 6),
      myReadyRequests: myReadyRequests.slice(0, 6),
    },
    incidentsByStatus,
    incidentsByPriority,
    workloadByTechnician,
    weeklyTrend,
    partsByCategory,
    stockMovementsSummary,
    topProblematicEquipment,
    criticalParts,
    staleWork,
    externalRepairs,
    purchasingSummary: {
      pendingRequestsToDecide,
      requestsWithoutReference,
      materialReceivedPendingDelivery,
      openOrdersCount: rawOpenOrders.length,
      openOrders,
    },
    systemHealth: input.systemHealth ?? null,
  };
}
