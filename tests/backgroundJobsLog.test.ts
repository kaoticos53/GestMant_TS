import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import {
  countJobsByFilter,
  formatJobDuration,
  formatJobProgress,
  matchesJobLogFilter,
} from "../src/lib/backgroundJobs";
import { backend } from "./backend";

describe("registro de trabajos · lógica pura", () => {
  test("filtra por estado y cuenta cada pestaña", () => {
    const statuses = ["failed", "completed", "running", "queued", "cancelled", "failed"];
    expect(countJobsByFilter(statuses)).toEqual({
      all: 6,
      failed: 2,
      active: 2,
      completed: 1,
    });
    expect(matchesJobLogFilter("failed", "failed")).toBe(true);
    expect(matchesJobLogFilter("queued", "active")).toBe(true);
    expect(matchesJobLogFilter("cancelled", "completed")).toBe(false);
    expect(matchesJobLogFilter("cancelled", "all")).toBe(true);
  });

  test("formatea duración y progreso", () => {
    expect(formatJobDuration(0, 42_000, 0)).toBe("42 s");
    expect(formatJobDuration(0, 125_000, 0)).toBe("2 min 5 s");
    expect(formatJobDuration(0, undefined, 3_720_000)).toBe("1 h 2 min");
    expect(formatJobDuration(10, 5, 0)).toBe("—");
    expect(formatJobProgress(120, 300)).toBe("120 de 300");
    expect(formatJobProgress(5)).toBe("5 procesados");
    expect(formatJobProgress(0)).toBe("—");
  });
});

describe("registro de trabajos · backgroundJobs.listForAdmin", () => {
  async function setup() {
    const t = backend();
    const adminId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Elena Vidal",
        email: "admin@taller.es",
        role: "admin",
        roles: ["admin"],
        active: true,
      }),
    );
    const techId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Iván Torres",
        email: "tecnico@taller.es",
        role: "technician",
        roles: ["technician"],
        active: true,
      }),
    );
    const now = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.insert("backgroundJobs", {
        userId: techId,
        type: "mail_sync",
        title: "Sincronización de correo",
        status: "failed",
        processed: 12,
        total: 40,
        error: "IMAP: autenticación rechazada",
        createdAt: now - 60_000,
        updatedAt: now - 30_000,
        finishedAt: now - 30_000,
      });
      await ctx.db.insert("backgroundJobs", {
        userId: adminId,
        type: "storage_cleanup",
        title: "Limpieza de almacenamiento",
        status: "completed",
        processed: 3,
        createdAt: now - 10_000,
        updatedAt: now - 5_000,
        finishedAt: now - 5_000,
      });
      await ctx.db.insert("backgroundJobs", {
        userId: adminId,
        type: "storage_cleanup",
        title: "Antigua",
        status: "failed",
        processed: 0,
        error: "viejo",
        createdAt: now - 9 * 24 * 60 * 60 * 1000,
        updatedAt: now - 9 * 24 * 60 * 60 * 1000,
      });
    });
    return {
      admin: t.withIdentity({ subject: `${adminId}|s1` }),
      tech: t.withIdentity({ subject: `${techId}|s1` }),
    };
  }

  test("el administrador ve los trabajos recientes de todos con su error", async () => {
    const { admin } = await setup();
    const jobs = await admin.query(api.backgroundJobs.listForAdmin, {});
    expect(jobs).toHaveLength(2);
    const failed = jobs.find((job) => job.status === "failed");
    expect(failed?.error).toBe("IMAP: autenticación rechazada");
    expect(failed?.ownerName).toBe("Iván Torres");
    expect(jobs.some((job) => job.title === "Antigua")).toBe(false);
  });

  test("un técnico no puede consultar el registro", async () => {
    const { tech } = await setup();
    const error = await tech
      .query(api.backgroundJobs.listForAdmin, {})
      .then(() => null, (err: unknown) => err);
    expect(error).toBeInstanceOf(ConvexError);
    expect(String((error as ConvexError<string>).data)).toContain(
      "Solo el administrador",
    );
  });
});
