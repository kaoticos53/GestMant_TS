import "./precalentarModulos";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../src/convex/_generated/api";
import schema from "../src/convex/schema";
import { archivableBefore, requestArchiveDate } from "../src/lib/archive";
import { monthsAgo } from "../src/lib/browse";
import { isRequestInMotion } from "../src/lib/requestFlow";

/** Todos los módulos de funciones de la app (convex-test los levanta in-process). */
const modules = import.meta.glob("../src/convex/**/!(*.*.*)*.*s");

type Test = ReturnType<typeof convexTest>;
type Authed = ReturnType<Test["withIdentity"]>;

const DAY = 24 * 60 * 60 * 1000;

async function setup() {
  const t = convexTest(schema, modules);
  const managerId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Elena Vidal",
      email: "coord@taller.es",
      role: "manager",
    }),
  );
  const techId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Iván Torres",
      email: "tecnico@taller.es",
      role: "technician",
    }),
  );
  const partId = await t.run((ctx) =>
    ctx.db.insert("spareParts", {
      code: "TRI-60004",
      name: "Triac BTA16-600B",
      category: "Electrónica",
      unit: "ud",
      stock: 10,
      minStock: 2,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
  return {
    t,
    manager: t.withIdentity({ subject: `${managerId}|session1` }),
    tech: t.withIdentity({ subject: `${techId}|session1` }),
    managerId,
    techId,
    partId,
  };
}

const reportArgs = {
  reporterName: "Laura Peña",
  reporterRole: "Realización",
  location: "Plató 1",
  equipmentKind: "Cámara de estudio",
  model: "HDC-3500",
  serialNumber: "HDC3500-2505-0147",
  description: "La cámara se apaga sola en directo cuando se mueve el cable.",
  reportedAt: Date.now() - 60 * 60 * 1000,
};

/** Lanza la promesa y comprueba que el ConvexError contiene el texto. */
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
 * Cada aviso de las pruebas va a nombre de una persona distinta: el
 * anti-inundación de `incidents.report` corta dos notificaciones seguidas del
 * mismo notificador, y aquí hacen falta varias incidencias en la misma base.
 */
let avisos = 0;

function avisoDeOtraPersona() {
  avisos += 1;
  return { ...reportArgs, reporterName: `Reportante ${avisos}` };
}

/** Incidencia resuelta in situ: devuelve su id y su referencia. */
async function closedIncident(t: Test, manager: Authed, tech: Authed) {
  const { reference } = await t.mutation(
    api.incidents.report,
    avisoDeOtraPersona(),
  );
  const incident = await incidentByReference(manager, reference);
  expect(incident).toBeDefined();
  await tech.mutation(api.incidents.selfAssign, {
    incidentId: incident!._id,
  });
  await tech.mutation(api.incidents.verify, {
    incidentId: incident!._id,
    outcome: "onsite",
    notes: "Cable de alimentación reinsertado.",
  });
  return { id: incident!._id, reference };
}

async function incidentByReference(authed: Authed, reference: string) {
  const items = await authed.query(api.incidents.list, {
    includeArchived: true,
  });
  return items.find((item) => item.reference === reference);
}

async function requestByReference(authed: Authed, reference: string) {
  const items = await authed.query(api.partRequests.list, {
    includeArchived: true,
  });
  return items.find((item) => item.reference === reference);
}

/** Petición suspendida: sigue en movimiento, así que no está terminada. */
async function onHoldRequest(
  manager: Authed,
  description = "En espera de presupuesto.",
) {
  const reference = await manager.mutation(api.partRequests.create, {
    requesterName: "Iván Torres",
    priority: "normal",
    description,
  });
  const request = await requestByReference(manager, reference);
  expect(request).toBeDefined();
  await manager.mutation(api.partRequests.onHold, {
    requestId: request!._id,
    note: "A la espera del proveedor.",
  });
  return { id: request!._id, reference };
}

/** Petición ya rechazada (decidida, sin tocar stock). */
async function rejectedRequest(manager: Authed, description = "Conector roto.") {
  const reference = await manager.mutation(api.partRequests.create, {
    requesterName: "Iván Torres",
    requesterTeam: "Realización",
    priority: "normal",
    description,
  });
  const request = await requestByReference(manager, reference);
  expect(request).toBeDefined();
  await manager.mutation(api.partRequests.reject, {
    requestId: request!._id,
    note: "No procede.",
  });
  return { id: request!._id, reference };
}

describe("archivo de incidencias", () => {
  test("archivar una cerrada la saca del día a día y la deja en el archivo", async () => {
    const { t, manager, tech } = await setup();
    const { id, reference } = await closedIncident(t, manager, tech);

    await manager.mutation(api.incidents.archive, { incidentId: id });

    // La cola del día a día ya no la ve…
    const active = await manager.query(api.incidents.list, {});
    expect(active.some((item) => item.reference === reference)).toBe(false);

    // …pero sigue en el archivo, con quién la archivó y su traza.
    const archived = await incidentByReference(manager, reference);
    expect(archived?.archivedAt).toBeTypeOf("number");
    expect(archived?.archivedBy).toBe("Elena Vidal");
    expect(archived?.status).toBe("resolved");
    expect(archived?.history.at(-1)?.note).toBe("Archivada");

    // Archivar dos veces la misma incidencia no es un error.
    await manager.mutation(api.incidents.archive, { incidentId: id });
    expect(
      (await incidentByReference(manager, reference))?.history.filter(
        (entry) => entry.note === "Archivada",
      ),
    ).toHaveLength(1);
  });

  test("no se archiva lo que sigue abierto", async () => {
    const { t, manager, tech } = await setup();
    const { reference } = await t.mutation(api.incidents.report, reportArgs);
    const incident = await incidentByReference(manager, reference);

    await expectConvexError(
      manager.mutation(api.incidents.archive, { incidentId: incident!._id }),
      "Solo se pueden archivar incidencias cerradas",
    );
    // El técnico tampoco puede: la incidencia sigue en su cola.
    expect(await tech.query(api.incidents.list, {})).toHaveLength(1);
  });

  test("solo el coordinador archiva y recupera", async () => {
    const { t, manager, tech } = await setup();
    const { id } = await closedIncident(t, manager, tech);

    await expectConvexError(
      tech.mutation(api.incidents.archive, { incidentId: id }),
      "Solo el coordinador puede archivar incidencias",
    );
    await manager.mutation(api.incidents.archive, { incidentId: id });
    await expectConvexError(
      tech.mutation(api.incidents.unarchive, { incidentId: id }),
      "Solo el coordinador puede archivar incidencias",
    );
  });

  test("recuperar del archivo la devuelve a la cola", async () => {
    const { t, manager, tech } = await setup();
    const { id, reference } = await closedIncident(t, manager, tech);
    await manager.mutation(api.incidents.archive, { incidentId: id });

    await manager.mutation(api.incidents.unarchive, { incidentId: id });

    const active = await manager.query(api.incidents.list, {});
    expect(active.some((item) => item.reference === reference)).toBe(true);
    const restored = await incidentByReference(manager, reference);
    expect(restored?.archivedAt).toBeUndefined();
    expect(restored?.history.at(-1)?.note).toBe("Recuperada del archivo");
  });

  test("el archivado masivo solo toca lo cerrado y anterior al corte", async () => {
    const { t, manager, tech } = await setup();
    const old = await closedIncident(t, manager, tech);
    const recent = await closedIncident(t, manager, tech);
    const { reference: openReference } = await t.mutation(
      api.incidents.report,
      avisoDeOtraPersona(),
    );
    const open = await incidentByReference(manager, openReference);

    // La antigua se cerró hace dos meses; la reciente, ahora mismo.
    await t.run((ctx) =>
      ctx.db.patch(old.id, { closedAt: Date.now() - 60 * DAY }),
    );

    const archived = await manager.mutation(api.incidents.archiveClosedBefore, {
      before: Date.now() - 30 * DAY,
    });
    expect(archived).toBe(1);
    expect((await incidentByReference(manager, old.reference))?.archivedAt).toBeTypeOf(
      "number",
    );
    expect(
      (await incidentByReference(manager, recent.reference))?.archivedAt,
    ).toBeUndefined();
    expect(
      (await incidentByReference(manager, open!.reference))?.archivedAt,
    ).toBeUndefined();

    // Segunda pasada: ya no queda nada que archivar con ese corte.
    expect(
      await manager.mutation(api.incidents.archiveClosedBefore, {
        before: Date.now() - 30 * DAY,
      }),
    ).toBe(0);
  });

  test("lo retirado no se archiva: espera en la papelera, no en el archivo", async () => {
    const { t, manager, tech } = await setup();
    const retirada = await closedIncident(t, manager, tech);
    const viva = await closedIncident(t, manager, tech);
    // Un duplicado cerrado por error se retira a la papelera…
    await manager.mutation(api.incidents.withdraw, {
      incidentId: retirada.id,
      reason: "Duplicada",
    });

    // …y con el mismo corte la limpieza a mano se lleva solo la otra: sacar de
    // la papelera lo retirado lo escondería de la pantalla que lo guarda.
    expect(
      await manager.mutation(api.incidents.archiveClosedBefore, {
        before: Date.now() + DAY,
      }),
    ).toBe(1);
    expect(
      (await t.run((ctx) => ctx.db.get(retirada.id)))?.archivedAt,
    ).toBeUndefined();
    expect(
      (await t.run((ctx) => ctx.db.get(viva.id)))?.archivedAt,
    ).toBeTypeOf("number");

    // Y la pasada de la noche tampoco la toca.
    expect(await t.mutation(internal.archive.runAutoArchive, {})).toBe(0);
    expect(
      (await t.run((ctx) => ctx.db.get(retirada.id)))?.archivedAt,
    ).toBeUndefined();
  });

  test("sin sesión no hay cola ni archivo: las listas llegan vacías", async () => {
    // El panel pide las dos listas al montar: sin sesión degradan a vacío en
    // vez de tumbar la pantalla (las acciones de archivar sí exigen cuenta).
    const { t } = await setup();
    expect(
      await t.query(api.incidents.list, { includeArchived: true }),
    ).toEqual([]);
    expect(await t.query(api.partRequests.list, {})).toEqual([]);
  });
});

describe("archivo de peticiones", () => {
  test("archivar una decidida la saca del día a día y la deja en el archivo", async () => {
    const { manager } = await setup();
    const { id, reference } = await rejectedRequest(manager);

    await manager.mutation(api.partRequests.archive, { requestId: id });

    const active = await manager.query(api.partRequests.list, {});
    expect(active.some((item) => item.reference === reference)).toBe(false);

    const archived = await requestByReference(manager, reference);
    expect(archived?.archivedAt).toBeTypeOf("number");
    expect(archived?.archivedBy).toBe("Elena Vidal");
    expect(archived?.status).toBe("rejected");

    await manager.mutation(api.partRequests.archive, { requestId: id });
    expect(
      (await requestByReference(manager, reference))?.archivedAt,
    ).toBeTypeOf("number");
  });

  test("una petición pendiente no se archiva", async () => {
    const { manager } = await setup();
    const reference = await manager.mutation(api.partRequests.create, {
      requesterName: "Iván Torres",
      priority: "normal",
      description: "Pendiente de revisar.",
    });
    const request = await requestByReference(manager, reference);

    await expectConvexError(
      manager.mutation(api.partRequests.archive, { requestId: request!._id }),
      "sigue en movimiento",
    );
    expect(await manager.query(api.partRequests.list, {})).toHaveLength(1);
  });

  test("solo quien decide peticiones archiva y recupera", async () => {
    const { manager, tech } = await setup();
    const { id } = await rejectedRequest(manager);

    await expectConvexError(
      tech.mutation(api.partRequests.archive, { requestId: id }),
      "No tienes permisos para archivar peticiones",
    );
    await manager.mutation(api.partRequests.archive, { requestId: id });
    await expectConvexError(
      tech.mutation(api.partRequests.unarchive, { requestId: id }),
      "No tienes permisos para recuperar peticiones",
    );
  });

  test("recuperar la devuelve a la cola", async () => {
    const { manager } = await setup();
    const { id, reference } = await rejectedRequest(manager);
    await manager.mutation(api.partRequests.archive, { requestId: id });

    await manager.mutation(api.partRequests.unarchive, { requestId: id });

    const active = await manager.query(api.partRequests.list, {});
    expect(active.some((item) => item.reference === reference)).toBe(true);
    expect((await requestByReference(manager, reference))?.archivedAt).toBeUndefined();
  });

  test("la petición archivada no pierde su enlace con el equipo", async () => {
    const { manager, partId } = await setup();
    const reference = await manager.mutation(api.partRequests.create, {
      requesterName: "Iván Torres",
      equipment: "Cámara de estudio HDC-3500",
      priority: "urgent",
      lines: [{ sparePartId: partId, quantity: 1 }],
    });
    const request = await requestByReference(manager, reference);
    await manager.mutation(api.partRequests.approve, {
      requestId: request!._id,
    });
    await manager.mutation(api.partRequests.archive, {
      requestId: request!._id,
    });

    // Con `includeArchived` la ficha del equipo sigue encontrando la petición.
    const withArchive = await manager.query(api.partRequests.list, {
      includeArchived: true,
    });
    expect(withArchive.some((item) => item.reference === reference)).toBe(true);
  });

  test("el archivado masivo deja fuera solo lo decidido y anterior al corte", async () => {
    const { t, manager } = await setup();
    const old = await rejectedRequest(manager, "Conector antiguo.");
    const recent = await rejectedRequest(manager, "Conector reciente.");
    const pendingReference = await manager.mutation(api.partRequests.create, {
      requesterName: "Iván Torres",
      priority: "low",
      description: "Todavía sin decidir.",
    });

    // La antigua se decidió hace dos meses; la reciente, ahora mismo.
    await t.run((ctx) =>
      ctx.db.patch(old.id, { decidedAt: Date.now() - 60 * DAY }),
    );

    const archived = await manager.mutation(
      api.partRequests.archiveDecidedBefore,
      { before: Date.now() - 30 * DAY },
    );
    expect(archived).toBe(1);
    expect((await requestByReference(manager, old.reference))?.archivedAt).toBeTypeOf(
      "number",
    );
    expect(
      (await requestByReference(manager, recent.reference))?.archivedAt,
    ).toBeUndefined();
    expect(
      (await requestByReference(manager, pendingReference))?.archivedAt,
    ).toBeUndefined();
  });
});

describe("archivado automático", () => {
  /** Incidencia cerrada y petición rechazada, ambas de hace dos meses. */
  async function agedRecords(t: Test, manager: Authed, tech: Authed) {
    const incident = await closedIncident(t, manager, tech);
    const request = await rejectedRequest(manager, "Conector antiguo.");
    const old = Date.now() - 60 * DAY;
    await t.run((ctx) => ctx.db.patch(incident.id, { closedAt: old }));
    await t.run((ctx) => ctx.db.patch(request.id, { decidedAt: old }));
    return { incident, request };
  }

  test("sin ajustes guardados rige el comportamiento por defecto", async () => {
    const { manager } = await setup();
    const settings = await manager.query(api.archive.settings, {});
    expect(settings.enabled).toBe(true);
    expect(settings.afterMonths).toBe(12);
    expect(settings.lastRunAt).toBeNull();
  });

  test("la pasada nocturna archiva solo lo terminado y anterior al corte", async () => {
    const { t, manager, tech } = await setup();
    const { incident, request } = await agedRecords(t, manager, tech);
    const recent = await closedIncident(t, manager, tech);
    const pendingReference = await manager.mutation(api.partRequests.create, {
      requesterName: "Iván Torres",
      priority: "normal",
      description: "Pendiente de decidir.",
    });
    await manager.mutation(api.archive.setSettings, {
      enabled: true,
      afterMonths: 1,
    });

    // La pasada del cron (función interna) devuelve cuánto archivó.
    const archived = await t.mutation(internal.archive.runAutoArchive, {});
    expect(archived).toBe(2);

    expect((await incidentByReference(manager, incident.reference))?.archivedAt).toBeTypeOf(
      "number",
    );
    expect((await incidentByReference(manager, incident.reference))?.archivedBy).toBe(
      "Archivado automático",
    );
    expect((await requestByReference(manager, request.reference))?.archivedAt).toBeTypeOf(
      "number",
    );
    // Lo reciente y lo que sigue abierto se quedan en el día a día.
    expect(
      (await incidentByReference(manager, recent.reference))?.archivedAt,
    ).toBeUndefined();
    expect(
      (await requestByReference(manager, pendingReference))?.archivedAt,
    ).toBeUndefined();

    // Y queda anotada la última pasada.
    const settings = await manager.query(api.archive.settings, {});
    expect(settings.lastRunAt).toBeTypeOf("number");
    expect(settings.lastRunArchived).toBe(2);
  });

  test("con el automático apagado la pasada nocturna no toca nada", async () => {
    const { t, manager, tech } = await setup();
    const { incident } = await agedRecords(t, manager, tech);
    await manager.mutation(api.archive.setSettings, {
      enabled: false,
      afterMonths: 1,
    });

    expect(await t.mutation(internal.archive.runAutoArchive, {})).toBe(0);
    expect((await incidentByReference(manager, incident.reference))?.archivedAt).toBeUndefined();
    expect((await manager.query(api.archive.settings, {})).lastRunAt).toBeNull();
  });

  test("«ejecutar ahora» funciona con el automático apagado y no lo anota como pasada", async () => {
    const { t, manager, tech } = await setup();
    const { incident, request } = await agedRecords(t, manager, tech);
    await manager.mutation(api.archive.setSettings, {
      enabled: false,
      afterMonths: 1,
    });

    const result = await manager.mutation(api.archive.runNow, {});
    expect(result.total).toBe(2);
    expect(result.incidents).toBe(1);
    expect(result.requests).toBe(1);
    expect((await incidentByReference(manager, incident.reference))?.archivedBy).toBe(
      "Elena Vidal",
    );
    expect((await requestByReference(manager, request.reference))?.archivedAt).toBeTypeOf(
      "number",
    );
    // Es una acción manual: no falsea «última limpieza automática».
    expect((await manager.query(api.archive.settings, {})).lastRunAt).toBeNull();
  });

  test("una petición en espera no se archiva, ni a mano ni con la pasada", async () => {
    const { t, manager } = await setup();
    const held = await onHoldRequest(manager, "En espera desde hace meses.");
    // Antigua, pero sin terminar: lleva dos meses en espera.
    await t.run((ctx) =>
      ctx.db.patch(held.id, { holdSinceAt: Date.now() - 60 * DAY }),
    );
    await manager.mutation(api.archive.setSettings, {
      enabled: true,
      afterMonths: 1,
    });

    // Ni a mano ni con la limpieza masiva: está en movimiento.
    await expectConvexError(
      manager.mutation(api.partRequests.archive, { requestId: held.id }),
      "sigue en movimiento",
    );
    expect(
      await manager.mutation(api.partRequests.archiveDecidedBefore, {
        before: Date.now() - 30 * DAY,
      }),
    ).toBe(0);
    // Ni la pasada de la noche.
    expect(await t.mutation(internal.archive.runAutoArchive, {})).toBe(0);
    expect(
      (await requestByReference(manager, held.reference))?.archivedAt,
    ).toBeUndefined();
  });

  test("lo que cuenta la pantalla es lo que archiva la pasada", async () => {
    const { t, manager, tech } = await setup();
    const { incident, request } = await agedRecords(t, manager, tech);
    const recent = await closedIncident(t, manager, tech);
    const held = await onHoldRequest(manager, "En espera desde hace meses.");
    await t.run((ctx) =>
      ctx.db.patch(recent.id, { closedAt: Date.now() - DAY }),
    );
    await t.run((ctx) =>
      ctx.db.patch(held.id, { holdSinceAt: Date.now() - 60 * DAY }),
    );
    await manager.mutation(api.archive.setSettings, {
      enabled: true,
      afterMonths: 1,
    });

    // La cuenta que enseña «Ajustes del taller»: la cola viva y el corte que
    // sale del ajuste guardado.
    const predicted = archivableBefore({
      incidents: await manager.query(api.incidents.list, {}),
      requests: await manager.query(api.partRequests.list, {}),
      before: monthsAgo(1),
    });
    expect(predicted).toEqual({ incidents: 1, requests: 1, total: 2 });

    // Y la pasada archiva exactamente eso: lo que dice el número.
    expect(await t.mutation(internal.archive.runAutoArchive, {})).toBe(
      predicted.total,
    );
    expect(
      (await incidentByReference(manager, incident.reference))?.archivedAt,
    ).toBeTypeOf("number");
    expect(
      (await requestByReference(manager, request.reference))?.archivedAt,
    ).toBeTypeOf("number");
  });

  test("la antigüedad tiene que ser razonable", async () => {
    const { manager } = await setup();
    await expectConvexError(
      manager.mutation(api.archive.setSettings, {
        enabled: true,
        afterMonths: 0,
      }),
      "entre 1 y 120 meses",
    );
    await expectConvexError(
      manager.mutation(api.archive.setSettings, {
        enabled: true,
        afterMonths: 240,
      }),
      "entre 1 y 120 meses",
    );
  });

  test("solo quien coordina ajusta el archivado automático", async () => {
    const { t, tech } = await setup();
    await expectConvexError(
      tech.query(api.archive.settings, {}),
      "Solo quien coordina las incidencias o decide las peticiones",
    );
    await expectConvexError(
      tech.mutation(api.archive.setSettings, {
        enabled: true,
        afterMonths: 6,
      }),
      "Solo quien coordina las incidencias o decide las peticiones",
    );
    await expectConvexError(
      tech.mutation(api.archive.runNow, {}),
      "Solo quien coordina las incidencias o decide las peticiones",
    );
    await expectConvexError(
      t.query(api.archive.settings, {}),
      "Debes iniciar sesión",
    );
  });

  test("los ajustes guardados se leen tal cual", async () => {
    const { manager } = await setup();
    await manager.mutation(api.archive.setSettings, {
      enabled: false,
      afterMonths: 24,
    });
    const settings = await manager.query(api.archive.settings, {});
    expect(settings).toMatchObject({
      enabled: false,
      afterMonths: 24,
      updatedBy: "Elena Vidal",
    });
  });
});

describe("reglas del archivo — qué entra y qué no", () => {
  test("una petición en espera sigue en movimiento", () => {
    expect(isRequestInMotion("onHold")).toBe(true);
    expect(isRequestInMotion("pending")).toBe(true);
    // Lo ya decidido o entregado sí se puede archivar cuando toca.
    expect(isRequestInMotion("issued")).toBe(false);
    expect(isRequestInMotion("rejected")).toBe(false);
  });

  test("la antigüedad de una petición la fija lo último que le pasó", () => {
    expect(
      requestArchiveDate({
        status: "issued",
        createdAt: 1,
        decidedAt: 2,
        issuedAt: 3,
      }),
    ).toBe(3);
    expect(
      requestArchiveDate({
        status: "pendingSupplierQuote",
        createdAt: 1,
        quoteRequestedAt: 5,
      }),
    ).toBe(5);
    expect(requestArchiveDate({ status: "approved", createdAt: 1, decidedAt: 2 })).toBe(2);
    // Sin nada más, manda el alta.
    expect(requestArchiveDate({ status: "approved", createdAt: 1 })).toBe(1);
  });

  test("solo cuenta lo terminado y sin movimiento reciente", () => {
    const counts = archivableBefore({
      incidents: [
        { status: "resolved", updatedAt: 10, closedAt: 5 },
        { status: "resolved", updatedAt: 90 },
        { status: "workshop", updatedAt: 5 },
        { status: "resolved", updatedAt: 5, archivedAt: 2 },
      ],
      requests: [
        { status: "issued", createdAt: 1, issuedAt: 5 },
        { status: "pending", createdAt: 1 },
        { status: "onHold", createdAt: 1, holdSinceAt: 2 },
        { status: "rejected", createdAt: 1, decidedAt: 80 },
      ],
      before: 50,
    });
    expect(counts).toEqual({ incidents: 1, requests: 1, total: 2 });
  });
});
