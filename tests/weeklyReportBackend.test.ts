import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../src/convex/_generated/api";
import schema from "../src/convex/schema";
import { AUTO_ARCHIVE_BY } from "../src/lib/archive";
import { utcWeekday } from "../src/lib/weeklyReport";

/** Todos los módulos de funciones de la app (convex-test los levanta in-process). */
const modules = import.meta.glob("../src/convex/**/!(*.*.*)*.*s");

const DAY = 24 * 60 * 60 * 1000;

type Test = ReturnType<typeof convexTest>;

/** Lanza la promesa y comprueba que el error contiene el texto. */
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

/**
 * Taller pequeño con una incidencia parada sin constancia, una cerrada esta
 * semana, otra cerrada y archivada, y una petición entregada.
 */
async function setup() {
  const t = convexTest(schema, modules);
  const now = Date.now();
  const adminId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Ada Admin",
      email: "admin@taller.es",
      role: "admin",
      active: true,
    }),
  );
  const managerId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Elena Vidal",
      email: "coord@taller.es",
      role: "manager",
      active: true,
    }),
  );
  const techId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Iván Torres",
      email: "tecnico@taller.es",
      role: "technician",
      active: true,
    }),
  );
  // Ni la baja ni el invitado reciben correo, aunque su rol esté elegido.
  await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Diego de baja",
      email: "baja@taller.es",
      role: "manager",
      active: false,
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Invitado",
      email: "invitado@taller.es",
      role: "manager",
      isAnonymous: true,
    }),
  );

  const stopped = await t.run((ctx) =>
    ctx.db.insert("incidents", {
      reference: "INC-0001",
      reporterName: "Laura Peña",
      description: "Lleva días en el taller y nadie ha escrito nada.",
      reportedAt: now - 9 * DAY,
      status: "assigned",
      assigneeId: techId,
      assigneeName: "Iván Torres",
      history: [
        { status: "reported", at: now - 9 * DAY, by: "Laura Peña" },
        { status: "assigned", at: now - 8 * DAY, by: "Elena Vidal" },
      ],
      createdAt: now - 9 * DAY,
      updatedAt: now - 8 * DAY,
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("incidents", {
      reference: "INC-0002",
      reporterName: "Sandra Ruiz",
      equipmentKind: "Cámara de estudio",
      model: "HDC-3500",
      description: "Se apaga sola en directo.",
      reportedAt: now - 3 * DAY,
      status: "resolved",
      assigneeName: "Iván Torres",
      closedAt: now - DAY,
      history: [
        { status: "reported", at: now - 3 * DAY, by: "Sandra Ruiz" },
        { status: "resolved", at: now - DAY, by: "Iván Torres" },
      ],
      createdAt: now - 3 * DAY,
      updatedAt: now - DAY,
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("incidents", {
      reference: "INC-0003",
      reporterName: "Marcos Vega",
      description: "Vieja y ya archivada.",
      reportedAt: now - 40 * DAY,
      status: "resolved",
      closedAt: now - 30 * DAY,
      archivedAt: now - DAY,
      archivedBy: AUTO_ARCHIVE_BY,
      history: [
        { status: "reported", at: now - 40 * DAY, by: "Marcos Vega" },
        { status: "resolved", at: now - 30 * DAY, by: "Iván Torres" },
      ],
      createdAt: now - 40 * DAY,
      updatedAt: now - 30 * DAY,
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("partRequests", {
      reference: "PET-0001",
      requesterName: "Sandra Ruiz",
      priority: "normal",
      status: "issued",
      lines: [],
      createdAt: now - 5 * DAY,
      decidedAt: now - 2 * DAY,
      decidedBy: "Elena Vidal",
      issuedAt: now - DAY,
    }),
  );

  return {
    t,
    now,
    admin: t.withIdentity({ subject: `${adminId}|session1` }),
    manager: t.withIdentity({ subject: `${managerId}|session1` }),
    tech: t.withIdentity({ subject: `${techId}|session1` }),
    stopped,
  };
}

/** Filas guardadas de resúmenes (una por semana). */
async function reportRows(t: Test) {
  return await t.run((ctx) => ctx.db.query("weeklyReports").collect());
}

/** Respuesta buena de la pasarela, sin salir a la red. */
function stubGateway() {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ id: "msg_1", status: "sent" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.VLY_INTEGRATION_KEY;
});

describe("weeklyReport.settings — ajustes del resumen", () => {
  test("sin nada configurado: encendido, los lunes y a quien coordina", async () => {
    const { manager } = await setup();

    const settings = await manager.query(api.weeklyReport.settings, {});
    expect(settings.enabled).toBe(true);
    expect(settings.weekday).toBe(1);
    expect(settings.roleKeys).toEqual(["admin", "manager"]);
    expect(settings.lastSentAt).toBe(null);
    expect(settings.lastSentTo).toEqual([]);
  });

  test("quien no coordina no ve los ajustes ni la lista de roles", async () => {
    const { tech } = await setup();

    await expectConvexError(
      tech.query(api.weeklyReport.settings, {}),
      "Solo quien coordina las incidencias o decide las peticiones",
    );
    await expectConvexError(
      tech.query(api.weeklyReport.roleOptions, {}),
      "Solo quien coordina las incidencias o decide las peticiones",
    );
  });

  test("sin sesión no hay nada que leer", async () => {
    const { t } = await setup();
    await expectConvexError(
      t.query(api.weeklyReport.settings, {}),
      "Debes iniciar sesión",
    );
  });

  test("quien coordina guarda el día y los roles, sin repetidos", async () => {
    const { t, manager } = await setup();

    await manager.mutation(api.weeklyReport.setSettings, {
      enabled: false,
      weekday: 5,
      roleKeys: ["admin", "admin", "technician"],
    });

    const settings = await manager.query(api.weeklyReport.settings, {});
    expect(settings.enabled).toBe(false);
    expect(settings.weekday).toBe(5);
    expect(settings.roleKeys).toEqual(["admin", "technician"]);
    expect(settings.updatedBy).toBe("Elena Vidal");
    // Una sola fila: el segundo cambio actualiza la misma.
    await manager.mutation(api.weeklyReport.setSettings, {
      enabled: true,
      weekday: 1,
      roleKeys: [],
    });
    const rows = await t.run((ctx) => ctx.db.query("reportSettings").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].weekday).toBe(1);
  });

  test("el día tiene que ser un día de la semana", async () => {
    const { manager } = await setup();

    await expectConvexError(
      manager.mutation(api.weeklyReport.setSettings, {
        enabled: true,
        weekday: 0,
        roleKeys: [],
      }),
      "debe estar entre el lunes (1) y el domingo (7)",
    );
    await expectConvexError(
      manager.mutation(api.weeklyReport.setSettings, {
        enabled: true,
        weekday: 8,
        roleKeys: [],
      }),
      "debe estar entre el lunes (1) y el domingo (7)",
    );
  });

  test("no se puede apuntar a un rol que ya no existe", async () => {
    const { manager } = await setup();

    await expectConvexError(
      manager.mutation(api.weeklyReport.setSettings, {
        enabled: true,
        weekday: 1,
        roleKeys: ["admin", "auxiliar-de-almacen"],
      }),
      "Esos roles ya no existen: auxiliar-de-almacen",
    );
  });

  test("la lista de roles incluye los personalizados", async () => {
    const { admin, manager } = await setup();
    const key = await admin.mutation(api.permissions.createRole, {
      label: "Auxiliar de almacén",
      templateKey: "technician",
    });

    const options = await manager.query(api.weeklyReport.roleOptions, {});
    const keys = options.map((option) => option.key);
    expect(keys).toEqual(["admin", "manager", "technician", key]);
    // «Invitado» no está: es la sesión anónima de consulta, no un rol al que
    // apuntar el resumen —ni uno que se le dé a una persona—.
    expect(keys).not.toContain("guest");
  });
});

describe("weeklyReport.preview — el correo que saldría", () => {
  test("compone la semana con destinatarios resueltos en el servidor", async () => {
    const { manager } = await setup();

    const preview = await manager.query(api.weeklyReport.preview, {});
    expect(preview.subject).toContain("Resumen semanal del taller ·");
    expect(preview.recipients).toEqual(["admin@taller.es", "coord@taller.es"]);
    expect(preview.counts).toEqual({
      touched: 1,
      withoutTrace: 1,
      archived: 1,
    });
    expect(preview.marginDays).toBe(3);
    expect(preview.text).toContain("LO QUE SE TRABAJÓ");
    // La parada sale con su técnico y sus días.
    expect(preview.text).toContain("INC-0001 · Asignada · Iván Torres · 8 días en curso");
    // La archivada, firmada por la pasada automática.
    expect(preview.text).toContain(AUTO_ARCHIVE_BY);
    expect(preview.key).toBe(
      `week-${new Date(preview.from).toISOString().slice(0, 10)}`,
    );
  });

  test("usa el margen del aviso de trabajo sin constancia", async () => {
    const { manager } = await setup();
    await manager.mutation(api.alerts.setSettings, {
      days: 30,
      roleKeys: ["admin", "manager"],
    });

    const preview = await manager.query(api.weeklyReport.preview, {});
    expect(preview.marginDays).toBe(30);
    expect(preview.counts.withoutTrace).toBe(0);
  });

  test("lo retirado a la papelera no entra en el resumen", async () => {
    const { t, manager } = await setup();
    // Un aviso duplicado se retiró: su rastro es de la papelera, no del resumen
    // de la semana. Ni cuenta como trabajo tocado ni sale con su referencia.
    const incident = await t.run((ctx) =>
      ctx.db
        .query("incidents")
        .withIndex("by_reference", (q) => q.eq("reference", "INC-0002"))
        .unique(),
    );
    await t.run((ctx) =>
      ctx.db.patch(incident!._id, {
        deletedAt: Date.now(),
        deletedBy: "Elena Vidal",
        purgeAt: Date.now() + 7 * DAY,
      }),
    );

    const preview = await manager.query(api.weeklyReport.preview, {});
    expect(preview.counts.touched).toBe(0);
    expect(preview.text).not.toContain("INC-0002");
  });

  test("quien no coordina no puede ver la vista previa", async () => {
    const { tech } = await setup();
    await expectConvexError(
      tech.query(api.weeklyReport.preview, {}),
      "Solo quien coordina las incidencias o decide las peticiones",
    );
  });
});

describe("weeklyReport.sendNow — enviar el resumen a mano", () => {
  test("sin clave de integraciones no sale, pero queda anotado el motivo", async () => {
    const { t, manager } = await setup();

    const result = await manager.action(api.weeklyReport.sendNow, {});
    expect(result.status).toBe("failed");
    expect(result.error).toContain("VLY_INTEGRATION_KEY");
    expect(result.recipients).toEqual(["admin@taller.es", "coord@taller.es"]);

    const rows = await reportRows(t);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("failed");
    expect(rows[0].error).toContain("VLY_INTEGRATION_KEY");
    expect(rows[0].sentAt).toBeUndefined();
    // El histórico del panel lo enseña.
    const history = await manager.query(api.weeklyReport.history, {});
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("failed");
    expect(history[0].summary).toEqual({
      touched: 1,
      withoutTrace: 1,
      archived: 1,
    });
    // Y «último envío» no miente: no se entregó nada.
    const settings = await manager.query(api.weeklyReport.settings, {});
    expect(settings.lastSentAt).toBe(null);
  });

  test("con la pasarela disponible sale el correo y se anota la entrega", async () => {
    const { t, manager } = await setup();
    process.env.VLY_INTEGRATION_KEY = "sk_test_123";
    const fetchMock = stubGateway();

    const result = await manager.action(api.weeklyReport.sendNow, {});
    expect(result.status).toBe("sent");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(url).toContain("/v1/email/send");
    expect(init.headers.Authorization).toBe("Bearer sk_test_123");
    const payload = JSON.parse(init.body) as {
      to: string[];
      subject: string;
      text: string;
    };
    expect(payload.to).toEqual(["admin@taller.es", "coord@taller.es"]);
    expect(payload.subject).toContain("Resumen semanal del taller");
    expect(payload.text).toContain("SIN CONSTANCIA");

    const rows = await reportRows(t);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("sent");
    expect(rows[0].sentAt).toBeGreaterThan(0);
    expect(rows[0].error).toBeUndefined();

    const settings = await manager.query(api.weeklyReport.settings, {});
    expect(settings.lastSentAt).toBeGreaterThan(0);
    expect(settings.lastSentTo).toEqual(["admin@taller.es", "coord@taller.es"]);
    // Una fila por semana: reenviar el mismo día actualiza, no acumula.
    await manager.action(api.weeklyReport.sendNow, {});
    expect(await reportRows(t)).toHaveLength(1);
  });

  test("sin nadie a quien enviar lo dice en vez de mandar un correo vacío", async () => {
    const { t, manager } = await setup();
    await manager.mutation(api.weeklyReport.setSettings, {
      enabled: true,
      weekday: 1,
      roleKeys: ["technician"],
    });
    // Todos de baja menos quien manda (una cuenta de baja tampoco puede enviar
    // el resumen): ningún rol de la lista tiene ya a nadie a quien escribir.
    await t.run(async (ctx) => {
      const users = await ctx.db.query("users").collect();
      for (const user of users) {
        if (user.email === "coord@taller.es") continue;
        await ctx.db.patch(user._id, { active: false });
      }
    });

    const result = await manager.action(api.weeklyReport.sendNow, {});
    expect(result.status).toBe("failed");
    expect(result.recipients).toEqual([]);
    expect(result.error).toContain("Ningún rol de la lista tiene personas");
    expect(await reportRows(t)).toHaveLength(1);
  });

  test("el técnico no puede mandarlo", async () => {
    const { t, tech } = await setup();

    await expectConvexError(
      tech.action(api.weeklyReport.sendNow, {}),
      "Solo quien coordina las incidencias o decide las peticiones",
    );
    expect(await reportRows(t)).toHaveLength(0);
  });

  test("sin sesión tampoco", async () => {
    const { t } = await setup();

    await expectConvexError(
      t.action(api.weeklyReport.sendNow, {}),
      "Debes iniciar sesión",
    );
    expect(await reportRows(t)).toHaveLength(0);
  });
});

describe("weeklyReport.runScheduled — la pasada del cron", () => {
  test("apagado no envía nada", async () => {
    const { t, manager } = await setup();
    await manager.mutation(api.weeklyReport.setSettings, {
      enabled: false,
      weekday: utcWeekday(Date.now()),
      roleKeys: ["admin", "manager"],
    });

    const result = await t.action(internal.weeklyReport.runScheduled, {});
    expect(result).toEqual({ sent: false, reason: "El resumen está apagado." });
    expect(await reportRows(t)).toHaveLength(0);
  });

  test("otro día de la semana no envía", async () => {
    const { t, manager } = await setup();
    const otroDia = utcWeekday(Date.now()) === 1 ? 2 : 1;
    await manager.mutation(api.weeklyReport.setSettings, {
      enabled: true,
      weekday: otroDia,
      roleKeys: ["admin", "manager"],
    });

    const result = await t.action(internal.weeklyReport.runScheduled, {});
    expect(result).toEqual({
      sent: false,
      reason: "Hoy no es el día configurado.",
    });
    expect(await reportRows(t)).toHaveLength(0);
  });

  test("el día que toca envía y deja el resumen guardado", async () => {
    const { t, manager } = await setup();
    await manager.mutation(api.weeklyReport.setSettings, {
      enabled: true,
      weekday: utcWeekday(Date.now()),
      roleKeys: ["admin", "manager"],
    });
    process.env.VLY_INTEGRATION_KEY = "sk_test_123";
    stubGateway();

    const result = await t.action(internal.weeklyReport.runScheduled, {});
    expect(result.sent).toBe(true);

    const rows = await reportRows(t);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("sent");
    expect(rows[0].recipients).toEqual(["admin@taller.es", "coord@taller.es"]);
  });

  test("el día que toca pero sin clave de integraciones lo deja anotado", async () => {
    const { t, manager } = await setup();
    await manager.mutation(api.weeklyReport.setSettings, {
      enabled: true,
      weekday: utcWeekday(Date.now()),
      roleKeys: ["admin", "manager"],
    });

    const result = await t.action(internal.weeklyReport.runScheduled, {});
    expect(result.sent).toBe(false);
    expect(result.reason).toContain("VLY_INTEGRATION_KEY");

    const rows = await reportRows(t);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("failed");
  });
});
