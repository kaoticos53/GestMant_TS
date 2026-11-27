import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import { backend } from "./backend";

describe("dashboard.analytics (Fase 2 TDD)", () => {
  test("devuelve null para anónimos/invitados y adapta capacidades y datos por perfil", async () => {
    const t = backend();
    const { adminId, techId, guestId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("users", {
        name: "Admin",
        email: "admin@taller.es",
        role: "admin",
        active: true,
      });
      const techId = await ctx.db.insert("users", {
        name: "Técnico",
        email: "tech@taller.es",
        role: "technician",
        active: true,
      });
      const guestId = await ctx.db.insert("users", {
        name: "Invitado",
        isAnonymous: true,
        role: "guest",
      });
      return { adminId, techId, guestId };
    });

    const admin = t.withIdentity({ subject: `${adminId}|s-admin` });
    const tech = t.withIdentity({ subject: `${techId}|s-tech` });
    const guest = t.withIdentity({ subject: `${guestId}|s-guest` });

    expect(await t.query(api.dashboard.analytics, {})).toBeNull();
    expect(await guest.query(api.dashboard.analytics, {})).toBeNull();

    await admin.mutation(api.seed.seedDemoData, {});

    // Asignamos una incidencia y creamos una petición ya lista para el técnico.
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("incidents", {
        reference: "INC-9001",
        reporterName: "Plató 1",
        description: "Fallo de señal",
        reportedAt: now - 5 * 24 * 60 * 60 * 1000,
        priority: "urgent",
        status: "assigned",
        assigneeId: techId,
        assigneeName: "Técnico",
        history: [
          {
            status: "reported",
            at: now - 5 * 24 * 60 * 60 * 1000,
            by: "Admin",
          },
          {
            status: "assigned",
            at: now - 4 * 24 * 60 * 60 * 1000,
            by: "Admin",
          },
        ],
        createdAt: now - 5 * 24 * 60 * 60 * 1000,
        updatedAt: now - 4 * 24 * 60 * 60 * 1000,
      });
      await ctx.db.insert("partRequests", {
        reference: "PET-9001",
        requesterName: "Técnico",
        requesterId: techId,
        priority: "normal",
        status: "materialReceived",
        lines: [],
        createdAt: now - 2 * 24 * 60 * 60 * 1000,
      });
    });

    const adminAnalytics = await admin.query(api.dashboard.analytics, {});
    expect(adminAnalytics).not.toBeNull();
    expect(adminAnalytics!.capabilities.admin).toBe(true);
    expect(adminAnalytics!.systemHealth).not.toBeNull();
    expect(adminAnalytics!.systemHealth!.activeUsers).toBeGreaterThanOrEqual(2);
    expect(adminAnalytics!.kpis.totalEquipment).toBeGreaterThanOrEqual(20);
    expect(adminAnalytics!.kpis.totalParts).toBeGreaterThanOrEqual(30);
    expect(adminAnalytics!.weeklyTrend).toHaveLength(8);

    // El técnico ve su jornada (incidencias/peticiones) sin datos de inventario/compras/sistema.
    const techAnalytics = await tech.query(api.dashboard.analytics, {});
    expect(techAnalytics).not.toBeNull();
    expect(techAnalytics!.capabilities).toMatchObject({
      incidents: true,
      manageIncidents: false,
      requests: true,
      inventory: false,
      equipment: false,
      purchasing: false,
      admin: false,
    });
    expect(techAnalytics!.systemHealth).toBeNull();
    expect(techAnalytics!.myDay.assignedOpenCount).toBe(1);
    expect(techAnalytics!.myDay.assignedUrgentOrHighCount).toBe(1);
    expect(techAnalytics!.myDay.myStaleCount).toBe(1);
    expect(techAnalytics!.myDay.myRequestsReadyCount).toBe(1);
    expect(techAnalytics!.kpis.totalIncidents).toBeGreaterThan(0);
    expect(techAnalytics!.kpis.pendingPurchases).toBe(0);
    expect(techAnalytics!.kpis.totalParts).toBe(0);
  });
});
