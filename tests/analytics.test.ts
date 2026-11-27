import { describe, expect, it } from "vitest";
import {
  buildWorkshopAnalytics,
  getAvailableAnalyticsLenses,
  getDefaultAnalyticsLens,
  type AnalyticsCapabilities,
} from "@/lib/analytics";

describe("Analítica del taller (Dominio puro)", () => {
  const now = Date.UTC(2026, 10, 20, 12, 0, 0);
  const DAY = 24 * 60 * 60 * 1000;

  it("calcula KPIs, distribución por estado, tendencia semanal, categorías, movimientos y rankings", () => {
    const res = buildWorkshopAnalytics({
      now,
      incidents: [
        {
          status: "reported",
          reportedAt: now - 2 * DAY,
          model: "HDC-3500",
        },
        {
          status: "workshop",
          reportedAt: now - 5 * DAY,
          model: "HDC-3500",
        },
        {
          status: "resolved",
          reportedAt: now - 10 * DAY,
          closedAt: now - 8 * DAY,
          model: "OPM-4250",
        },
      ],
      requests: [
        { status: "pending", priority: "urgent" },
        { status: "issued", priority: "normal" },
      ],
      parts: [
        { code: "AUD-01", name: "Antiviento", category: "Audio", stock: 0, minStock: 3, unit: "ud" },
        { code: "AUD-02", name: "Cable XLR", category: "Audio", stock: 2, minStock: 4, unit: "ud" },
        { code: "ELE-01", name: "Fusible", category: "Electrónica", stock: 10, minStock: 2, unit: "ud" },
      ],
      equipment: [
        { code: "EQ-001", name: "Cámara 1", model: "HDC-3500" },
        { code: "EQ-002", name: "Monitor B", model: "OPM-4250", decommissionDate: now - DAY },
      ],
      stockMovements: [
        { kind: "purchase_reception", delta: 5, createdAt: now - 3 * DAY },
        { kind: "request_reserve", delta: -2, createdAt: now - 1 * DAY },
      ],
      pendingPurchaseRequests: 3,
    });

    expect(res.kpis.activeIncidents).toBe(2);
    expect(res.kpis.resolvedLast30d).toBe(1);
    expect(res.kpis.avgResolutionHours).toBe(48);
    expect(res.kpis.activeRequests).toBe(1);
    expect(res.kpis.urgentRequests).toBe(1);
    expect(res.kpis.totalParts).toBe(3);
    expect(res.kpis.lowStockParts).toBe(2);
    expect(res.kpis.outOfStockParts).toBe(1);
    expect(res.kpis.totalEquipment).toBe(2);
    expect(res.kpis.decommissionedEquipment).toBe(1);
    expect(res.kpis.pendingPurchases).toBe(3);

    expect(res.incidentsByStatus.find((s) => s.status === "reported")?.count).toBe(1);
    expect(res.weeklyTrend).toHaveLength(8);
    expect(res.partsByCategory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "Audio", total: 2, lowStock: 2 }),
        expect.objectContaining({ category: "Electrónica", total: 1, lowStock: 0 }),
      ]),
    );
    expect(res.topProblematicEquipment[0]).toMatchObject({
      label: "HDC-3500",
      count: 2,
      openCount: 2,
    });
    expect(res.criticalParts[0]?.code).toBe("AUD-01");
    expect(res.stockMovementsSummary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "purchase_reception", entries: 1, units: 5 }),
        expect.objectContaining({ kind: "request_reserve", entries: 1, units: 2 }),
      ]),
    );
  });

  it("ubica incidencias en los cubos exactos de 8 semanas en el borde temporal", () => {
    const WEEK = 7 * DAY;
    const res = buildWorkshopAnalytics({
      now,
      incidents: [
        { status: "reported", reportedAt: now - 8 * WEEK },
        { status: "reported", reportedAt: now - 1 },
        { status: "reported", reportedAt: now },
        { status: "reported", reportedAt: now - 8 * WEEK - 1 },
      ],
      requests: [],
      parts: [],
      equipment: [],
      stockMovements: [],
      pendingPurchaseRequests: 0,
    });

    expect(res.weeklyTrend[0]?.reported).toBe(1);
    expect(res.weeklyTrend[7]?.reported).toBe(1);
    const sum = res.weeklyTrend.reduce((acc, w) => acc + w.reported, 0);
    expect(sum).toBe(2);
  });

  it("filtra incidencias y movimientos cuando se especifica periodDays", () => {
    const res = buildWorkshopAnalytics({
      now,
      periodDays: 7,
      incidents: [
        { status: "reported", reportedAt: now - 2 * DAY, model: "HDC-3500" },
        {
          status: "resolved",
          reportedAt: now - 20 * DAY,
          closedAt: now - 15 * DAY,
          model: "OPM-4250",
        },
      ],
      requests: [],
      parts: [],
      equipment: [],
      stockMovements: [
        { kind: "purchase_reception", delta: 4, createdAt: now - 3 * DAY },
        { kind: "request_reserve", delta: -1, createdAt: now - 14 * DAY },
      ],
      pendingPurchaseRequests: 0,
    });

    expect(res.kpis.totalIncidents).toBe(1);
    expect(res.kpis.activeIncidents).toBe(1);
    expect(res.kpis.resolvedLast30d).toBe(0);
    expect(
      res.stockMovementsSummary.find((m) => m.kind === "purchase_reception")
        ?.entries,
    ).toBe(1);
    expect(
      res.stockMovementsSummary.find((m) => m.kind === "request_reserve")
        ?.entries,
    ).toBe(0);
  });

  it("mantiene las incidencias abiertas antiguas aunque se elija periodDays: 7 y ajusta la granularidad a días", () => {
    const res = buildWorkshopAnalytics({
      now,
      periodDays: 7,
      incidents: [
        {
          id: "inc-old-open",
          reference: "INC-0001",
          status: "workshop",
          priority: "urgent",
          reportedAt: now - 25 * DAY,
          assigneeId: "u-tech",
          assigneeName: "Teo Técnico",
        },
        {
          id: "inc-old-closed",
          reference: "INC-0002",
          status: "resolved",
          reportedAt: now - 20 * DAY,
          closedAt: now - 15 * DAY,
        },
      ],
      requests: [],
      parts: [],
      equipment: [],
      stockMovements: [],
      pendingPurchaseRequests: 0,
      currentUserId: "u-tech",
    });

    expect(res.trendGranularity).toBe("day");
    expect(res.weeklyTrend).toHaveLength(7);
    expect(res.kpis.activeIncidents).toBe(1);
    expect(res.myDay.assignedOpenCount).toBe(1);
    expect(res.incidentsByPriority.find((p) => p.priority === "urgent")?.count).toBe(
      1,
    );
  });

  it("resuelve lentes disponibles y lente por defecto según capacidades", () => {
    const techCaps: AnalyticsCapabilities = {
      incidents: true,
      manageIncidents: false,
      requests: true,
      decideRequests: false,
      inventory: false,
      equipment: false,
      purchasing: false,
      admin: false,
    };
    expect(getAvailableAnalyticsLenses(techCaps)).toEqual(["my_day", "workshop"]);
    expect(getDefaultAnalyticsLens(techCaps)).toBe("my_day");

    const warehouseCustomCaps: AnalyticsCapabilities = {
      incidents: false,
      manageIncidents: false,
      requests: false,
      decideRequests: true,
      inventory: true,
      equipment: false,
      purchasing: true,
      admin: false,
    };
    expect(getAvailableAnalyticsLenses(warehouseCustomCaps)).toEqual([
      "inventory_purchasing",
    ]);
    expect(getDefaultAnalyticsLens(warehouseCustomCaps)).toBe(
      "inventory_purchasing",
    );

    const adminCaps: AnalyticsCapabilities = {
      incidents: true,
      manageIncidents: true,
      requests: true,
      decideRequests: true,
      inventory: true,
      equipment: true,
      purchasing: true,
      admin: true,
    };
    expect(getAvailableAnalyticsLenses(adminCaps)).toEqual([
      "my_day",
      "workshop",
      "inventory_purchasing",
      "system",
    ]);
    expect(getDefaultAnalyticsLens(adminCaps)).toBe("workshop");
  });

  it("calcula mi jornada, carga por técnico, estancamiento, SAT externo y repuestos en pedido", () => {
    const res = buildWorkshopAnalytics({
      now,
      currentUserId: "u-tech",
      incidents: [
        {
          id: "inc-1",
          reference: "INC-001",
          status: "assigned",
          priority: "urgent",
          reportedAt: now - 6 * DAY,
          model: "HDC-3500",
          assigneeId: "u-tech",
          assigneeName: "Teo Técnico",
          history: [
            { status: "reported", at: now - 6 * DAY },
            { status: "assigned", at: now - 5 * DAY },
          ],
          lifecycleNotes: [],
        },
        {
          id: "inc-2",
          reference: "INC-002",
          status: "reported",
          priority: "medium",
          reportedAt: now - 1 * DAY,
          model: "OPM-4250",
        },
        {
          id: "inc-3",
          reference: "INC-003",
          status: "externalRepair",
          priority: "high",
          reportedAt: now - 10 * DAY,
          model: "HDC-3500",
          assigneeId: "u-other",
          assigneeName: "Ana",
          externalRepair: {
            companyName: "SAT Oficial",
            expectedReturnAt: now - 1 * DAY,
          },
        },
      ],
      requests: [
        {
          id: "req-1",
          reference: "PET-001",
          status: "materialReceived",
          priority: "urgent",
          requesterId: "u-tech",
          equipment: "HDC-3500",
          createdAt: now - 3 * DAY,
          linesCount: 1,
        },
        {
          id: "req-2",
          reference: "PET-002",
          status: "pending",
          priority: "normal",
          requesterId: "u-tech",
          createdAt: now - 1 * DAY,
          linesCount: 0,
        },
      ],
      parts: [
        {
          code: "REP-1",
          name: "Fusible",
          category: "Alimentación",
          stock: 0,
          minStock: 2,
          unit: "ud",
        },
      ],
      equipment: [],
      stockMovements: [],
      pendingPurchaseRequests: 1,
      orderedPartCodes: ["REP-1"],
      openPurchaseOrders: [
        {
          id: "po-1",
          reference: "OC-0001",
          supplier: "Electro",
          status: "pending",
          orderedAt: now - 4 * DAY,
          pendingUnits: 2,
          totalUnits: 2,
        },
      ],
    });

    expect(res.myDay.assignedOpenCount).toBe(1);
    expect(res.myDay.assignedUrgentOrHighCount).toBe(1);
    expect(res.myDay.unassignedReportedCount).toBe(1);
    expect(res.myDay.myStaleCount).toBe(1);
    expect(res.myDay.myRequestsReadyCount).toBe(1);
    expect(res.myDay.myRequestsWaitingCount).toBe(1);
    expect(res.myDay.myPriorityIncidents[0]?.reference).toBe("INC-001");
    expect(res.myDay.myReadyRequests[0]?.reference).toBe("PET-001");

    expect(res.workloadByTechnician).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Teo Técnico", count: 1, urgentCount: 1 }),
        expect.objectContaining({ name: "Sin asignar", count: 1, unassigned: true }),
      ]),
    );
    expect(res.staleWork[0]).toMatchObject({
      reference: "INC-001",
      days: 5,
      isMine: true,
    });
    expect(res.externalRepairs[0]).toMatchObject({
      reference: "INC-003",
      companyName: "SAT Oficial",
      overdue: true,
    });
    expect(res.criticalParts[0]?.onOrder).toBe(true);
    expect(res.purchasingSummary).toMatchObject({
      pendingRequestsToDecide: 1,
      requestsWithoutReference: 1,
      materialReceivedPendingDelivery: 1,
      openOrdersCount: 1,
    });
    expect(res.purchasingSummary.openOrders[0]?.ageDays).toBe(4);
  });
});
