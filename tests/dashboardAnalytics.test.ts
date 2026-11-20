import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import { backend } from "./backend";

describe("dashboard.analytics (Fase 2 TDD)", () => {
  test("devuelve null para anónimos/invitados y respeta permisos por módulo", async () => {
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

    const adminAnalytics = await admin.query(api.dashboard.analytics, {});
    expect(adminAnalytics).not.toBeNull();
    expect(adminAnalytics!.kpis.totalEquipment).toBeGreaterThanOrEqual(20);
    expect(adminAnalytics!.kpis.totalParts).toBeGreaterThanOrEqual(30);
    expect(adminAnalytics!.weeklyTrend).toHaveLength(8);

    // Un técnico por defecto solo tiene viewIncidents -> ve incidencias pero no compras/inventario
    const techAnalytics = await tech.query(api.dashboard.analytics, {});
    expect(techAnalytics).not.toBeNull();
    expect(techAnalytics!.kpis.totalIncidents).toBeGreaterThan(0);
    expect(techAnalytics!.kpis.pendingPurchases).toBe(0);
    expect(techAnalytics!.kpis.totalParts).toBe(0);
  });
});
