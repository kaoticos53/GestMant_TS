import { stockState } from "../../lib/workshop";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  INCIDENT_STATUSES,
  PRIORITIES,
  PURCHASE_ORDER_STATUSES,
  PURCHASE_REQUEST_STATUSES,
  REQUEST_STATUSES,
} from "../schema";

export type DashboardStatDelta = Partial<{
  incidentsReported: number;
  requestsActive: number;
  requestsPending: number;
  requestsPendingUrgent: number;
  requestsPendingWithoutReference: number;
  requestsIssued: number;
  partsTotal: number;
  partsLowStock: number;
  partsOutOfStock: number;
  equipmentTotal: number;
  manualsTotal: number;
  purchasingPending: number;
  openPurchaseOrders: number;
}>;

/**
 * Lee el documento único de estadísticas globales si ya fue inicializado.
 */
export async function getGlobalDashboardStats(
  ctx: QueryCtx,
): Promise<Doc<"dashboardStats"> | null> {
  return await ctx.db
    .query("dashboardStats")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .first();
}

/**
 * Aplica deltas incrementales O(1) sobre `dashboardStats` cuando el documento
 * ya existe en la base de datos.
 */
export async function adjustDashboardStats(
  ctx: MutationCtx,
  delta: DashboardStatDelta,
): Promise<void> {
  const existing = await getGlobalDashboardStats(ctx);
  if (!existing) return;

  const patch: Partial<Doc<"dashboardStats">> = { updatedAt: Date.now() };
  let changed = false;
  for (const [k, rawDelta] of Object.entries(delta)) {
    if (typeof rawDelta !== "number" || rawDelta === 0) continue;
    const key = k as keyof DashboardStatDelta;
    const next = Math.max(0, existing[key] + Math.trunc(rawDelta));
    if (next !== existing[key]) {
      patch[key] = next;
      changed = true;
    }
  }
  if (changed) {
    await ctx.db.patch(existing._id, patch);
  }
}

/**
 * Recalcula todos los contadores globales desde las tablas fuente y actualiza
 * (o crea) el documento único `key: "global"` en `dashboardStats`.
 */
export async function rebuildDashboardStatsImpl(
  ctx: MutationCtx,
): Promise<Omit<Doc<"dashboardStats">, "_id" | "_creationTime">> {
  const [
    incidents,
    requests,
    parts,
    equipment,
    manuals,
    pendingPurchasing,
    purchaseOrders,
  ] = await Promise.all([
    ctx.db.query("incidents").withIndex("by_createdAt").collect(),
    ctx.db.query("partRequests").withIndex("by_createdAt").collect(),
    ctx.db.query("spareParts").withIndex("by_name").collect(),
    ctx.db.query("equipment").collect(),
    ctx.db.query("manuals").collect(),
    ctx.db
      .query("purchaseRequests")
      .withIndex("by_status", (q) =>
        q.eq("status", PURCHASE_REQUEST_STATUSES.PENDING),
      )
      .collect(),
    ctx.db.query("purchaseOrders").collect(),
  ]);

  const liveIncidents = incidents.filter(
    (row) => row.deletedAt === undefined && row.archivedAt === undefined,
  );
  const liveRequests = requests.filter(
    (row) => row.deletedAt === undefined && row.archivedAt === undefined,
  );
  const pendingRequests = liveRequests.filter(
    (row) => row.status === REQUEST_STATUSES.PENDING,
  );

  let partsLowStock = 0;
  let partsOutOfStock = 0;
  for (const part of parts) {
    const state = stockState(part.stock, part.minStock);
    if (state !== "ok") partsLowStock += 1;
    if (state === "out") partsOutOfStock += 1;
  }

  const openPurchaseOrders = purchaseOrders.filter(
    (order) =>
      order.status === PURCHASE_ORDER_STATUSES.PENDING ||
      order.status === PURCHASE_ORDER_STATUSES.PARTIAL,
  ).length;

  const next = {
    key: "global" as const,
    incidentsReported: liveIncidents.filter(
      (row) => row.status === INCIDENT_STATUSES.REPORTED,
    ).length,
    requestsActive: liveRequests.length,
    requestsPending: pendingRequests.length,
    requestsPendingUrgent: pendingRequests.filter(
      (row) => row.priority === PRIORITIES.URGENT,
    ).length,
    requestsPendingWithoutReference: pendingRequests.filter(
      (row) => row.lines.length === 0,
    ).length,
    requestsIssued: liveRequests.filter(
      (row) => row.status === REQUEST_STATUSES.ISSUED,
    ).length,
    partsTotal: parts.length,
    partsLowStock,
    partsOutOfStock,
    equipmentTotal: equipment.length,
    manualsTotal: manuals.length,
    purchasingPending: pendingPurchasing.length,
    openPurchaseOrders,
    updatedAt: Date.now(),
  };

  const existing = await getGlobalDashboardStats(ctx);
  if (existing) {
    await ctx.db.patch(existing._id, next);
  } else {
    await ctx.db.insert("dashboardStats", next);
  }
  return next;
}

/**
 * Si `dashboardStats` está activo en la base de datos, lo sincroniza tras
 * mutaciones complejas (transiciones, archivo, papelera, recepciones).
 */
export async function syncDashboardStatsIfPresent(
  ctx: MutationCtx,
): Promise<void> {
  const existing = await getGlobalDashboardStats(ctx);
  if (existing) {
    await rebuildDashboardStatsImpl(ctx);
  }
}
