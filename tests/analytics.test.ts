import { describe, expect, it } from "vitest";
import { buildWorkshopAnalytics } from "@/lib/analytics";

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
});
