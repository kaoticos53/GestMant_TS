import { backend } from "./backend";
import { describe, expect, test } from "vitest";
import { api, internal } from "../src/convex/_generated/api";

async function adminSession() {
  const t = backend();
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
  return {
    t,
    adminId,
    techId,
    admin: t.withIdentity({ subject: `${adminId}|s1` }),
    tech: t.withIdentity({ subject: `${techId}|s2` }),
  };
}

describe("mailOutbox — cola de fallidos, reintentos y alertas (Fase 2)", () => {
  test("un fallo transitorio entra en retrying y un fallo permanente entra en failed y notifica al admin", async () => {
    const { t, adminId, admin } = await adminSession();

    const transientId = await t.mutation(internal.mailOutbox.enqueueFailure, {
      what: "el aviso a quien notificó",
      origin: "incidencia",
      to: ["cliente@empresa.es"],
      subject: "INC-001",
      text: "Cuerpo",
      html: "<p>Cuerpo</p>",
      lastError:
        "No se pudo hablar con el servicio de correo (Relevo propio): fetch failed",
    });

    const permanentId = await t.mutation(internal.mailOutbox.enqueueFailure, {
      what: "el aviso al equipo",
      origin: "equipo",
      to: ["equipo@empresa.es"],
      subject: "INC-002",
      text: "Cuerpo",
      html: "<p>Cuerpo</p>",
      lastError: "El correo saliente está apagado en los ajustes del taller.",
    });

    const list = await admin.query(api.mailOutbox.list, {});
    expect(list).toHaveLength(2);
    const tRow = list.find((r) => r._id === transientId);
    const pRow = list.find((r) => r._id === permanentId);
    expect(tRow?.status).toBe("retrying");
    expect(tRow?.nextRetryAt).toBeDefined();
    expect(pRow?.status).toBe("failed");

    const notifications = await t.run((ctx) =>
      ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", adminId))
        .collect(),
    );
    expect(notifications).toHaveLength(1);
    expect(notifications[0].text).toContain("INC-002");
  });

  test("recordAttemptResult avanza intentos y marca sent o failed al agotar reintentos", async () => {
    const { t, adminId } = await adminSession();

    const id = await t.mutation(internal.mailOutbox.enqueueFailure, {
      what: "el aviso",
      origin: "incidencia",
      to: ["a@b.es"],
      subject: "INC-003",
      text: "hola",
      html: "<p>hola</p>",
      lastError: "HTTP 503",
    });

    // Intento 2 y 3 fallan -> sigue en retrying
    await t.mutation(internal.mailOutbox.recordAttemptResult, {
      outboxId: id,
      ok: false,
      error: "HTTP 503",
    });
    let row = await t.run((ctx) => ctx.db.get(id));
    expect(row?.status).toBe("retrying");
    expect(row?.attempts).toBe(2);

    await t.mutation(internal.mailOutbox.recordAttemptResult, {
      outboxId: id,
      ok: false,
      error: "HTTP 503",
    });
    row = await t.run((ctx) => ctx.db.get(id));
    expect(row?.status).toBe("retrying");
    expect(row?.attempts).toBe(3);

    // Intento 4 falla -> agota MAX_MAIL_ATTEMPTS (4), pasa a failed y notifica
    await t.mutation(internal.mailOutbox.recordAttemptResult, {
      outboxId: id,
      ok: false,
      error: "HTTP 503",
    });
    row = await t.run((ctx) => ctx.db.get(id));
    expect(row?.status).toBe("failed");
    expect(row?.attempts).toBe(4);

    const notifications = await t.run((ctx) =>
      ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", adminId))
        .collect(),
    );
    expect(notifications).toHaveLength(1);
    expect(notifications[0].text).toContain("INC-003");
  });

  test("solo el administrador puede listar, reintentar o descartar", async () => {
    const { t, admin, tech } = await adminSession();

    const id = await t.mutation(internal.mailOutbox.enqueueFailure, {
      what: "el aviso",
      origin: "incidencia",
      to: ["a@b.es"],
      subject: "INC-004",
      text: "hola",
      html: "<p>hola</p>",
      lastError: "El correo saliente está apagado en los ajustes del taller.",
    });

    await expect(tech.query(api.mailOutbox.list, {})).rejects.toThrow();
    await expect(
      tech.mutation(api.mailOutbox.retryOne, { outboxId: id }),
    ).rejects.toThrow();

    await admin.mutation(api.mailOutbox.discard, { outboxId: id });
    const listAfterDiscard = await admin.query(api.mailOutbox.list, {});
    expect(listAfterDiscard).toHaveLength(0);
  });
});
