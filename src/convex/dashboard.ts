import { v } from "convex/values";
import {
  buildWorkshopAnalytics,
  type AnalyticsCapabilities,
  type AnalyticsOpenOrderInput,
  type AnalyticsSystemHealth,
  type WorkshopAnalyticsResult,
} from "../lib/analytics";
import { JOB_STATUS, isActiveJobStatus } from "../lib/backgroundJobs";
import { STALE_WORK_CANDIDATE_STATUSES } from "../lib/incidentFlow";
import { isAdminUser } from "../lib/roles";
import {
  DEFAULT_WORK_WITHOUT_TRACE_DAYS,
  stockState,
  workWithoutTraceDays,
} from "../lib/workshop";
import type { Id } from "./_generated/dataModel";
import { internalMutation, query } from "./_generated/server";
import { hasAnyCapability, hasCapability, memberOrNull } from "./permissions";
import {
  getGlobalDashboardStats,
  rebuildDashboardStatsImpl,
} from "./_stats/dashboardStats";
import {
  INCIDENT_STATUSES,
  PRIORITIES,
  PURCHASE_ORDER_STATUSES,
  PURCHASE_REQUEST_STATUSES,
  REQUEST_STATUSES,
  type IncidentStatus,
} from "./schema";

/**
 * Contadores del armazón: lo que el panel necesita saber, contado.
 *
 * El panel pedía al montar la lista entera de repuestos, equipos, manuales,
 * mantenimiento, peticiones e incidencias —y con ella las direcciones de todos
 * sus adjuntos ya resueltas (`incidents.list`, `partRequests.list`, `manuals.list`
 * las piden al vuelo)— solo para contar un puñado de números: las píldoras del
 * menú, las tarjetas del resumen, el aviso de taller vacío y el de trabajo sin
 * constancia. Ahora cada módulo carga lo suyo al abrirse y esto queda para lo que
 * de verdad es del armazón.
 *
 * Lo que devuelve es exactamente lo que devolvían aquellas listas, recortado a
 * lo que el panel mira, y filtrado igual (lo retirado fuera, y fuera también lo
 * archivado, que es el día a día): quien mira ve contado lo mismo que veía. Un
 * invitado o una cuenta de baja recibe ceros, como recibía listas vacías, y cada
 * bloque respeta el mismo permiso que su lista —el catálogo el suyo, los equipos
 * el suyo, los manuales el suyo y las compras el suyo—, así que nadie ve contado
 * lo que no podría ver listado.
 *
 * El aviso de trabajo sin constancia va aquí porque su regla
 * (`workWithoutTraceDays`) se aplica sobre las incidencias vivas, y esas solo se
 * leen en el backend: así el aviso recibe ya decidido quién está parado y cuántos
 * días lleva, y no necesita la lista entera para averiguarlo. `marginDays` lo
 * manda el panel con el margen que tiene ajustado el taller, para que lo que
 * cuenta esta consulta y lo que escribe el aviso sean el mismo número.
 */

/** Una incidencia parada, con lo justo que enseña el aviso del panel. */
interface StaleWorkEntry {
  incident: {
    _id: Id<"incidents">;
    reference: string;
    status: IncidentStatus;
    assigneeName?: string;
  };
  days: number;
}

/** Lo que hay cuando no hay nadie del taller mirando (invitado, cuenta de baja). */
function emptySummary(): {
  incidents: { reported: number };
  requests: {
    active: number;
    pending: number;
    urgent: number;
    withoutReference: number;
    issued: number;
  };
  parts: { total: number; lowStock: number };
  equipment: number;
  manuals: number;
  purchasing: { pending: number };
  staleWork: StaleWorkEntry[];
} {
  return {
    incidents: { reported: 0 },
    requests: {
      active: 0,
      pending: 0,
      urgent: 0,
      withoutReference: 0,
      issued: 0,
    },
    parts: { total: 0, lowStock: 0 },
    equipment: 0,
    manuals: 0,
    purchasing: { pending: 0 },
    staleWork: [],
  };
}

