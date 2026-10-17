import { backend } from "./backend";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api, internal } from "../src/convex/_generated/api";
import { logSecurityEvent } from "../src/convex/audit";

async function setup(
  role: "admin" | "manager" | "technician" = "admin",
  email = "admin@taller.es",
  extra: { active?: boolean; isAnonymous?: boolean } = {},
) {
  const t = backend();
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Usuario de prueba",
      email,
      role,
      active: extra.active ?? true,
      isAnonymous: extra.isAnonymous ?? false,
    }),
  );
  const authed = t.withIdentity({ subject: `${userId}|session1` });
  return { t, authed, userId };
}

async function expectConvexError(promise: Promise<unknown>, fragment: string) {
  const error = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(error, `Se esperaba un error que contuviera: ${fragment}`).not.toBeNull();
  const message =
    error instanceof ConvexError ? String(error.data) : String(error);
  expect(message).toContain(fragment);
}

describe("Auditoría de seguridad (securityAuditLog y audit.ts)", () => {
  test("logSecurityEvent registra eventos con actor, target, metadata y timestamp", async () => {
    const { t, userId } = await setup("admin", "jefa@taller.es");

    const logId = await t.run((ctx) =>
      logSecurityEvent(ctx, {
        actorId: userId,
        action: "role_change",
        target: `user:${userId}`,
        metadata: { from: "technician", to: "manager" },
      }),
    );

    const entry = await t.run((ctx) => ctx.db.get(logId));
    expect(entry).not.toBeNull();
    expect(entry?.actorId).toBe(userId);
    expect(entry?.actorEmail).toBe("jefa@taller.es");
    expect(entry?.action).toBe("role_change");
    expect(entry?.target).toBe(`user:${userId}`);
    expect(entry?.metadata).toBe(
      JSON.stringify({ from: "technician", to: "manager" }),
    );
    expect(typeof entry?.at).toBe("number");
  });

  test("securityAuditLogs solo es accesible por administradores activos y no anónimos", async () => {
    const { t } = await setup("admin");

    // Usuario técnico autenticado
    const techId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Técnico",
        email: "tech@taller.es",
        role: "technician",
        active: true,
      }),
    );
    const techAuthed = t.withIdentity({ subject: `${techId}|s1` });
    await expectConvexError(
      techAuthed.query(api.audit.securityAuditLogs, {}),
      "Solo el administrador puede consultar las trazas",
    );

    // Usuario anónimo
    const anonId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Invitado",
        role: "admin",
        isAnonymous: true,
        active: true,
      }),
    );
    const anonAuthed = t.withIdentity({ subject: `${anonId}|s2` });
    await expectConvexError(
      anonAuthed.query(api.audit.securityAuditLogs, {}),
      "Solo el administrador puede consultar las trazas",
    );

    // Usuario inactivo (dado de baja)
    const inactiveId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Admin inactivo",
        role: "admin",
        active: false,
      }),
    );
    const inactiveAuthed = t.withIdentity({ subject: `${inactiveId}|s3` });
    await expectConvexError(
      inactiveAuthed.query(api.audit.securityAuditLogs, {}),
      "Solo el administrador puede consultar las trazas",
    );
  });

  test("securityAuditLogs permite consultar y filtrar por acción", async () => {
    const { t, authed, userId } = await setup("admin");

    await t.run(async (ctx) => {
      await logSecurityEvent(ctx, {
        actorId: userId,
        action: "role_change",
        target: "user:target1",
      });
      await logSecurityEvent(ctx, {
        actorId: userId,
        action: "account_status_change",
        target: "user:target2",
      });
    });

    const allLogs = await authed.query(api.audit.securityAuditLogs, {});
    expect(allLogs.length).toBe(2);

    const filteredLogs = await authed.query(api.audit.securityAuditLogs, {
      action: "role_change",
    });
    expect(filteredLogs.length).toBe(1);
    expect(filteredLogs[0].action).toBe("role_change");
    expect(filteredLogs[0].target).toBe("user:target1");
  });

  test("members.setRole registra el cambio de rol en securityAuditLog", async () => {
    const { t, authed, userId: adminId } = await setup("admin", "admin@taller.es");

    const targetUserId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Pepe Operario",
        email: "pepe@taller.es",
        role: "technician",
        active: true,
      }),
    );

    await authed.mutation(api.members.setRole, {
      userId: targetUserId,
      role: "manager",
    });

    const updatedUser = await t.run((ctx) => ctx.db.get(targetUserId));
    expect(updatedUser?.role).toBe("manager");

    const logs = await t.run((ctx) =>
      ctx.db
        .query("securityAuditLog")
        .withIndex("by_action", (q) => q.eq("action", "role_change"))
        .collect(),
    );

    expect(logs.length).toBe(1);
    const log = logs[0];
    expect(log.actorId).toBe(adminId);
    expect(log.target).toBe(`user:${targetUserId}`);
    expect(JSON.parse(log.metadata ?? "{}")).toEqual({
      previousRole: "technician",
      newRole: "manager",
      targetEmail: "pepe@taller.es",
      targetName: "Pepe Operario",
    });
  });

  test("members.patchActive registra la baja/alta de usuario en securityAuditLog", async () => {
    const { t, userId: adminId } = await setup("admin", "admin@taller.es");

    const targetUserId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Carlos Baja",
        email: "carlos@taller.es",
        role: "technician",
        active: true,
      }),
    );

    await t.mutation(internal.members.patchActive, {
      userId: targetUserId,
      active: false,
      actorId: adminId,
    });

    const updatedUser = await t.run((ctx) => ctx.db.get(targetUserId));
    expect(updatedUser?.active).toBe(false);

    const logs = await t.run((ctx) =>
      ctx.db
        .query("securityAuditLog")
        .withIndex("by_action", (q) => q.eq("action", "account_status_change"))
        .collect(),
    );

    expect(logs.length).toBe(1);
    expect(logs[0].actorId).toBe(adminId);
    expect(logs[0].target).toBe(`user:${targetUserId}`);
    expect(JSON.parse(logs[0].metadata ?? "{}")).toEqual({
      active: false,
      targetEmail: "carlos@taller.es",
      targetName: "Carlos Baja",
    });
  });

  test("workshopReset.logResetAudit registra el vaciado y la tabla es inmutable frente al reset", async () => {
    const { t, userId: adminId } = await setup("admin", "admin@taller.es");

    await t.mutation(internal.workshopReset.logResetAudit, {
      userId: adminId,
      deleted: 15,
      passes: 2,
    });

    const logs = await t.run((ctx) =>
      ctx.db
        .query("securityAuditLog")
        .withIndex("by_action", (q) => q.eq("action", "workshop_reset"))
        .collect(),
    );

    expect(logs.length).toBe(1);
    expect(logs[0].target).toBe("system:workshop");
    const meta = JSON.parse(logs[0].metadata ?? "{}");
    expect(meta.deleted).toBe(15);
    expect(meta.passes).toBe(2);

    // Ejecutar clearBatch para verificar que securityAuditLog no se borra
    await t.mutation(internal.workshopReset.clearBatch, { userId: adminId });

    const logsAfterReset = await t.run((ctx) =>
      ctx.db.query("securityAuditLog").collect(),
    );
    expect(logsAfterReset.length).toBe(1);
  });
});
