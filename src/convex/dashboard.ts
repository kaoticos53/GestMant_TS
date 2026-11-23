import { v } from "convex/values";
import {
  buildWorkshopAnalytics,
  type WorkshopAnalyticsResult,
} from "../lib/analytics";
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

    // --- Incidencias: la cola viva, que es lo que mira el panel -------------
    // Lo retirado no está en ninguna cara de la cola (vive en la papelera) y lo
    // archivado es del apunte histórico: ni una cosa ni otra cuentan aquí.
    const incidents = (
      await ctx.db.query("incidents").withIndex("by_createdAt").collect()
    ).filter(
      (row) => row.deletedAt === undefined && row.archivedAt === undefined,
    );
    const reported = incidents.filter(
      (row) => row.status === INCIDENT_STATUSES.REPORTED,
    ).length;

    // Trabajo en curso sin constancia, de lo más parado a lo menos.
    const marginDays = args.marginDays ?? DEFAULT_WORK_WITHOUT_TRACE_DAYS;
    const staleWork: StaleWorkEntry[] = incidents
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

    const [
      cachedStats,
      canInventory,
      canEquipment,
      canManuals,
      canPurchasing,
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
    ]);

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

    // --- Peticiones: la cola viva (el archivo tiene su propia pantalla) -----
    const requests = (
      await ctx.db.query("partRequests").withIndex("by_createdAt").collect()
    ).filter(
      (row) => row.deletedAt === undefined && row.archivedAt === undefined,
    );
    const pending = requests.filter(
      (row) => row.status === REQUEST_STATUSES.PENDING,
    );

    // --- Repuestos: el catálogo, con la misma regla que su filtro -----------
    const parts = canInventory
      ? await ctx.db.query("spareParts").withIndex("by_name").collect()
      : [];

    // --- Equipos y manuales: el total, que es lo que cuentan sus píldoras ---
    const equipment = canEquipment
      ? await ctx.db.query("equipment").collect()
      : [];
    const manuals = canManuals ? await ctx.db.query("manuals").collect() : [];

    // --- Compras: lo que espera a que alguien monte la orden ----------------
    const purchasing = canPurchasing
      ? await ctx.db
          .query("purchaseRequests")
          .withIndex("by_status", (q) =>
            q.eq("status", PURCHASE_REQUEST_STATUSES.PENDING),
          )
          .collect()
      : [];

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
  args: {},
  handler: async (ctx): Promise<WorkshopAnalyticsResult | null> => {
    const member = await memberOrNull(ctx);
    if (!member) return null;

    const [canIncidents, canRequests, canParts, canEquipment, canPurchasing] =
      await Promise.all([
        hasAnyCapability(ctx, member, ["viewIncidents", "manageIncidents"]),
        hasAnyCapability(ctx, member, ["viewRequests", "decideRequests"]),
        hasAnyCapability(ctx, member, ["viewInventory", "manageInventory"]),
        hasAnyCapability(ctx, member, [
          "viewEquipment",
          "manageEquipment",
          "lookupEquipment",
        ]),
        hasAnyCapability(ctx, member, ["viewPurchasing", "managePurchasing"]),
      ]);

    const [
      rawIncidents,
      rawRequests,
      rawParts,
      rawEquipment,
      rawMovements,
      rawPurchasing,
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
    ]);

    return buildWorkshopAnalytics({
      now: Date.now(),
      incidents: rawIncidents
        .filter((i) => i.deletedAt === undefined && i.archivedAt === undefined)
        .map((i) => ({
          status: i.status,
          reportedAt: i.reportedAt,
          closedAt: i.closedAt,
          model: i.model,
          equipmentKind: i.equipmentKind,
        })),
      requests: rawRequests
        .filter((r) => r.deletedAt === undefined && r.archivedAt === undefined)
        .map((r) => ({
          status: r.status,
          priority: r.priority,
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
      pendingPurchaseRequests: rawPurchasing.length,
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