export const summary = query({
  args: {
    /** Margen del aviso de trabajo sin constancia, en días (el del taller). */
    marginDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await memberOrNull(ctx);
    if (me === null) return emptySummary();

    const marginDays = args.marginDays ?? DEFAULT_WORK_WITHOUT_TRACE_DAYS;

    const [
      cachedStats,
      canInventory,
      canEquipment,
      canManuals,
      canPurchasing,
      candidateGroups,
    ] = await Promise.all([
      getGlobalDashboardStats(ctx),
      hasAnyCapability(ctx, me, ["viewInventory", "lookupCatalog"]),
      hasAnyCapability(ctx, me, [
        "viewEquipment",
        "lookupCatalog",
        "lookupEquipment",
      ]),
      hasCapability(ctx, me, "viewManuals"),
      hasAnyCapability(ctx, me, ["viewPurchasing", "managePurchasing"]),
      // Trabajo en curso sin constancia: leemos únicamente las incidencias vivas
      // (activas o legacy sin lifecycle) en estados en curso, evitando escanear
      // incidencias notificadas, cerradas, archivadas o retiradas.
      Promise.all(
        STALE_WORK_CANDIDATE_STATUSES.flatMap((status) => [
          ctx.db
            .query("incidents")
            .withIndex("by_lifecycle_status", (q) =>
              q.eq("lifecycle", "active").eq("status", status),
            )
            .collect(),
          ctx.db
            .query("incidents")
            .withIndex("by_lifecycle_status", (q) =>
              q.eq("lifecycle", undefined).eq("status", status),
            )
            .collect(),
        ]),
      ),
    ]);

    // Trabajo en curso sin constancia, de lo más parado a lo menos.
    const staleWork: StaleWorkEntry[] = candidateGroups
      .flat()
      .filter(
        (row) => row.deletedAt === undefined && row.archivedAt === undefined,
      )
      .flatMap((incident) => {
        const days = workWithoutTraceDays(incident, undefined, marginDays);
        return days === null
          ? []
          : [
              {
                incident: {
                  _id: incident._id,
                  reference: incident.reference,
                  status: incident.status,
                  assigneeName: incident.assigneeName,
                },
                days,
              },
            ];
      })
      .sort((a, b) => b.days - a.days);

    if (cachedStats !== null) {
      return {
        incidents: { reported: cachedStats.incidentsReported },
        requests: {
          active: cachedStats.requestsActive,
          pending: cachedStats.requestsPending,
          urgent: cachedStats.requestsPendingUrgent,
          withoutReference: cachedStats.requestsPendingWithoutReference,
          issued: cachedStats.requestsIssued,
        },
        parts: {
          total: canInventory ? cachedStats.partsTotal : 0,
          lowStock: canInventory ? cachedStats.partsLowStock : 0,
        },
        equipment: canEquipment ? cachedStats.equipmentTotal : 0,
        manuals: canManuals ? cachedStats.manualsTotal : 0,
        purchasing: {
          pending: canPurchasing ? cachedStats.purchasingPending : 0,
        },
        staleWork,
      };
    }

    // Ruta fallback cuando `dashboardStats` aún no existe: consultamos las
    // colas vivas usando índices y capacidades en paralelo.
    const [
      reportedActive,
      reportedLegacy,
      requestsActive,
      requestsLegacy,
      parts,
      equipment,
      manuals,
      purchasing,
    ] = await Promise.all([
      ctx.db
        .query("incidents")
        .withIndex("by_lifecycle_status", (q) =>
          q.eq("lifecycle", "active").eq("status", INCIDENT_STATUSES.REPORTED),
        )
        .collect(),
      ctx.db
        .query("incidents")
        .withIndex("by_lifecycle_status", (q) =>
          q
            .eq("lifecycle", undefined)
            .eq("status", INCIDENT_STATUSES.REPORTED),
        )
        .collect(),
      ctx.db
        .query("partRequests")
        .withIndex("by_lifecycle_createdAt", (q) =>
          q.eq("lifecycle", "active"),
        )
        .collect(),
      ctx.db
        .query("partRequests")
        .withIndex("by_lifecycle_createdAt", (q) =>
          q.eq("lifecycle", undefined),
        )
        .collect(),
      canInventory
        ? ctx.db.query("spareParts").withIndex("by_name").collect()
        : Promise.resolve([]),
      canEquipment
        ? ctx.db.query("equipment").collect()
        : Promise.resolve([]),
      canManuals ? ctx.db.query("manuals").collect() : Promise.resolve([]),
      canPurchasing
        ? ctx.db
            .query("purchaseRequests")
            .withIndex("by_status", (q) =>
              q.eq("status", PURCHASE_REQUEST_STATUSES.PENDING),
            )
            .collect()
        : Promise.resolve([]),
    ]);

    const reported = [...reportedActive, ...reportedLegacy].filter(
      (row) => row.deletedAt === undefined && row.archivedAt === undefined,
    ).length;

    const requests = [...requestsActive, ...requestsLegacy].filter(
      (row) => row.deletedAt === undefined && row.archivedAt === undefined,
    );
    const pending = requests.filter(
      (row) => row.status === REQUEST_STATUSES.PENDING,
    );

    return {
      incidents: { reported },
      requests: {
        active: requests.length,
        pending: pending.length,
        urgent: pending.filter((row) => row.priority === PRIORITIES.URGENT)
          .length,
        // Una petición sin repuesto asociado no se puede aprobar: el panel lo
        // señala en la tarjeta de pendientes.
        withoutReference: pending.filter((row) => row.lines.length === 0)
          .length,
        issued: requests.filter((row) => row.status === REQUEST_STATUSES.ISSUED)
          .length,
      },
      parts: {
        total: parts.length,
        // La misma regla que el filtro «solo stock bajo» del catálogo.
        lowStock: parts.filter(
          (part) => stockState(part.stock, part.minStock) !== "ok",
        ).length,
      },
      equipment: equipment.length,
      manuals: manuals.length,
      purchasing: { pending: purchasing.length },
      staleWork,
    };
  },
});

