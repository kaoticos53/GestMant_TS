import { backend } from "./backend";
import { describe, expect, test } from "vitest";
import { api, internal } from "../src/convex/_generated/api";

describe("dashboardStats precalculados (Fase 4)", () => {
  test("rebuild calcula todos los contadores y dashboard.summary respeta permisos", async () => {
    const t = backend();
    const now = Date.now();
    const adminId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Admin",
        email: "admin@taller.es",
        role: "admin",
      }),
    );
    const techId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Técnico",
        email: "tech@taller.es",
        role: "technician",
      }),
    );

    const partId = await t.run((ctx) =>
      ctx.db.insert("spareParts", {
        code: "ST-01",
        name: "Fusible 10A",
        category: "Alimentación",
        unit: "ud",
        stock: 1,
        minStock: 5,
        createdAt: now,
        updatedAt: now,
      }),
    );
    await t.run((ctx) =>
      ctx.db.insert("equipment", {
        code: "EQ-1",
        name: "Cámara 1",
        model: "FX6",
        location: "Plató 1",
        createdAt: now,
        updatedAt: now,
      }),
    );
    const requestId = await t.run((ctx) =>
      ctx.db.insert("partRequests", {
        reference: "PR-0001",
        requesterName: "Técnico",
        priority: "urgent",
        description: "Cambio urgente",
        lines: [],
        status: "pending",
        createdAt: now,
      }),
    );
    await t.run((ctx) =>
      ctx.db.insert("purchaseRequests", {
        reference: "PC-0001",
        requestId,
        requestReference: "PR-0001",
        requestDate: now,
        requesterName: "Técnico",
        sparePartId: partId,
        code: "ST-01",
        name: "Fusible 10A",
        unit: "ud",
        quantity: 10,
        supplier: "RS Components",
        status: "pending",
        reason: "noStock",
        requestedAt: now,
        requestedBy: "Admin",
        createdAt: now,
      }),
    );

    const rebuilt = await t.mutation(internal.dashboard.rebuildStats, {});
    expect(rebuilt.partsTotal).toBe(1);
    expect(rebuilt.partsLowStock).toBe(1);
    expect(rebuilt.equipmentTotal).toBe(1);
    expect(rebuilt.requestsPending).toBe(1);
    expect(rebuilt.requestsPendingUrgent).toBe(1);
    expect(rebuilt.requestsPendingWithoutReference).toBe(1);
    expect(rebuilt.purchasingPending).toBe(1);

    const adminSummary = await t
      .withIdentity({ subject: `${adminId}|s1` })
      .query(api.dashboard.summary, {});
    expect(adminSummary.parts).toEqual({ total: 1, lowStock: 1 });
    expect(adminSummary.equipment).toBe(1);
    expect(adminSummary.purchasing.pending).toBe(1);
    expect(adminSummary.requests.urgent).toBe(1);

    // El técnico sin viewPurchasing ve 0 en compras aunque dashboardStats exista
    const techSummary = await t
      .withIdentity({ subject: `${techId}|s2` })
      .query(api.dashboard.summary, {});
    expect(techSummary.purchasing.pending).toBe(0);
    expect(techSummary.parts.total).toBe(1);
  });

  test("las mutaciones de equipos y repuestos mantienen dashboardStats sincronizado", async () => {
    const t = backend();
    const adminId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Admin",
        email: "admin@taller.es",
        role: "admin",
      }),
    );
    const authed = t.withIdentity({ subject: `${adminId}|s1` });

    await t.mutation(internal.dashboard.rebuildStats, {});

    const eqId = await authed.mutation(api.equipment.create, {
      code: "EQ-99",
      name: "Monitor OLED",
      model: "PVM-A250",
      location: "Control",
    });
    await authed.mutation(api.spareParts.create, {
      code: "REP-99",
      name: "Cable SDI",
      category: "Conectividad",
      unit: "ud",
      stock: 0,
      minStock: 2,
    });

    let summary = await authed.query(api.dashboard.summary, {});
    expect(summary.equipment).toBe(1);
    expect(summary.parts).toEqual({ total: 1, lowStock: 1 });

    await authed.mutation(api.equipment.remove, { id: eqId });
    summary = await authed.query(api.dashboard.summary, {});
    expect(summary.equipment).toBe(0);
  });
});
