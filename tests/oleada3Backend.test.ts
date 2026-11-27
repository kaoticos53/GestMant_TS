import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import { backend } from "./backend";

async function expectConvexError(promise: Promise<unknown>, fragment: string) {
  const error = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(
    error,
    `Se esperaba un error que contuviera: ${fragment}`,
  ).not.toBeNull();
  const message =
    error instanceof ConvexError ? String(error.data) : String(error);
  expect(message).toContain(fragment);
}

describe("Oleada 3 backend (gobernanza y auditoría)", () => {
  test("bloquea asignar roles a una cuenta de invitado", async () => {
    const t = backend();
    const adminId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Admin",
        email: "admin@taller.es",
        role: "admin",
        roles: ["admin"],
        active: true,
      }),
    );
    const guestId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Invitado",
        isAnonymous: true,
        active: true,
      }),
    );

    const admin = t.withIdentity({ subject: `${adminId}|s1` });
    await expectConvexError(
      admin.mutation(api.members.setRoles, {
        userId: guestId,
        roles: ["technician"],
      }),
      "invitado",
    );
  });

  test("getMemberSummary cuenta incidencias asignadas como responsable o técnico", async () => {
    const t = backend();
    const adminId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Admin",
        email: "admin@taller.es",
        role: "admin",
        roles: ["admin"],
        active: true,
      }),
    );
    const techId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Lucía",
        email: "lucia@taller.es",
        role: "technician",
        roles: ["technician"],
        active: true,
      }),
    );

    const eqId = await t.run((ctx) =>
      ctx.db.insert("equipment", {
        name: "Cámara Cine",
        model: "FX6",
        createdAt: 1000,
        updatedAt: 1000,
      }),
    );

    await t.run(async (ctx) => {
      await ctx.db.insert("incidents", {
        reference: "INC-0001",
        reporterName: "Ana",
        equipmentId: eqId,
        description: "Sin vídeo",
        reportedAt: 1000,
        status: "reported",
        assigneeId: techId,
        history: [],
        createdAt: 1000,
        updatedAt: 1000,
      });
      await ctx.db.insert("incidents", {
        reference: "INC-0002",
        reporterName: "Ana",
        equipmentId: eqId,
        description: "Foco roto",
        reportedAt: 1001,
        status: "workshop",
        workshopAssigneeId: techId,
        history: [],
        createdAt: 1001,
        updatedAt: 1001,
      });
      await ctx.db.insert("incidents", {
        reference: "INC-0003",
        reporterName: "Ana",
        equipmentId: eqId,
        description: "Cerrada",
        reportedAt: 1002,
        status: "resolved",
        assigneeId: techId,
        history: [],
        createdAt: 1002,
        updatedAt: 1002,
      });
    });

    const admin = t.withIdentity({ subject: `${adminId}|s1` });
    const summary = await admin.query(api.members.getMemberSummary, {
      userId: techId,
    });
    expect(summary).not.toBeNull();
    expect(summary?.assignedIncidentsTotal).toBe(3);
    expect(summary?.activeAssignedIncidents).toBe(2);
  });

  test("securityAuditLogs aplica rango de fechas y acción", async () => {
    const t = backend();
    const adminId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Admin",
        email: "admin@taller.es",
        role: "admin",
        roles: ["admin"],
        active: true,
      }),
    );

    await t.run(async (ctx) => {
      await ctx.db.insert("securityAuditLog", {
        actorId: adminId,
        actorEmail: "admin@taller.es",
        action: "password_reset",
        target: "uno@taller.es",
        at: 1000,
      });
      await ctx.db.insert("securityAuditLog", {
        actorId: adminId,
        actorEmail: "admin@taller.es",
        action: "password_reset",
        target: "dos@taller.es",
        at: 2000,
      });
      await ctx.db.insert("securityAuditLog", {
        actorId: adminId,
        actorEmail: "admin@taller.es",
        action: "role_change",
        target: "tres@taller.es",
        at: 2500,
      });
    });

    const admin = t.withIdentity({ subject: `${adminId}|s1` });
    const inRange = await admin.query(api.audit.securityAuditLogs, {
      paginationOpts: { numItems: 20, cursor: null },
      action: "password_reset",
      from: 1500,
      to: 3000,
    });
    expect(inRange.page.map((entry) => entry.target)).toEqual(["dos@taller.es"]);

    const allInRange = await admin.query(api.audit.securityAuditLogs, {
      paginationOpts: { numItems: 20, cursor: null },
      from: 1500,
      to: 3000,
    });
    expect(allInRange.page.map((entry) => entry.target as string)).toEqual([
      "tres@taller.es",
      "dos@taller.es",
    ]);
  });
});