/** Métricas y series temporales para el dashboard analítico del taller. */
export const analytics = query({
  args: {
    periodDays: v.optional(
      v.union(v.literal(7), v.literal(30), v.literal(90)),
    ),
  },
  handler: async (ctx, args): Promise<WorkshopAnalyticsResult | null> => {
    const member = await memberOrNull(ctx);
    if (!member) return null;

    const [
      canIncidents,
      canManageIncidents,
      canRequests,
      canDecideRequests,
      canParts,
      canEquipment,
      canPurchasing,
    ] = await Promise.all([
      hasAnyCapability(ctx, member, ["viewIncidents", "manageIncidents"]),
      hasCapability(ctx, member, "manageIncidents"),
      hasAnyCapability(ctx, member, ["viewRequests", "decideRequests"]),
      hasCapability(ctx, member, "decideRequests"),
      hasAnyCapability(ctx, member, ["viewInventory", "manageInventory"]),
      hasAnyCapability(ctx, member, [
        "viewEquipment",
        "manageEquipment",
        "lookupEquipment",
      ]),
      hasAnyCapability(ctx, member, ["viewPurchasing", "managePurchasing"]),
    ]);
    const adminOk = isAdminUser(member);

    const now = Date.now();
    const auditCutoff = now - (args.periodDays ?? 30) * 24 * 60 * 60 * 1000;
    const failedJobCutoff = now - 7 * 24 * 60 * 60 * 1000;

    const [
      rawIncidents,
      rawRequests,
      rawParts,
      rawEquipment,
      rawMovements,
      rawPendingPurchases,
      rawOrderedPurchases,
      rawOrderedOrders,
      rawPartialOrders,
      rawUsers,
      rawCleanupRuns,
      rawTrashFiles,
      rawJobs,
      rawAuditEvents,
    ] = await Promise.all([
      canIncidents
        ? ctx.db.query("incidents").collect()
        : Promise.resolve([]),
      canRequests
        ? ctx.db.query("partRequests").collect()
        : Promise.resolve([]),
      canParts ? ctx.db.query("spareParts").collect() : Promise.resolve([]),
      canEquipment ? ctx.db.query("equipment").collect() : Promise.resolve([]),
      canParts
        ? ctx.db
            .query("stockMovements")
            .withIndex("by_createdAt")
            .order("desc")
            .take(500)
        : Promise.resolve([]),
      canPurchasing
        ? ctx.db
            .query("purchaseRequests")
            .withIndex("by_status", (q) =>
              q.eq("status", PURCHASE_REQUEST_STATUSES.PENDING),
            )
            .collect()
        : Promise.resolve([]),
      canPurchasing || canParts
        ? ctx.db
            .query("purchaseRequests")
            .withIndex("by_status", (q) =>
              q.eq("status", PURCHASE_REQUEST_STATUSES.ORDERED),
            )
            .collect()
        : Promise.resolve([]),
      canPurchasing
        ? ctx.db
            .query("purchaseOrders")
            .withIndex("by_status", (q) =>
              q.eq("status", PURCHASE_ORDER_STATUSES.PENDING),
            )
            .collect()
        : Promise.resolve([]),
      canPurchasing
        ? ctx.db
            .query("purchaseOrders")
            .withIndex("by_status", (q) =>
              q.eq("status", PURCHASE_ORDER_STATUSES.PARTIAL),
            )
            .collect()
        : Promise.resolve([]),
      adminOk ? ctx.db.query("users").collect() : Promise.resolve([]),
      adminOk
        ? ctx.db.query("storageCleanupRuns").collect()
        : Promise.resolve([]),
      adminOk ? ctx.db.query("trashFiles").collect() : Promise.resolve([]),
      adminOk
        ? ctx.db.query("backgroundJobs").order("desc").take(200)
        : Promise.resolve([]),
      adminOk
        ? ctx.db
            .query("securityAuditLog")
            .withIndex("by_at", (q) => q.gte("at", auditCutoff))
            .collect()
        : Promise.resolve([]),
    ]);

    const capabilities: AnalyticsCapabilities = {
      incidents: canIncidents,
      manageIncidents: canManageIncidents,
      requests: canRequests,
      decideRequests: canDecideRequests,
      inventory: canParts,
      equipment: canEquipment,
      purchasing: canPurchasing,
      admin: adminOk,
    };

    const openPurchaseOrders: AnalyticsOpenOrderInput[] = [
      ...rawOrderedOrders,
      ...rawPartialOrders,
    ].map((order) => {
      let totalUnits = 0;
      let pendingUnits = 0;
      for (const line of order.lines) {
        totalUnits += line.quantity;
        pendingUnits += Math.max(0, line.quantity - line.receivedQuantity);
      }
      return {
        id: order._id,
        reference: order.reference,
        supplier: order.supplier,
        status: order.status,
        orderedAt: order.orderedAt,
        pendingUnits,
        totalUnits,
      };
    });

    let systemHealth: AnalyticsSystemHealth | null = null;
    if (adminOk) {
      let activeUsers = 0;
      let inactiveUsers = 0;
      for (const u of rawUsers) {
        if (u.isAnonymous === true) continue;
        if (u.active === false) inactiveUsers += 1;
        else activeUsers += 1;
      }

      let failedJobs = 0;
      let activeJobs = 0;
      for (const job of rawJobs) {
        if (isActiveJobStatus(job.status)) activeJobs += 1;
        else if (
          job.status === JOB_STATUS.FAILED &&
          job.createdAt >= failedJobCutoff
        ) {
          failedJobs += 1;
        }
      }

      let unreadableFiles = 0;
      let lastCleanupAt: number | null = null;
      for (const run of rawCleanupRuns) {
        unreadableFiles += run.unreadable ?? 0;
        if (lastCleanupAt === null || run.ranAt > lastCleanupAt) {
          lastCleanupAt = run.ranAt;
        }
      }

      systemHealth = {
        activeUsers,
        inactiveUsers,
        failedJobs,
        activeJobs,
        trashFilesCount: rawTrashFiles.length,
        unreadableFiles,
        lastCleanupAt,
        recentAuditEvents: rawAuditEvents.length,
      };
    }

    return buildWorkshopAnalytics({
      now,
      periodDays: args.periodDays,
      currentUserId: member._id,
      capabilities,
      incidents: rawIncidents
        .filter((i) => i.deletedAt === undefined && i.archivedAt === undefined)
        .map((i) => ({
          id: i._id,
          reference: i.reference,
          status: i.status,
          priority: i.priority,
          reportedAt: i.reportedAt,
          closedAt: i.closedAt,
          model: i.model,
          equipmentKind: i.equipmentKind,
          assigneeId: i.assigneeId,
          assigneeName: i.assigneeName,
          workshopAssigneeId: i.workshopAssigneeId,
          workshopAssigneeName: i.workshopAssigneeName,
          history: i.history,
          lifecycleNotes: i.lifecycleNotes,
          externalRepair: i.externalRepair
            ? {
                companyName: i.externalRepair.companyName,
                expectedReturnAt: i.externalRepair.expectedReturnAt,
                receivedAt: i.externalRepair.receivedAt,
                quoteStatus: i.externalRepair.quoteStatus,
              }
            : undefined,
        })),
      requests: rawRequests
        .filter((r) => r.deletedAt === undefined && r.archivedAt === undefined)
        .map((r) => ({
          id: r._id,
          reference: r.reference,
          status: r.status,
          priority: r.priority,
          requesterId: r.requesterId,
          requesterName: r.requesterName,
          equipment: r.equipment,
          createdAt: r.createdAt,
          linesCount: r.lines.length,
        })),
      parts: rawParts.map((p) => ({
        code: p.code,
        name: p.name,
        category: p.category,
        stock: p.stock,
        minStock: p.minStock,
        unit: p.unit,
      })),
      equipment: rawEquipment.map((e) => ({
        code: e.code,
        name: e.name,
        model: e.model,
        decommissionDate: e.decommissionDate,
      })),
      stockMovements: rawMovements.map((m) => ({
        kind: m.kind,
        delta: m.delta,
        createdAt: m.createdAt,
      })),
      pendingPurchaseRequests: rawPendingPurchases.length,
      orderedPartCodes: rawOrderedPurchases.map((p) => p.code),
      openPurchaseOrders,
      systemHealth,
    });
  },
});

/** Reconstruye los contadores globales precalculados del panel resumen. */
export const rebuildStats = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await rebuildDashboardStatsImpl(ctx);
  },
});
