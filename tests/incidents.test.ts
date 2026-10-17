import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api, internal } from "../src/convex/_generated/api";
import type { Id } from "../src/convex/_generated/dataModel";
import schema from "../src/convex/schema";
import {
  auditPresetRange,
  dayFromInput,
  dayInputValue,
  endOfDay,
} from "../src/lib/audit";
import { richDocBlocks, richDocToPlainText } from "../src/lib/richDoc";
import {
  LOOKUP_LIMIT_PER_HOUR,
  LOOKUP_WINDOW_MS,
  expiredBefore,
} from "../src/lib/publicLookup";
import { DEFAULT_TRASH_RETENTION_DAYS } from "../src/lib/trash";
import { noteRestoreUndoIndex, noteVersionChanges } from "../src/lib/workshop";

/** Todos los módulos de funciones de la app (convex-test los levanta in-process). */
const modules = import.meta.glob("../src/convex/**/!(*.*.*)*.*s");

type Authed = ReturnType<ReturnType<typeof convexTest>["withIdentity"]>;

async function setup() {
  const t = convexTest(schema, modules);
  const coordinatorId = await t.run((ctx) =>
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
  const equipmentId = await t.run((ctx) =>
    ctx.db.insert("equipment", {
      code: "EQ-901",
      name: "Cámara de estudio",
      model: "HDC-3500",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
  return {
    t,
    coordinator: t.withIdentity({ subject: `${coordinatorId}|session1` }),
    tech: t.withIdentity({ subject: `${techId}|session1` }),
    coordinatorId,
    techId,
    equipmentId,
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
  expect(
    error,
    `Se esperaba un error que contuviera: ${fragment}`,
  ).not.toBeNull();
  const message =
    error instanceof ConvexError ? String(error.data) : String(error);
  expect(message).toContain(fragment);
}

/** Primera incidencia de la cola (la más reciente primero). */
async function firstIncident(authed: Authed) {
  const list = await authed.query(api.incidents.list, {});
  expect(list.length).toBeGreaterThan(0);
  return list[0];
}

/** Id del técnico con rol `technician` (para asignaciones del coordinador). */
async function techUser(authed: Authed) {
  const users = await authed.query(api.members.listAssignable, {});
  const user = users.find((item) => item.role === "technician");
  expect(user).toBeDefined();
  return user!;
}

describe("reporte público de incidencias", () => {
  test("cualquiera puede notificar sin sesión y se avisa a coordinadores", async () => {
    const { t, coordinator } = await setup();

    // Sin identidad: el formulario público no requiere registro
    const { reference, code } = await t.mutation(
      api.incidents.report,
      reportArgs,
    );
    expect(reference).toBe("INC-0001");

    const incident = await firstIncident(coordinator);
    // Y salen dos identificadores del mismo caso: la referencia con la que el
    // taller lo cita y el código con el que lo sigue quien avisó.
    expect(incident.publicCode).toBe(code);
    expect(incident.status).toBe("reported");
    expect(incident.reporterName).toBe("Laura Peña");
    expect(incident.history).toHaveLength(1);
    expect(incident.history[0].status).toBe("reported");

    // El coordinador recibe la notificación del aviso
    const notifications = await coordinator.query(api.notifications.list, {});
    expect(notifications.some((item) => item.text.includes("INC-0001"))).toBe(
      true,
    );
    expect(notifications[0].read).toBe(false);
  });

  test("la referencia nueva no repite una del histórico más antiguo", async () => {
    const { t } = await setup();
    // Un histórico largo: cuanto más alta la referencia, más vieja la fecha, así
    // que la más alta queda fuera de las últimas 100 por fecha de creación. El
    // aviso nuevo tiene que contar desde ahí y no reutilizar un número ya dado:
    // con la referencia repetida, quien la recibió no sabría qué caso sigue.
    const DAY = 24 * 60 * 60 * 1000;
    for (let n = 1; n <= 120; n += 1) {
      const at = Date.now() - n * DAY;
      await t.run((ctx) =>
        ctx.db.insert("incidents", {
          reference: `INC-${String(n).padStart(4, "0")}`,
          reporterName: "Muestra del histórico",
          description: "Incidencia de la muestra.",
          reportedAt: at,
          status: "reported",
          history: [{ status: "reported", at, by: "Muestra del histórico" }],
          createdAt: at,
          updatedAt: at,
        }),
      );
    }

    expect((await t.mutation(api.incidents.report, reportArgs)).reference).toBe(
      "INC-0121",
    );

    // Y ninguna referencia queda repetida.
    const incidents = await t.run((ctx) => ctx.db.query("incidents").collect());
    const references = incidents.map((item) => item.reference);
    expect(new Set(references).size).toBe(references.length);
  });

  test("valida los campos mínimos y la fecha", async () => {
    const { t } = await setup();
    await expectConvexError(
      t.mutation(api.incidents.report, { ...reportArgs, reporterName: " " }),
      "Indica tu nombre y apellidos.",
    );
    await expectConvexError(
      t.mutation(api.incidents.report, { ...reportArgs, description: "corta" }),
      "Describe la incidencia",
    );
    // La descripción puede venir del editor con formato: el mínimo se cuenta
    // sobre lo que dice, no sobre las etiquetas.
    await expectConvexError(
      t.mutation(api.incidents.report, {
        ...reportArgs,
        description: "<p>corta</p>",
      }),
      "Describe la incidencia",
    );
    await expectConvexError(
      t.mutation(api.incidents.report, {
        ...reportArgs,
        reportedAt: Date.now() + 3 * 24 * 60 * 60 * 1000,
      }),
      "La fecha de notificación no puede ser futura.",
    );
  });

  test("admite la notificación sin modelo ni tipo de equipo", async () => {
    const { t } = await setup();
    const created = await t.mutation(api.incidents.report, {
      ...reportArgs,
      equipmentKind: undefined,
      model: undefined,
    });
    expect(created.reference).toBe("INC-0001");
    const incident = await t.run(async (ctx) =>
      ctx.db
        .query("incidents")
        .withIndex("by_reference", (q) => q.eq("reference", "INC-0001"))
        .first(),
    );
    expect(incident?.equipmentKind).toBeUndefined();
    expect(incident?.model).toBeUndefined();
  });

  test("el freno de 30 segundos corta a quien repite, no a otra persona", async () => {
    const { t } = await setup();

    expect((await t.mutation(api.incidents.report, reportArgs)).reference).toBe(
      "INC-0001",
    );
    // El mismo nombre —aunque cambie de mayúsculas— no vuelve a colar dentro de
    // la ventana: el formulario público es una puerta abierta y sin el freno una
    // misma persona podría inundar la cola.
    await expectConvexError(
      t.mutation(api.incidents.report, {
        ...reportArgs,
        reporterName: "laura peña",
      }),
      "espera 30 segundos",
    );
    // Otra persona sí notifica en el mismo momento: el freno es de quien
    // escribe, no de la cola entera.
    expect(
      (
        await t.mutation(api.incidents.report, {
          ...reportArgs,
          reporterName: "Marta Ruiz",
        })
      ).reference,
    ).toBe("INC-0002");
  });

  test("sin sesión la cola llega vacía, no con un error", async () => {
    // El panel pide esta lista al montar: sin sesión o como invitado degrada a
    // vacío en vez de tumbar la pantalla (las acciones sí exigen cuenta).
    const { t } = await setup();
    expect(await t.query(api.incidents.list, {})).toEqual([]);
  });
});

describe("consulta de una incidencia: la referencia del taller y el código de fuera", () => {
  /** La incidencia notificada sin sesión, como llega desde `/reportar`. */
  async function reported() {
    const contexto = await setup();
    const { reference, code } = await contexto.t.mutation(
      api.incidents.report,
      reportArgs,
    );
    const [incident] = await contexto.coordinator.query(api.incidents.list, {});
    return {
      ...contexto,
      reference,
      code,
      incident,
      incidentId: incident._id,
    };
  }

  test("cada incidencia sale con un código propio, del alfabeto y sin relación con el número", async () => {
    const { t, coordinator, code, incident } = await reported();

    // Ocho caracteres del alfabeto sin letras que se confundan, y guardado en la
    // ficha: es lo que se le enseña a quien notificó y con lo que se consulta.
    expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
    expect(incident.publicCode).toBe(code);

    // Dos avisos seguidos no comparten código: si se repitieran, uno de los dos
    // seguiría el caso del otro.
    const otro = await t.mutation(api.incidents.report, {
      ...reportArgs,
      reporterName: "Marta Ruiz",
    });
    expect(otro.code).not.toBe(code);
    expect(otro.reference).toBe("INC-0002");

    // El taller ve el mismo código en la ficha, que es lo que se dicta cuando
    // alguien llama preguntando por su caso.
    const [latest] = await coordinator.query(api.incidents.list, {});
    expect(latest.publicCode).toBe(otro.code);
  });

  test("se encuentra tecleando la referencia como sea: copiada, en minúsculas o el número suelto", async () => {
    const { coordinator, code } = await reported();

    // Las formas que alguien escribe de verdad: la que le dieron, sin el prefijo
    // o con el prefijo en minúsculas.
    for (const typed of ["INC-0001", "inc-1", "1", " incidencia 1 "]) {
      const tracking = await coordinator.query(api.incidents.byReference, {
        reference: typed,
      });
      expect(tracking?.code, `«${typed}»`).toBe(code);
      expect(tracking?.status, `«${typed}»`).toBe("reported");
      // La descripción viaja tal cual (el editor la guarda como documento),
      // pero se lee igual: es lo que contó quien notificó la avería.
      expect(richDocToPlainText(tracking?.description), `«${typed}»`).toBe(
        reportArgs.description,
      );
    }
  });

  test("devuelve el seguimiento, no el expediente del taller", async () => {
    const { coordinator, reference, incidentId, techId } = await reported();

    // El cuaderno se llena: quién la lleva, una nota interna y un documento del
    // expediente. Nada de eso es cosa de quien notificó la avería.
    await coordinator.mutation(api.incidents.assign, {
      incidentId,
      assigneeId: techId,
    });
    await coordinator.mutation(api.incidents.addNote, {
      incidentId,
      note: "Se habló con el proveedor; el módulo no llega hasta el jueves.",
    });
    await coordinator.mutation(api.incidents.attachDocument, {
      incidentId,
      name: "Presupuesto.pdf",
    });

    const tracking = await coordinator.query(api.incidents.byReference, {
      reference,
    });
    expect(tracking).not.toBeNull();

    // Lo que sale es una lista de campos explícita, no «todo menos esto»: una
    // columna nueva del esquema no se cuela sola en el seguimiento. Y sale el
    // código, no la referencia: fuera del taller el caso se llama por el código.
    expect(Object.keys(tracking!).sort()).toEqual([
      "assigneeName",
      "closedAt",
      "code",
      "description",
      "equipmentKind",
      "history",
      "location",
      "model",
      "pendingParts",
      "reportedAt",
      "serialNumber",
      "status",
      "workshopAssigneeName",
    ]);
    expect(tracking).not.toHaveProperty("notes");
    expect(tracking).not.toHaveProperty("lifecycleNotes");
    expect(tracking).not.toHaveProperty("documents");
    // Quién notificó la avería tampoco: el caso se sigue por la referencia.
    expect(tracking).not.toHaveProperty("reporterName");
    expect(tracking!.assigneeName).toBe("Iván Torres");
  });

  test("el paso a paso llega con su fecha, pero sin quién lo dio ni lo que se anotó", async () => {
    const { coordinator, reference, incidentId, techId } = await reported();
    const before = Date.now();
    await coordinator.mutation(api.incidents.assign, {
      incidentId,
      assigneeId: techId,
    });

    const tracking = await coordinator.query(api.incidents.byReference, {
      reference,
    });
    expect(tracking!.history.map((entry) => entry.status)).toEqual([
      "reported",
      "assigned",
    ]);
    for (const entry of tracking!.history) {
      expect(Object.keys(entry).sort()).toEqual(["at", "status"]);
    }
    // La fecha de la notificación es la que se le dio al avisar, y la del paso
    // nuevo la de ahora: el seguimiento se lee en orden.
    expect(tracking!.history[0].at).toBe(reportArgs.reportedAt);
    expect(tracking!.history[1].at).toBeGreaterThanOrEqual(before);
  });

  test("una referencia que no existe, o que no lleva número, no devuelve nada", async () => {
    const { coordinator } = await reported();

    // No hay ninguna con ese número…
    expect(
      await coordinator.query(api.incidents.byReference, {
        reference: "INC-9999",
      }),
    ).toBeNull();
    // …y sin ningún número no hay nada que buscar: se dice, no se busca a ciegas.
    for (const typed of ["", "   ", "la de la cámara"]) {
      expect(
        await coordinator.query(api.incidents.byReference, {
          reference: typed,
        }),
        `«${typed}»`,
      ).toBeNull();
    }
  });

  test("la referencia interna no es un código: por ahí no se consulta desde fuera", async () => {
    const { coordinator, reference } = await reported();

    // Lo que sí vale para el taller…
    expect(
      await coordinator.query(api.incidents.byReference, { reference }),
    ).not.toBeNull();
    // …no vale para la puerta de fuera: es un correlativo y quien tuviera una
    // sesión de invitado podría ir probando «1», «2», «3»…
    expect(
      await coordinator.mutation(api.incidents.byCode, { code: reference }),
    ).toBeNull();
  });

  test("una referencia repetida en datos viejos contesta en vez de reventar", async () => {
    const { t, coordinator } = await setup();
    // Lo que dejó una generación anterior y una muestra cargada encima: dos
    // incidencias con el mismo número, cada una con su código. La consulta tiene
    // que resolverse con una —la más antigua—, no tumbar la pantalla de quien
    // tecleó su referencia.
    for (const [reporterName, publicCode] of [
      ["Laura Peña", "AAAA2222"],
      ["Marcos Vega", "BBBB3333"],
    ] as const) {
      await t.run((ctx) =>
        ctx.db.insert("incidents", {
          reference: "INC-0007",
          publicCode,
          reporterName,
          description: "Duplicada a propósito.",
          reportedAt: Date.now(),
          status: "reported",
          history: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
      );
    }

    const tracking = await coordinator.query(api.incidents.byReference, {
      reference: "7",
    });
    // La primera que se insertó, con su código: es la que contesta.
    expect(tracking?.code).toBe("AAAA2222");
    expect(tracking?.status).toBe("reported");
    // Y el código sí distingue las dos: quien lo tenga consulta la suya sin
    // depender de un número repetido.
    const porCodigo = await coordinator.mutation(api.incidents.byCode, {
      code: "BBBB-3333",
    });
    expect(porCodigo?.code).toBe("BBBB3333");
  });

  test("la puerta de fuera es pública: con el código se sigue el caso sin haber entrado", async () => {
    const { t, code } = await reported();

    // Quien recibió el código no tiene cuenta: el buscador de la portada y el
    // enlace del correo los usa gente que no ha entrado nunca. Lo que cierra esta
    // puerta es el código —se reparte al azar, no se adivina—, no una sesión.
    const tracking = await t.mutation(api.incidents.byCode, { code });
    expect(tracking?.code).toBe(code);
    expect(tracking?.status).toBe("reported");

    // Y que la puerta esté abierta no la convierte en el expediente: lo de dentro
    // del taller sigue sin salir por aquí.
    expect(tracking).not.toHaveProperty("notes");
    expect(tracking).not.toHaveProperty("lifecycleNotes");
    expect(tracking).not.toHaveProperty("documents");
    expect(tracking).not.toHaveProperty("reference");
  });

  test("el seguimiento dice qué falta: el repuesto, la cantidad y desde cuándo", async () => {
    const { t, coordinator, tech, code, incidentId } = await reported();
    const [fuente, filtro] = await t.run(async (ctx) => [
      await ctx.db.insert("spareParts", {
        code: "ALI-12024",
        name: "Fuente de alimentación 12 V",
        category: "Alimentación",
        unit: "ud",
        stock: 5,
        minStock: 1,
        supplier: "ElectroSuministros S.L.",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
      await ctx.db.insert("spareParts", {
        code: "FIL-00042",
        name: "Filtro de aire",
        category: "Consumibles",
        unit: "ud",
        stock: 5,
        minStock: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    ]);

    const reference = await tech.mutation(api.partRequests.create, {
      requesterName: "Iván Torres",
      priority: "urgent",
      incidentId,
      lines: [
        { sparePartId: fuente, quantity: 2 },
        { sparePartId: filtro, quantity: 1 },
      ],
    });

    const tracking = await t.mutation(api.incidents.byCode, { code });
    // Lo que falta, en concreto: por línea, con su cantidad y la fecha en que se
    // pidió —que es lo que responde a «¿desde cuándo?»—.
    expect(tracking?.pendingParts).toEqual([
      {
        name: "Fuente de alimentación 12 V",
        quantity: 2,
        since: expect.any(Number),
      },
      { name: "Filtro de aire", quantity: 1, since: expect.any(Number) },
    ]);
    // Y nada de la petición que sea del taller: ni su referencia, ni quién la
    // hizo, ni el proveedor o el precio. El nombre del repuesto sí —es lo que
    // hace concreta la espera—.
    const serializado = JSON.stringify(tracking);
    expect(serializado).not.toContain(reference);
    expect(serializado).not.toContain("Iván Torres");
    expect(serializado).not.toContain("ElectroSuministros");
    expect(tracking!.pendingParts[0]).not.toHaveProperty("code");

    // Entregado el material, deja de faltar: la petición sale de la lista aunque
    // siga viva en el módulo de peticiones.
    const [pedido] = await coordinator.query(api.partRequests.list, {});
    await coordinator.mutation(api.partRequests.approve, {
      requestId: pedido._id,
    });
    await coordinator.mutation(api.partRequests.markIssued, {
      requestId: pedido._id,
    });
    expect(
      (await t.mutation(api.incidents.byCode, { code }))?.pendingParts,
    ).toEqual([]);
  });

  test("una petición sin líneas no deja el hueco: el seguimiento no inventa repuestos", async () => {
    const { t, coordinator, tech, techId, code, incidentId } = await reported();
    // El caso ya está en manos de un técnico, que es cuando tiene sentido pedir
    // material para él.
    await coordinator.mutation(api.incidents.assign, {
      incidentId,
      assigneeId: techId,
    });
    // Se abrió describiendo la avería; el repuesto se asocia después. Lo que no
    // hay no se puede enseñar, y el seguimiento no se lo inventa.
    await tech.mutation(api.partRequests.create, {
      requesterName: "Iván Torres",
      priority: "normal",
      incidentId,
      description: "Conector de alimentación, todavía sin referencia.",
    });

    const tracking = await t.mutation(api.incidents.byCode, { code });
    expect(tracking?.pendingParts).toEqual([]);
    // El caso sí queda esperando el material: lo que falta se explica con el
    // estado, y la ficha lo dice en palabras (`lib/incidentTracking`).
    expect(tracking?.status).toBe("waitingParts");
  });

  test("la consulta por código tiene su freno: treinta por hora y código", async () => {
    const { t, code } = await reported();

    // Las treinta primeras caben: quien sigue su caso a mano no se encuentra con
    // un aviso por mirarlo.
    for (let intento = 0; intento < LOOKUP_LIMIT_PER_HOUR; intento += 1) {
      expect(
        (await t.mutation(api.incidents.byCode, { code }))?.code,
        `consulta ${intento + 1}`,
      ).toBe(code);
    }
    // La siguiente no: la puerta está abierta y sin el freno un sondeo podría
    // preguntar sin parar.
    await expectConvexError(
      t.mutation(api.incidents.byCode, { code }),
      `${LOOKUP_LIMIT_PER_HOUR} consultas por hora`,
    );

    // El cupo es del código consultado: otro caso se sigue sin esperar.
    const otro = await t.mutation(api.incidents.report, {
      ...reportArgs,
      reporterName: "Marta Ruiz",
    });
    expect(
      (await t.mutation(api.incidents.byCode, { code: otro.code }))?.code,
    ).toBe(otro.code);

    // Y cumplida la hora vuelve el cupo: la ventana se reinicia sola, sin que
    // nadie tenga que limpiar nada.
    const fila = await t.run((ctx) =>
      ctx.db
        .query("publicLookupLimits")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first(),
    );
    expect(fila?.count).toBe(LOOKUP_LIMIT_PER_HOUR);
    await t.run((ctx) =>
      ctx.db.patch(fila!._id, { windowStart: Date.now() - LOOKUP_WINDOW_MS }),
    );
    expect((await t.mutation(api.incidents.byCode, { code }))?.code).toBe(code);
  });

  test("lo que no tiene forma de código no gasta cupo: no llega a ser una consulta", async () => {
    const { t, code } = await reported();

    for (let intento = 0; intento < LOOKUP_LIMIT_PER_HOUR; intento += 1) {
      await t.mutation(api.incidents.byCode, { code });
    }
    // Ni una referencia interna ni algo tecleado a medias buscan nada…
    for (const typed of ["INC-0001", "7", "la del monitor", ""]) {
      expect(
        await t.mutation(api.incidents.byCode, { code: typed }),
        `«${typed}»`,
      ).toBeNull();
    }
    // …ni reinician el cupo del código bueno, que sigue agotado.
    await expectConvexError(
      t.mutation(api.incidents.byCode, { code }),
      `${LOOKUP_LIMIT_PER_HOUR} consultas por hora`,
    );
  });

  test("la purga de la noche borra las ventanas caducadas y respeta las que cuentan", async () => {
    const { t, code } = await reported();
    // Un código consultado dos veces: su ventana sigue contando y la purga no
    // tiene nada que hacer con ella.
    await t.mutation(api.incidents.byCode, { code });
    await t.mutation(api.incidents.byCode, { code });

    const otro = await t.mutation(api.incidents.report, {
      ...reportArgs,
      reporterName: "Marta Ruiz",
    });
    await t.mutation(api.incidents.byCode, { code: otro.code });
    // La de este otro ya cumplió su hora: es lo que la pasada se lleva, y lo que
    // sin ella se quedaría en la tabla para siempre.
    await t.run(async (ctx) => {
      const fila = await ctx.db
        .query("publicLookupLimits")
        .withIndex("by_code", (q) => q.eq("code", otro.code))
        .first();
      await ctx.db.patch(fila!._id, {
        windowStart: expiredBefore(Date.now()),
      });
    });

    expect(await t.mutation(internal.publicLookupLimits.purgeExpired, {})).toBe(
      1,
    );

    // Solo se fue la caducada, y la viva conserva su cuenta: la purga no le
    // devuelve el cupo a nadie que esté esperando su hora.
    const filas = await t.run((ctx) =>
      ctx.db.query("publicLookupLimits").collect(),
    );
    expect(filas.map((fila) => fila.code)).toEqual([code]);
    expect(filas[0].count).toBe(2);

    // Y al código purgado no le cuesta nada: se sigue igual que antes, con la
    // ventana recién abierta —la que había ya no contaba, así que borrarla no
    // cambia lo que pasa en la puerta—.
    expect(
      (await t.mutation(api.incidents.byCode, { code: otro.code }))?.code,
    ).toBe(otro.code);
    const reabierta = await t.run((ctx) =>
      ctx.db
        .query("publicLookupLimits")
        .withIndex("by_code", (q) => q.eq("code", otro.code))
        .first(),
    );
    expect(reabierta?.count).toBe(1);
  });

  test("la puerta del taller sigue cerrada sin sesión", async () => {
    const { t, reference } = await reported();
    await expectConvexError(
      t.query(api.incidents.byReference, { reference }),
      "Solo el taller puede consultar una incidencia por su referencia.",
    );
  });
});

describe("asignación de incidencias", () => {
  test("el técnico se autoasigna una pendiente y avisa a coordinadores", async () => {
    const { t, coordinator, tech, techId } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);

    await tech.mutation(api.incidents.selfAssign, {
      incidentId: incident._id,
    });

    const updated = await firstIncident(coordinator);
    expect(updated.status).toBe("assigned");
    expect(updated.assigneeName).toBe("Iván Torres");
    expect(updated.assigneeId).toBe(techId);
    expect(updated.history).toHaveLength(2);

    const notifications = await coordinator.query(api.notifications.list, {});
    expect(
      notifications.some((item) => item.text.includes("autoasignada")),
    ).toBe(true);
  });

  test("un técnico no puede asignar a otros, pero el coordinador sí", async () => {
    const { t, coordinator, tech, techId } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);

    await expectConvexError(
      tech.mutation(api.incidents.assign, {
        incidentId: incident._id,
        assigneeId: techId,
      }),
      "Solo el coordinador puede asignar incidencias",
    );

    await coordinator.mutation(api.incidents.assign, {
      incidentId: incident._id,
      assigneeId: techId,
    });
    const updated = await firstIncident(coordinator);
    expect(updated.status).toBe("assigned");
    expect(updated.assigneeName).toBe("Iván Torres");

    // El técnico asignado recibe el aviso
    const notifications = await tech.query(api.notifications.list, {});
    expect(
      notifications.some((item) => item.text.includes("asignada a ti")),
    ).toBe(true);
  });

  test("no se puede autoasignar lo que ya está asignado", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, {
      incidentId: incident._id,
    });
    await expectConvexError(
      tech.mutation(api.incidents.selfAssign, { incidentId: incident._id }),
      "Ya está asignada",
    );
  });

  test("solo el coordinador consulta el listado para asignar", async () => {
    const { coordinator, tech } = await setup();
    const assignable = await coordinator.query(api.members.listAssignable, {});
    expect(assignable.length).toBe(2);
    await expectConvexError(
      tech.query(api.members.listAssignable, {}),
      "Solo el coordinador o el técnico de la orden",
    );
  });

  test("el técnico de taller abre el listado con su propia orden delante", async () => {
    const { t, coordinator, tech, techId, coordinatorId } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });
    await tech.mutation(api.incidents.verify, {
      incidentId: incident._id,
      outcome: "workshop",
    });
    const inWorkshop = await firstIncident(coordinator);

    // Con su caso delante, la lista se abre: es con la que elige a quién se la
    // pasa desde la ficha.
    const assignable = await tech.query(api.members.listAssignable, {
      incidentId: inWorkshop._id,
    });
    expect(assignable.map((user) => user._id)).toEqual(
      expect.arrayContaining([coordinatorId, techId]),
    );

    // Sin incidencia no hay caso que enseñar: sigue siendo la puerta de
    // coordinación.
    await expectConvexError(
      tech.query(api.members.listAssignable, {}),
      "Solo el coordinador o el técnico de la orden",
    );

    // Y con una incidencia que no lleva, tampoco: no es una lista abierta a todo
    // el taller, es la de su orden.
    const segunda = await t.mutation(api.incidents.report, {
      ...reportArgs,
      reporterName: "Marta Ruiz",
    });
    const cola = await coordinator.query(api.incidents.list, {});
    const otra = cola.find((item) => item.reference === segunda.reference)!;
    await expectConvexError(
      tech.query(api.members.listAssignable, { incidentId: otra._id }),
      "Solo el coordinador o el técnico de la orden",
    );
  });
});

describe("verificación, taller y cierre", () => {
  test("un técnico sin asignar no puede verificar", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await expectConvexError(
      tech.mutation(api.incidents.verify, {
        incidentId: incident._id,
        outcome: "onsite",
      }),
      "Solo el técnico asignado o el coordinador",
    );
  });

  test("resuelta in situ: se cierra y crea la ficha del equipo", async () => {
    const { t, coordinator, tech, equipmentId } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });

    await tech.mutation(api.incidents.verify, {
      incidentId: incident._id,
      outcome: "onsite",
      equipmentId,
      notes: "Cable de alimentación reinsertado.",
    });

    const updated = await firstIncident(coordinator);
    expect(updated.status).toBe("resolved");
    expect(updated.closedAt).toBeTypeOf("number");
    expect(updated.maintenanceId).toBeTruthy();
    expect(updated.history).toHaveLength(3);

    // La ficha de historial queda en el equipo con todos los datos
    const maintenance = await coordinator.query(api.maintenance.list, {});
    const sheet = maintenance.find(
      (item) => item._id === updated.maintenanceId,
    );
    expect(sheet).toBeDefined();
    expect(sheet!.kind).toBe("repair");
    expect(sheet!.description).toContain("INC-0001");
    expect(sheet!.description).toContain(reportArgs.description);
    expect(sheet!.description).toContain("Cable de alimentación reinsertado.");
    expect(sheet!.equipmentId).toBe(equipmentId);
  });

  test("derivada a taller: entra en la orden, se cierra y genera petición", async () => {
    const { t, coordinator, tech, equipmentId } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await coordinator.mutation(api.incidents.assign, {
      incidentId: incident._id,
      assigneeId: (await techUser(coordinator))._id,
    });

    await tech.mutation(api.incidents.verify, {
      incidentId: incident._id,
      outcome: "workshop",
      equipmentId,
      notes: "Avería reproducible en el banco.",
    });

    const updated = await firstIncident(coordinator);
    expect(updated.status).toBe("workshop");
    expect(updated.workshopAssigneeName).toBe("Iván Torres");
    expect(updated.history.map((entry) => entry.status)).toEqual([
      "reported",
      "assigned",
      "workshop",
    ]);

    // Cierre de la entrada de taller con resolución
    await tech.mutation(api.incidents.close, {
      incidentId: updated._id,
      outcome: "resolved",
      notes: "Sustituido el conector de alimentación.",
    });
    const closed = await firstIncident(coordinator);
    expect(closed.status).toBe("resolved");
    expect(closed.maintenanceId).toBeTruthy();

    // La petición de repuestos enlazada avisa al técnico y queda en la cola
    const reference = await tech.mutation(api.partRequests.create, {
      requesterName: "Iván Torres",
      equipment: "Cámara de estudio HDC-3500",
      equipmentId,
      priority: "urgent",
      description: "Conector de alimentación de repuesto.",
      incidentId: closed._id,
    });
    expect(reference).toMatch(/^PET-/);
    const requests = await coordinator.query(api.partRequests.list, {});
    const linked = requests.find((item) => item.reference === reference);
    expect(linked?.incidentId).toBe(closed._id);
    const techNotifications = await tech.query(api.notifications.list, {});
    expect(
      techNotifications.some((item) => item.text.includes(reference)),
    ).toBe(true);
  });

  test("el coordinador reasigna la orden de taller a otro técnico", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await coordinator.mutation(api.incidents.assign, {
      incidentId: incident._id,
      assigneeId: (await techUser(coordinator))._id,
    });
    await tech.mutation(api.incidents.verify, {
      incidentId: incident._id,
      outcome: "workshop",
    });

    const inWorkshop = await firstIncident(coordinator);
    const coordinatorUser = (
      await coordinator.query(api.members.listAssignable, {})
    ).find((user) => user.role !== "technician");
    expect(coordinatorUser).toBeDefined();

    await coordinator.mutation(api.incidents.assignWorkshop, {
      incidentId: inWorkshop._id,
      assigneeId: coordinatorUser!._id,
    });
    const reassigned = await firstIncident(coordinator);
    expect(reassigned.workshopAssigneeName).toBe("Elena Vidal");
  });

  test("sin equipo relacionado no se crea ficha, pero sí se cierra", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });
    await tech.mutation(api.incidents.verify, {
      incidentId: incident._id,
      outcome: "unresolved",
      notes: "No se pudo reproducir el fallo.",
    });

    const updated = await firstIncident(coordinator);
    expect(updated.status).toBe("unresolved");
    expect(updated.maintenanceId).toBeUndefined();
    expect(updated.notes).toContain("No se pudo reproducir");
  });
});

describe("repuestos y la incidencia: la espera y la reparación", () => {
  /** El repuesto con existencias para poder aprobar y entregar. */
  async function repuesto(t: ReturnType<typeof convexTest>) {
    const now = Date.now();
    return await t.run((ctx) =>
      ctx.db.insert("spareParts", {
        code: "ALI-24015",
        name: "Fuente de alimentación",
        category: "Alimentación",
        unit: "ud",
        stock: 10,
        minStock: 1,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  /** Abre una petición para la incidencia y devuelve su referencia. */
  async function pedir(
    authed: Authed,
    incidentId: Id<"incidents">,
    sparePartId: Id<"spareParts">,
  ) {
    return await authed.mutation(api.partRequests.create, {
      requesterName: "Iván Torres",
      priority: "normal",
      description: "Hace falta la fuente para terminar.",
      incidentId,
      lines: [{ sparePartId, quantity: 1 }],
    });
  }

  /** La petición de esa referencia, tal y como la ve quien decide. */
  async function peticion(authed: Authed, reference: string) {
    const requests = await authed.query(api.partRequests.list, {});
    const request = requests.find((item) => item.reference === reference);
    expect(request, `sin petición ${reference}`).toBeDefined();
    return request!;
  }

  test("pedir material deja la incidencia esperando, y la entrega la pasa a reparación", async () => {
    const { t, coordinator, tech, coordinatorId } = await setup();
    const pieza = await repuesto(t);
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });

    const reference = await pedir(tech, incident._id, pieza);
    const esperando = await firstIncident(coordinator);
    expect(esperando.status).toBe("waitingParts");
    expect(esperando.history.map((entry) => entry.status)).toEqual([
      "reported",
      "assigned",
      "waitingParts",
    ]);
    // Sin entrada a taller, el caso espera donde se trabaja: en el sitio.
    expect(esperando.workshopAssigneeName).toBeUndefined();
    // Y sin orden de taller no hay técnico de taller que cambiar, aunque el caso
    // esté esperando material: el estado no dice dónde está el equipo.
    await expectConvexError(
      coordinator.mutation(api.incidents.assignWorkshop, {
        incidentId: incident._id,
        assigneeId: coordinatorId,
      }),
      "no está en el taller",
    );

    const request = await peticion(coordinator, reference);
    // El material apartado todavía no es material entregado: sigue esperando.
    await coordinator.mutation(api.partRequests.approve, {
      requestId: request._id,
    });
    expect((await firstIncident(coordinator)).status).toBe("waitingParts");

    await coordinator.mutation(api.partRequests.markIssued, {
      requestId: request._id,
    });
    const reparando = await firstIncident(coordinator);
    expect(reparando.status).toBe("repairing");
    expect(reparando.history.map((entry) => entry.status)).toEqual([
      "reported",
      "assigned",
      "waitingParts",
      "repairing",
    ]);

    // Y con el material en mano, el trabajo se cierra en el sitio.
    await tech.mutation(api.incidents.verify, {
      incidentId: reparando._id,
      outcome: "onsite",
    });
    expect((await firstIncident(coordinator)).status).toBe("resolved");
  });

  test("el material que sale a medias no adelanta la reparación, y el seguimiento dice qué queda", async () => {
    const { t, coordinator, tech } = await setup();
    const pieza = await repuesto(t);
    const filtro = await t.run((ctx) =>
      ctx.db.insert("spareParts", {
        code: "FIL-00042",
        name: "Filtro de aire",
        category: "Consumibles",
        unit: "ud",
        stock: 10,
        minStock: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    const { code } = await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });

    const reference = await tech.mutation(api.partRequests.create, {
      requesterName: "Iván Torres",
      priority: "normal",
      incidentId: incident._id,
      lines: [
        { sparePartId: pieza, quantity: 2 },
        { sparePartId: filtro, quantity: 1 },
      ],
    });
    const request = await peticion(coordinator, reference);
    await coordinator.mutation(api.partRequests.approve, {
      requestId: request._id,
    });

    // Sale una de las dos fuentes: hay material en mano, pero falta otra pieza, así
    // que la incidencia no puede darse por reparando.
    await coordinator.mutation(api.partRequests.issueLines, {
      requestId: request._id,
      lines: [{ sparePartId: pieza, quantity: 1 }],
    });
    expect((await firstIncident(coordinator)).status).toBe("waitingParts");

    // Y lo que falta se sigue diciendo en concreto, sin la pieza que ya llegó.
    const tracking = await t.mutation(api.incidents.byCode, { code });
    expect(tracking?.pendingParts).toEqual([
      {
        name: "Fuente de alimentación",
        quantity: 1,
        since: expect.any(Number),
      },
      { name: "Filtro de aire", quantity: 1, since: expect.any(Number) },
    ]);

    // Con lo último en mano, el caso pasa a reparación y ya no falta nada.
    await coordinator.mutation(api.partRequests.issueLines, {
      requestId: request._id,
      lines: [
        { sparePartId: pieza, quantity: 1 },
        { sparePartId: filtro, quantity: 1 },
      ],
    });
    expect((await firstIncident(coordinator)).status).toBe("repairing");
    expect(
      (await t.mutation(api.incidents.byCode, { code }))?.pendingParts,
    ).toEqual([]);
  });

  test("en taller, la espera conserva la orden y el cierre sigue siendo el de taller", async () => {
    const { t, coordinator, tech, techId, coordinatorId, equipmentId } =
      await setup();
    const pieza = await repuesto(t);
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });
    await tech.mutation(api.incidents.verify, {
      incidentId: incident._id,
      outcome: "workshop",
      equipmentId,
    });

    const reference = await pedir(tech, incident._id, pieza);
    const esperando = await firstIncident(coordinator);
    expect(esperando.status).toBe("waitingParts");
    // La orden de taller sigue abierta: el equipo no ha salido del taller.
    expect(esperando.workshopAssigneeName).toBe("Iván Torres");

    // Y el técnico de taller se puede cambiar sin que el caso deje de esperar:
    // sigue en «en espera de repuestos», solo cambia quién lo lleva.
    await coordinator.mutation(api.incidents.assignWorkshop, {
      incidentId: esperando._id,
      assigneeId: coordinatorId,
    });
    const reasignada = await firstIncident(coordinator);
    expect(reasignada.status).toBe("waitingParts");
    expect(reasignada.workshopAssigneeName).toBe("Elena Vidal");
    // El rastro queda con el estado real del caso, no con «en taller» de prestado.
    expect(reasignada.history.at(-1)).toMatchObject({ status: "waitingParts" });

    const request = await peticion(coordinator, reference);
    await coordinator.mutation(api.partRequests.approve, {
      requestId: request._id,
    });
    await coordinator.mutation(api.partRequests.markIssued, {
      requestId: request._id,
    });
    const reparando = await firstIncident(coordinator);
    expect(reparando.status).toBe("repairing");

    // Con el material ya entregado también se cambia el técnico de taller, y la
    // reparación sigue donde estaba.
    await coordinator.mutation(api.incidents.assignWorkshop, {
      incidentId: reparando._id,
      assigneeId: techId,
    });
    const reparandoConOtro = await firstIncident(coordinator);
    expect(reparandoConOtro.status).toBe("repairing");
    expect(reparandoConOtro.workshopAssigneeName).toBe("Iván Torres");
    expect(reparandoConOtro.history.at(-1)).toMatchObject({
      status: "repairing",
    });

    // Con la orden abierta, el cierre en el sitio no vale…
    await expectConvexError(
      tech.mutation(api.incidents.verify, {
        incidentId: reparando._id,
        outcome: "onsite",
      }),
      "está en el taller",
    );
    // …y el trabajo se cierra desde la orden de taller, con su ficha.
    await tech.mutation(api.incidents.close, {
      incidentId: reparando._id,
      outcome: "resolved",
      notes: "Fuente sustituida.",
    });
    const cerrada = await firstIncident(coordinator);
    expect(cerrada.status).toBe("resolved");
    expect(cerrada.maintenanceId).toBeTruthy();
  });

  test("con dos peticiones no se repara hasta que se entrega la última", async () => {
    const { t, coordinator, tech } = await setup();
    const pieza = await repuesto(t);
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });

    const primera = await pedir(tech, incident._id, pieza);
    const segunda = await pedir(tech, incident._id, pieza);
    expect((await firstIncident(coordinator)).status).toBe("waitingParts");

    for (const reference of [primera, segunda]) {
      const request = await peticion(coordinator, reference);
      await coordinator.mutation(api.partRequests.approve, {
        requestId: request._id,
      });
    }
    const uno = await peticion(coordinator, primera);
    await coordinator.mutation(api.partRequests.markIssued, {
      requestId: uno._id,
    });
    // Todavía falta la segunda: la incidencia sigue esperando.
    expect((await firstIncident(coordinator)).status).toBe("waitingParts");

    const dos = await peticion(coordinator, segunda);
    await coordinator.mutation(api.partRequests.markIssued, {
      requestId: dos._id,
    });
    expect((await firstIncident(coordinator)).status).toBe("repairing");
  });

  test("una petición cancelada devuelve la incidencia a donde estaba", async () => {
    const { t, coordinator, tech } = await setup();
    const pieza = await repuesto(t);
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });

    // Asignada: sin taller, vuelve a la asignación.
    const sinTaller = await pedir(tech, incident._id, pieza);
    expect((await firstIncident(coordinator)).status).toBe("waitingParts");
    const primera = await peticion(coordinator, sinTaller);
    await coordinator.mutation(api.partRequests.cancel, {
      requestId: primera._id,
    });
    expect((await firstIncident(coordinator)).status).toBe("assigned");

    // En taller: el caso vuelve a la orden de taller, no a la asignación.
    await tech.mutation(api.incidents.verify, {
      incidentId: incident._id,
      outcome: "workshop",
    });
    const enTaller = await pedir(tech, incident._id, pieza);
    expect((await firstIncident(coordinator)).status).toBe("waitingParts");
    const segunda = await peticion(coordinator, enTaller);
    await coordinator.mutation(api.partRequests.cancel, {
      requestId: segunda._id,
    });
    const vuelta = await firstIncident(coordinator);
    expect(vuelta.status).toBe("workshop");
    expect(vuelta.workshopAssigneeName).toBe("Iván Torres");
  });

  test("devolver el material devuelve la incidencia a la espera", async () => {
    const { t, coordinator, tech } = await setup();
    const pieza = await repuesto(t);
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });

    const reference = await pedir(tech, incident._id, pieza);
    const request = await peticion(coordinator, reference);
    await coordinator.mutation(api.partRequests.approve, {
      requestId: request._id,
    });
    await coordinator.mutation(api.partRequests.markIssued, {
      requestId: request._id,
    });
    expect((await firstIncident(coordinator)).status).toBe("repairing");

    // El material volvió al almacén: otra vez falta la pieza.
    await coordinator.mutation(api.partRequests.returnMaterial, {
      requestId: request._id,
    });
    const esperando = await firstIncident(coordinator);
    expect(esperando.status).toBe("waitingParts");
  });
});

describe("corrección de los datos del equipo", () => {
  test("el técnico asignado añade el nº de serie que la notificación no traía", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, {
      ...reportArgs,
      serialNumber: undefined,
    });
    const incident = await firstIncident(coordinator);
    expect(incident.serialNumber).toBeUndefined();

    // Todavía no es suya: quien no lleva la incidencia no toca el dato
    await expectConvexError(
      tech.mutation(api.incidents.updateEquipment, {
        incidentId: incident._id,
        serialNumber: "HDC3500-2505-0147",
      }),
      "Solo el técnico asignado o quien coordina la incidencia",
    );

    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });
    // Solo el nº de serie: el modelo que traía la notificación se queda como está
    await tech.mutation(api.incidents.updateEquipment, {
      incidentId: incident._id,
      serialNumber: "HDC3500-2505-0147",
    });

    const updated = await firstIncident(coordinator);
    expect(updated.serialNumber).toBe("HDC3500-2505-0147");
    expect(updated.model).toBe("HDC-3500");

    // El cambio queda en la ficha con lo que se cambió y quién lo cambió...
    const last = updated.history[updated.history.length - 1];
    expect(last.by).toBe("Iván Torres");
    expect(last.note).toContain("nº de serie HDC3500-2505-0147");
    // ...y sin mover el estado: corregir el dato no es un paso del flujo
    expect(last.status).toBe("assigned");
    expect(updated.status).toBe("assigned");
  });

  test("el coordinador corrige el modelo y quita el nº de serie equivocado", async () => {
    const { t, coordinator } = await setup();
    await t.mutation(api.incidents.report, {
      ...reportArgs,
      model: "HDC 350",
      serialNumber: "S/N 123",
    });
    const incident = await firstIncident(coordinator);

    // El nº de serie vacío es «quítalo»: el que había era erróneo
    await coordinator.mutation(api.incidents.updateEquipment, {
      incidentId: incident._id,
      model: "HDC-3500",
      serialNumber: "",
    });

    const updated = await firstIncident(coordinator);
    expect(updated.model).toBe("HDC-3500");
    expect(updated.serialNumber).toBeUndefined();
    const last = updated.history[updated.history.length - 1];
    expect(last.note).toContain("modelo HDC-3500");
    expect(last.note).toContain("sin nº de serie");
  });

  test("sin nada que cambiar se rechaza en vez de anotar un paso vacío", async () => {
    const { t, coordinator } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);

    await expectConvexError(
      coordinator.mutation(api.incidents.updateEquipment, {
        incidentId: incident._id,
        model: reportArgs.model,
        serialNumber: reportArgs.serialNumber,
      }),
      "Esos son los datos que ya tiene la incidencia",
    );
    // Y el modelo no se queda en blanco: es lo que identifica la máquina
    await expectConvexError(
      coordinator.mutation(api.incidents.updateEquipment, {
        incidentId: incident._id,
        model: "  ",
      }),
      "Escribe el modelo del equipo",
    );

    const unchanged = await firstIncident(coordinator);
    expect(unchanged.history).toHaveLength(1);
    expect(unchanged.model).toBe(reportArgs.model);
  });

  test("los datos corregidos son los que se llevan a la ficha del equipo", async () => {
    const { t, coordinator, tech, equipmentId } = await setup();
    await t.mutation(api.incidents.report, {
      ...reportArgs,
      serialNumber: "S/N 123",
    });
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });
    await tech.mutation(api.incidents.updateEquipment, {
      incidentId: incident._id,
      serialNumber: "HDC3500-2505-0147",
    });
    await tech.mutation(api.incidents.verify, {
      incidentId: incident._id,
      outcome: "onsite",
      equipmentId,
      notes: "Conector de alimentación cambiado.",
    });

    // La intervención del historial de la máquina se compone con estos campos
    const sheets = await t.run((ctx) =>
      ctx.db.query("maintenanceRecords").collect(),
    );
    expect(sheets).toHaveLength(1);
    expect(sheets[0].description).toContain("S/N HDC3500-2505-0147");
    expect(sheets[0].description).not.toContain("S/N 123");
  });
});

describe("documentos y notas durante el ciclo de vida", () => {
  test("el coordinador adjunta un documento y la incidencia lo expone", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);

    await coordinator.mutation(api.incidents.attachDocument, {
      incidentId: incident._id,
      name: "Reporte técnico initial.pdf",
      note: "Foto del daño antes de la reparación",
    });

    const updated = await firstIncident(coordinator);
    expect(updated.documents).toHaveLength(1);
    expect(updated.documents[0].name).toBe("Reporte técnico initial.pdf");
    expect(updated.documents[0].note).toBe(
      "Foto del daño antes de la reparación",
    );
    expect(updated.documents[0].createdAt).toBeTypeOf("number");
    // Queda firmado: quien lo adjuntó, no la última persona que lo toque.
    expect(updated.documents[0].author).toBe("Elena Vidal");

    const withDocument = await firstIncident(tech);
    expect(withDocument.documents).toEqual(updated.documents);
  });

  test("el autor del documento es quien lo adjunta, aunque otro lo edite después", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);

    const created = await coordinator.mutation(api.incidents.attachDocument, {
      incidentId: incident._id,
      name: "Acta de intervención.pdf",
    });

    // Otro coordinador con las mismas capacidades edita la ficha del documento.
    const otherId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Rubén Sanz",
        email: "ruben@taller.es",
        role: "manager",
      }),
    );
    const other = t.withIdentity({ subject: `${otherId}|session1` });
    await other.mutation(api.incidents.updateDocument, {
      incidentId: incident._id,
      documentId: created,
      name: "Acta de intervención revisada.pdf",
    });

    const updated = await firstIncident(coordinator);
    expect(updated.documents[0].name).toBe("Acta de intervención revisada.pdf");
    expect(updated.documents[0].author).toBe("Elena Vidal");

    // El técnico que solo lee ve la misma firma.
    const byTech = await tech.query(api.incidents.list, {});
    const seen = byTech.find((item) => item._id === incident._id);
    expect(seen?.documents[0].author).toBe("Elena Vidal");
  });

  test("cada documento guarda su propio autor y todos se leen juntos", async () => {
    const { t, coordinator } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);

    await coordinator.mutation(api.incidents.attachDocument, {
      incidentId: incident._id,
      name: "Foto 01.jpg",
    });
    const otherId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Marta Ruiz",
        email: "marta@taller.es",
        role: "manager",
      }),
    );
    const other = t.withIdentity({ subject: `${otherId}|session1` });
    await other.mutation(api.incidents.attachDocument, {
      incidentId: incident._id,
      name: "Informe medidor.pdf",
    });

    const updated = await firstIncident(coordinator);
    expect(updated.documents.map((d) => [d.name, d.author])).toEqual([
      ["Foto 01.jpg", "Elena Vidal"],
      ["Informe medidor.pdf", "Marta Ruiz"],
    ]);
  });

  test("es posible adjuntar más de un documento y se conservan en orden", async () => {
    const { t, coordinator } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);

    await coordinator.mutation(api.incidents.attachDocument, {
      incidentId: incident._id,
      name: "Foto 01.jpg",
      note: "Apertura del equipo",
    });
    await coordinator.mutation(api.incidents.attachDocument, {
      incidentId: incident._id,
      name: "Informe medidor.pdf",
    });

    const updated = await firstIncident(coordinator);
    expect(updated.documents).toHaveLength(2);
    expect(updated.documents.map((d) => d.name)).toEqual([
      "Foto 01.jpg",
      "Informe medidor.pdf",
    ]);
  });

  test("el técnico asignado anota con fecha y quien coordina la lee", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });

    const noteTime = Date.now() - 60 * 60 * 1000;
    await tech.mutation(api.incidents.addNote, {
      incidentId: incident._id,
      note: "Prueba de reinicio completada, sin efecto.",
      at: noteTime,
    });

    const updated = await firstIncident(coordinator);
    expect(updated.lifecycleNotes).toHaveLength(1);
    expect(updated.lifecycleNotes[0].note).toBe(
      "Prueba de reinicio completada, sin efecto.",
    );
    expect(updated.lifecycleNotes[0].author).toBe("Iván Torres");
    expect(updated.lifecycleNotes[0].at).toBe(noteTime);

    // Y quien coordina la ve al consultar la cola
    const byCoordinator = await coordinator.query(api.incidents.list, {});
    const visible = byCoordinator.find((item) => item._id === incident._id);
    expect(visible?.lifecycleNotes).toEqual(updated.lifecycleNotes);
  });

  test("múltiples notas se acumulan y se ordenan por fecha", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });

    const t1 = Date.now() - 60 * 60 * 1000;
    const t2 = Date.now() - 30 * 60 * 1000;
    await tech.mutation(api.incidents.addNote, {
      incidentId: incident._id,
      note: "Segunda revisión",
      at: t2,
    });
    await tech.mutation(api.incidents.addNote, {
      incidentId: incident._id,
      note: "Primera revisión",
      at: t1,
    });

    const updated = await firstIncident(coordinator);
    expect(updated.lifecycleNotes).toHaveLength(2);
    expect(updated.lifecycleNotes[0].note).toBe("Primera revisión");
    expect(updated.lifecycleNotes[1].note).toBe("Segunda revisión");
  });

  test("una nota está vacía rechaza con mensaje claro", async () => {
    const { t, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(tech);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });

    await expectConvexError(
      tech.mutation(api.incidents.addNote, {
        incidentId: incident._id,
        note: "   ",
      }),
      "Escribe una nota válida.",
    );
  });

  test("se puede adjuntar un documento con nota y luego editarlo", async () => {
    const { t, coordinator } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);

    const created = await coordinator.mutation(api.incidents.attachDocument, {
      incidentId: incident._id,
      name: "Medición voltaje.xlsx",
      note: "Valor inicial",
    });

    const afterCreate = await coordinator.query(api.incidents.list, {});
    const found = afterCreate.find((item) => item._id === incident._id);
    expect(found?.documents).toHaveLength(1);
    expect(found!.documents[0]._id).toBe(created);

    await coordinator.mutation(api.incidents.updateDocument, {
      incidentId: incident._id,
      documentId: created,
      name: "Medición voltaje revisada.xlsx",
      note: "Valor tras recalibración",
    });

    const afterUpdate = await coordinator.query(api.incidents.list, {});
    const updatedDoc = afterUpdate
      .find((item) => item._id === incident._id)
      ?.documents.find((d) => d._id === created);
    expect(updatedDoc).toBeDefined();
    expect(updatedDoc!.name).toBe("Medición voltaje revisada.xlsx");
    expect(updatedDoc!.note).toBe("Valor tras recalibración");
  });

  test("el coordinador quita un adjunto sin tocar el resto", async () => {
    const { t, coordinator } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);

    const created = await coordinator.mutation(api.incidents.attachDocument, {
      incidentId: incident._id,
      name: "Documento a eliminar.pdf",
    });
    await coordinator.mutation(api.incidents.attachDocument, {
      incidentId: incident._id,
      name: "Documento que se queda.pdf",
    });

    await coordinator.mutation(api.incidents.removeDocument, {
      incidentId: incident._id,
      documentId: created,
    });

    const after = await coordinator.query(api.incidents.list, {});
    const visible = after.find((item) => item._id === incident._id);
    expect(visible?.documents).toHaveLength(1);
    expect(visible!.documents[0].name).toBe("Documento que se queda.pdf");
  });

  test("solo el coordinador adjunta, edita y quita documentos", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    // El técnico está asignado (puede anotar), pero el expediente no es suyo.
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });

    // El documento ya existe (lo adjuntó el coordinador) para poder probar
    // también la edición y el borrado: las tres mutaciones deben rechazar al
    // técnico, no solo la que crea.
    const documentId = await coordinator.mutation(
      api.incidents.attachDocument,
      {
        incidentId: incident._id,
        name: "Acta de intervención.pdf",
      },
    );

    const forbidden =
      "Solo el coordinador puede adjuntar, editar o quitar documentos";
    await expectConvexError(
      tech.mutation(api.incidents.attachDocument, {
        incidentId: incident._id,
        name: "Sin permiso.pdf",
      }),
      forbidden,
    );
    await expectConvexError(
      tech.mutation(api.incidents.updateDocument, {
        incidentId: incident._id,
        documentId,
        name: "Renombrado sin permiso.pdf",
      }),
      forbidden,
    );
    await expectConvexError(
      tech.mutation(api.incidents.removeDocument, {
        incidentId: incident._id,
        documentId,
      }),
      forbidden,
    );

    // Y el rechazo es real: nada se creó, renombró ni borró.
    const after = await firstIncident(coordinator);
    expect(after.documents).toHaveLength(1);
    expect(after.documents[0].name).toBe("Acta de intervención.pdf");
  });

  test("un técnico sin asignar no puede anotar, y sí en cuanto se la lleva", async () => {
    const { t, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(tech);

    // Todavía está sin asignar: la nota no es suya
    await expectConvexError(
      tech.mutation(api.incidents.addNote, {
        incidentId: incident._id,
        note: "Me adelanto al diagnóstico.",
      }),
      "Solo el técnico asignado o quien coordina la incidencia",
    );

    // En cuanto se la lleva, la nota pasa a ser su cuaderno de trabajo
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });
    await tech.mutation(api.incidents.addNote, {
      incidentId: incident._id,
      note: "Diagnóstico en curso.",
    });

    const after = await firstIncident(tech);
    expect(after.lifecycleNotes).toHaveLength(1);
    expect(after.lifecycleNotes[0].note).toBe("Diagnóstico en curso.");
    expect(after.lifecycleNotes[0].author).toBe("Iván Torres");
  });

  test("el técnico con la orden de taller también puede anotar", async () => {
    const { t, coordinator, tech, techId } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);

    // Un segundo técnico: así la asignación y la orden de taller recaen en
    // personas distintas y se prueba esa vía por separado.
    const otherId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Nuria Cano",
        email: "nuria@taller.es",
        role: "technician",
      }),
    );
    const other = t.withIdentity({ subject: `${otherId}|session1` });

    await coordinator.mutation(api.incidents.assign, {
      incidentId: incident._id,
      assigneeId: techId,
    });
    await tech.mutation(api.incidents.verify, {
      incidentId: incident._id,
      outcome: "workshop",
    });

    // Aún no lleva la orden de taller, así que no puede anotar
    await expectConvexError(
      other.mutation(api.incidents.addNote, {
        incidentId: incident._id,
        note: "Antes de tener la orden.",
      }),
      "Solo el técnico asignado o quien coordina la incidencia",
    );

    await coordinator.mutation(api.incidents.assignWorkshop, {
      incidentId: incident._id,
      assigneeId: otherId,
    });
    const updated = await firstIncident(coordinator);
    expect(updated.workshopAssigneeName).toBe("Nuria Cano");

    await other.mutation(api.incidents.addNote, {
      incidentId: updated._id,
      note: "Pedido el conector de repuesto.",
    });
    const after = await firstIncident(coordinator);
    expect(after.lifecycleNotes).toHaveLength(1);
    expect(after.lifecycleNotes[0].author).toBe("Nuria Cano");
  });

  test("quien escribió la nota la corrige y la retira aunque ya no tenga la incidencia", async () => {
    const { t, coordinator, tech, coordinatorId } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });

    const noteId = await tech.mutation(api.incidents.addNote, {
      incidentId: incident._id,
      note: "Diagnóstico inicial: el cable hace falso contacto.",
    });

    // La incidencia pasa a otra persona: el autor se queda sin ella, que es
    // justo el caso que se quiere permitir mientras dure el plazo.
    await coordinator.mutation(api.incidents.assign, {
      incidentId: incident._id,
      assigneeId: coordinatorId,
    });
    const reassigned = await firstIncident(coordinator);
    expect(reassigned.assigneeId).toBe(coordinatorId);

    await tech.mutation(api.incidents.updateNote, {
      incidentId: incident._id,
      noteId,
      note: "Diagnóstico inicial: el cable hace falso contacto (confirmado).",
    });

    // La corrección se ve, queda fechada y no mueve la nota de sitio.
    const edited = await firstIncident(coordinator);
    expect(edited.lifecycleNotes).toHaveLength(1);
    expect(edited.lifecycleNotes[0].note).toBe(
      "Diagnóstico inicial: el cable hace falso contacto (confirmado).",
    );
    expect(edited.lifecycleNotes[0].author).toBe("Iván Torres");
    expect(edited.lifecycleNotes[0].editedAt).toBeTypeOf("number");
    expect(edited.lifecycleNotes[0].at).toBe(reassigned.lifecycleNotes[0].at);

    // Y también puede retirarla del cuaderno
    await tech.mutation(api.incidents.removeNote, {
      incidentId: incident._id,
      noteId,
    });

    // Retirarla no la borra: sigue en el cuaderno, oculta, con su texto y su
    // firma, y con la constancia de quién la retiró y cuándo.
    const removed = await firstIncident(coordinator);
    expect(removed.lifecycleNotes).toHaveLength(1);
    expect(removed.lifecycleNotes[0].note).toBe(
      "Diagnóstico inicial: el cable hace falso contacto (confirmado).",
    );
    expect(removed.lifecycleNotes[0].author).toBe("Iván Torres");
    expect(removed.lifecycleNotes[0].deletedAt).toBeTypeOf("number");
    expect(removed.lifecycleNotes[0].deletedBy).toBe("Iván Torres");

    // Se dio cuenta del error: la devuelve al cuaderno tal y como estaba.
    await tech.mutation(api.incidents.restoreNote, {
      incidentId: incident._id,
      noteId,
    });
    const restored = await firstIncident(coordinator);
    expect(restored.lifecycleNotes).toHaveLength(1);
    expect(restored.lifecycleNotes[0].note).toBe(
      "Diagnóstico inicial: el cable hace falso contacto (confirmado).",
    );
    expect(restored.lifecycleNotes[0].at).toBe(removed.lifecycleNotes[0].at);
    expect(restored.lifecycleNotes[0].deletedAt).toBeUndefined();
    expect(restored.lifecycleNotes[0].deletedBy).toBeUndefined();
  });

  test("cada corrección guarda lo que decía la nota antes", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });
    const noteId = await tech.mutation(api.incidents.addNote, {
      incidentId: incident._id,
      note: "El cable hace falso contacto.",
    });

    await tech.mutation(api.incidents.updateNote, {
      incidentId: incident._id,
      noteId,
      note: "El cable hace falso contacto (confirmado).",
    });
    await tech.mutation(api.incidents.updateNote, {
      incidentId: incident._id,
      noteId,
      note: "El cable hace falso contacto: sustituido el conector.",
    });

    // El historial se lee hacia atrás desde el texto actual: la primera
    // entrada es la nota original, y la última es la versión que se acaba de
    // sustituir, fechada con la corrección (que es lo que enseña la ficha).
    const after = await firstIncident(coordinator);
    const [nota] = after.lifecycleNotes;
    expect(nota.note).toBe(
      "El cable hace falso contacto: sustituido el conector.",
    );
    expect(nota.versions?.map((version) => version.note)).toEqual([
      "El cable hace falso contacto.",
      "El cable hace falso contacto (confirmado).",
    ]);
    expect(nota.versions?.[0].at).toBeTypeOf("number");
    expect(nota.versions?.at(-1)?.at).toBe(nota.editedAt);
  });

  test("el autor devuelve su nota a una versión anterior y deja la constancia", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });
    const noteId = await tech.mutation(api.incidents.addNote, {
      incidentId: incident._id,
      note: "El cable hace falso contacto.",
    });
    await tech.mutation(api.incidents.updateNote, {
      incidentId: incident._id,
      noteId,
      note: "El cable hace falso contacto: sustituido el conector.",
    });

    const edited = await firstIncident(coordinator);
    const [nota] = edited.lifecycleNotes;
    expect(nota.versions).toHaveLength(1);

    // Vuelve a lo que decía antes: es una corrección al revés.
    await tech.mutation(api.incidents.restoreNoteVersion, {
      incidentId: incident._id,
      noteId,
      versionIndex: 0,
    });

    const restored = await firstIncident(coordinator);
    const [vuelta] = restored.lifecycleNotes;
    expect(restored.lifecycleNotes).toHaveLength(1);
    expect(vuelta.note).toBe("El cable hace falso contacto.");
    // El texto que había se archiva igual: el historial no pierde ni un paso.
    expect(vuelta.versions?.map((item) => item.note)).toEqual([
      "El cable hace falso contacto.",
      "El cable hace falso contacto: sustituido el conector.",
    ]);
    // Y la nota no se mueve de sitio ni cambia de firma.
    expect(vuelta.at).toBe(nota.at);
    expect(vuelta.author).toBe(nota.author);
    // La constancia: quién la restauró, cuándo y a qué versión se volvió.
    expect(vuelta.restoredAt).toBeTypeOf("number");
    expect(vuelta.editedAt).toBe(vuelta.restoredAt);
    expect(vuelta.restoredBy).toBe("Iván Torres");
    expect(vuelta.restoredVersion).toBe(0);
  });

  test("volver a la versión que ya está puesta no inventa una corrección", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });
    const noteId = await tech.mutation(api.incidents.addNote, {
      incidentId: incident._id,
      note: "Probado en carga sin fallos.",
    });
    await tech.mutation(api.incidents.updateNote, {
      incidentId: incident._id,
      noteId,
      note: "Probado en carga sin fallos (dos horas).",
    });

    const edited = await firstIncident(coordinator);
    expect(edited.lifecycleNotes[0].versions).toHaveLength(1);
    await tech.mutation(api.incidents.restoreNoteVersion, {
      incidentId: incident._id,
      noteId,
      versionIndex: 0,
    });
    const first = await firstIncident(coordinator);

    // La nota ya dice eso: la segunda vuelta no añade nada al historial.
    await tech.mutation(api.incidents.restoreNoteVersion, {
      incidentId: incident._id,
      noteId,
      versionIndex: 0,
    });
    const second = await firstIncident(coordinator);
    expect(second.lifecycleNotes[0].note).toBe(first.lifecycleNotes[0].note);
    expect(second.lifecycleNotes[0].versions).toHaveLength(
      first.lifecycleNotes[0].versions!.length,
    );
    expect(second.lifecycleNotes[0].restoredAt).toBe(
      first.lifecycleNotes[0].restoredAt,
    );

    // Y la posición manda: por ella se elige la entrada, aunque las dos
    // escrituras hayan caído en el mismo milisegundo (aquí es el caso).
    await tech.mutation(api.incidents.restoreNoteVersion, {
      incidentId: incident._id,
      noteId,
      versionIndex: 1,
    });
    const third = await firstIncident(coordinator);
    expect(third.lifecycleNotes[0].note).toBe(
      "Probado en carga sin fallos (dos horas).",
    );
    expect(third.lifecycleNotes[0].restoredVersion).toBe(1);
  });

  test("deshacer una restauración devuelve la nota al texto que se acababa de quitar", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });
    const noteId = await tech.mutation(api.incidents.addNote, {
      incidentId: incident._id,
      note: "El cable hace falso contacto.",
    });
    await tech.mutation(api.incidents.updateNote, {
      incidentId: incident._id,
      noteId,
      note: "El cable hace falso contacto: sustituido el conector.",
    });

    // Lo que hace la ficha al pulsar «Deshacer» en el aviso: la posición a la
    // que hay que volver la calcula el mismo ayudante que usa la interfaz.
    const edited = await firstIncident(coordinator);
    const undoIndex = noteRestoreUndoIndex(edited.lifecycleNotes[0], 0);
    expect(undoIndex).toBe(1);

    await tech.mutation(api.incidents.restoreNoteVersion, {
      incidentId: incident._id,
      noteId,
      versionIndex: 0,
    });
    await tech.mutation(api.incidents.restoreNoteVersion, {
      incidentId: incident._id,
      noteId,
      versionIndex: undoIndex!,
    });

    const after = await firstIncident(coordinator);
    expect(after.lifecycleNotes[0].note).toBe(
      "El cable hace falso contacto: sustituido el conector.",
    );
    // Sin perder ningún paso: el historial guarda también el texto restaurado.
    expect(after.lifecycleNotes[0].versions?.map((item) => item.note)).toEqual([
      "El cable hace falso contacto.",
      "El cable hace falso contacto: sustituido el conector.",
      "El cable hace falso contacto.",
    ]);
    expect(after.lifecycleNotes[0].restoredVersion).toBe(undoIndex);
    expect(after.lifecycleNotes[0].restoredBy).toBe("Iván Torres");
  });

  test("restaurar una versión ajena o fuera de plazo no cuela", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });
    const noteId = await tech.mutation(api.incidents.addNote, {
      incidentId: incident._id,
      note: "Comprobado el conector: sigue fallando.",
    });
    await tech.mutation(api.incidents.updateNote, {
      incidentId: incident._id,
      noteId,
      note: "Comprobado el conector: sigue fallando (sin ruido).",
    });
    const edited = await firstIncident(coordinator);
    expect(edited.lifecycleNotes[0].versions).toHaveLength(1);

    // Quien coordina tampoco reescribe la nota de otro: volver atrás es escribir.
    await expectConvexError(
      coordinator.mutation(api.incidents.restoreNoteVersion, {
        incidentId: incident._id,
        noteId,
        versionIndex: 0,
      }),
      "Solo quien escribió la nota",
    );

    // Una versión que no está en el historial no se puede traer.
    await expectConvexError(
      tech.mutation(api.incidents.restoreNoteVersion, {
        incidentId: incident._id,
        noteId,
        versionIndex: 5,
      }),
      "Esa versión ya no está en el historial de la nota.",
    );

    // Y pasado el plazo la nota ya es histórico: tampoco se vuelve atrás.
    await t.run(async (ctx) => {
      const doc = await ctx.db.get(incident._id);
      await ctx.db.patch(incident._id, {
        lifecycleNotes: (doc?.lifecycleNotes ?? []).map((entry) => ({
          ...entry,
          createdAt: (entry.createdAt ?? entry.at) - 30 * 60 * 1000,
        })),
      });
    });
    await expectConvexError(
      tech.mutation(api.incidents.restoreNoteVersion, {
        incidentId: incident._id,
        noteId,
        versionIndex: 0,
      }),
      "15 minutos",
    );

    // Nada de eso tocó la nota: sigue como se corrigió.
    const after = await firstIncident(coordinator);
    expect(after.lifecycleNotes[0].note).toBe(
      "Comprobado el conector: sigue fallando (sin ruido).",
    );
    expect(after.lifecycleNotes[0].restoredAt).toBeUndefined();
  });

  test("una nota retirada hay que recuperarla antes de volver a una versión", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });
    const noteId = await tech.mutation(api.incidents.addNote, {
      incidentId: incident._id,
      note: "Anotado a las prisas.",
    });
    await tech.mutation(api.incidents.updateNote, {
      incidentId: incident._id,
      noteId,
      note: "Anotado con calma.",
    });
    const edited = await firstIncident(coordinator);
    expect(edited.lifecycleNotes[0].versions).toHaveLength(1);

    await tech.mutation(api.incidents.removeNote, {
      incidentId: incident._id,
      noteId,
    });

    // Mientras esté retirada no se toca: primero vuelve al cuaderno.
    await expectConvexError(
      tech.mutation(api.incidents.restoreNoteVersion, {
        incidentId: incident._id,
        noteId,
        versionIndex: 0,
      }),
      "Esa nota está retirada",
    );

    // Recuperada, el historial sigue ahí y se puede volver a él.
    await tech.mutation(api.incidents.restoreNote, {
      incidentId: incident._id,
      noteId,
    });
    await tech.mutation(api.incidents.restoreNoteVersion, {
      incidentId: incident._id,
      noteId,
      versionIndex: 0,
    });
    const after = await firstIncident(coordinator);
    expect(after.lifecycleNotes[0].note).toBe("Anotado a las prisas.");
    expect(after.lifecycleNotes[0].restoredBy).toBe("Iván Torres");
  });

  test("guardar la nota sin cambiarla no inventa una corrección", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });
    const noteId = await tech.mutation(api.incidents.addNote, {
      incidentId: incident._id,
      note: "Probado en carga sin fallos.",
    });

    // Solo cambian los espacios: no hay nada que archivar ni que fechar, así
    // que el historial no se llena de versiones idénticas.
    await tech.mutation(api.incidents.updateNote, {
      incidentId: incident._id,
      noteId,
      note: "  Probado en carga sin fallos.  ",
    });

    const after = await firstIncident(coordinator);
    expect(after.lifecycleNotes[0].note).toBe("Probado en carga sin fallos.");
    expect(after.lifecycleNotes[0].editedAt).toBeUndefined();
    expect(after.lifecycleNotes[0].versions).toBeUndefined();
  });

  test("el historial viaja con la nota al retirarla y recuperarla", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });
    const noteId = await tech.mutation(api.incidents.addNote, {
      incidentId: incident._id,
      note: "Se cambia el conector y se prueba.",
    });
    await tech.mutation(api.incidents.updateNote, {
      incidentId: incident._id,
      noteId,
      note: "Se cambia el conector y se prueba (sin ruido).",
    });

    await tech.mutation(api.incidents.removeNote, {
      incidentId: incident._id,
      noteId,
    });
    const retired = await firstIncident(coordinator);
    expect(retired.lifecycleNotes[0].versions?.[0].note).toBe(
      "Se cambia el conector y se prueba.",
    );

    // Recuperarla no la limpia: vuelve con lo que decía antes de cada cambio.
    await coordinator.mutation(api.incidents.restoreNote, {
      incidentId: incident._id,
      noteId,
    });
    const restored = await firstIncident(coordinator);
    expect(restored.lifecycleNotes[0].versions?.map((v) => v.note)).toEqual([
      "Se cambia el conector y se prueba.",
    ]);
    expect(restored.lifecycleNotes[0].editedAt).toBeTypeOf("number");
  });

  test("nadie más toca una nota ajena, tampoco quien coordina", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });
    const noteId = await tech.mutation(api.incidents.addNote, {
      incidentId: incident._id,
      note: "Comprobado el conector, sigue fallando.",
    });

    const forbidden = "Solo quien escribió la nota";
    await expectConvexError(
      coordinator.mutation(api.incidents.updateNote, {
        incidentId: incident._id,
        noteId,
        note: "Reescrita por quien coordina.",
      }),
      forbidden,
    );
    await expectConvexError(
      coordinator.mutation(api.incidents.removeNote, {
        incidentId: incident._id,
        noteId,
      }),
      forbidden,
    );

    // El rechazo es real: la nota sigue como se escribió.
    const after = await firstIncident(coordinator);
    expect(after.lifecycleNotes).toHaveLength(1);
    expect(after.lifecycleNotes[0].note).toBe(
      "Comprobado el conector, sigue fallando.",
    );
    expect(after.lifecycleNotes[0].editedAt).toBeUndefined();
  });

  test("pasado el plazo la nota ya es histórico del expediente", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });
    const noteId = await tech.mutation(api.incidents.addNote, {
      incidentId: incident._id,
      note: "Anotado a las prisas.",
    });

    // Se envejece la nota como si se hubiera escrito hace media hora.
    await t.run(async (ctx) => {
      const doc = await ctx.db.get(incident._id);
      await ctx.db.patch(incident._id, {
        lifecycleNotes: (doc?.lifecycleNotes ?? []).map((entry) => ({
          ...entry,
          createdAt: (entry.createdAt ?? entry.at) - 30 * 60 * 1000,
        })),
      });
    });

    await expectConvexError(
      tech.mutation(api.incidents.updateNote, {
        incidentId: incident._id,
        noteId,
        note: "Cambiada fuera de plazo.",
      }),
      "15 minutos",
    );
    await expectConvexError(
      tech.mutation(api.incidents.removeNote, {
        incidentId: incident._id,
        noteId,
      }),
      "15 minutos",
    );

    // Y el autor sigue pudiendo añadir una nota nueva: lo cerrado es lo viejo.
    await tech.mutation(api.incidents.addNote, {
      incidentId: incident._id,
      note: "Ampliación posterior.",
    });
    const after = await firstIncident(coordinator);
    expect(after.lifecycleNotes.map((entry) => entry.note)).toEqual([
      "Anotado a las prisas.",
      "Ampliación posterior.",
    ]);
  });

  test("las notas antiguas sin firma se quedan como están", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);

    // Notas heredadas tal y como quedaron en el expediente: la primera es la
    // forma antigua (sin firma ni identificador, como la que siembra la
    // muestra) y la segunda añade el identificador de una versión intermedia.
    await t.run(async (ctx) => {
      await ctx.db.patch(incident._id, {
        lifecycleNotes: [
          {
            note: "Nota heredada del cuaderno de papel.",
            author: "Elena Vidal",
            at: Date.now() - 24 * 60 * 60 * 1000,
          },
          {
            note: "Nota heredada a medias entre versiones.",
            author: "Elena Vidal",
            id: "legacy-1",
            at: Date.now() - 12 * 60 * 60 * 1000,
          },
        ],
      });
    });

    // Sin identificador no hay forma de dirigirse a ella, ni para leerla de
    // vuelta: la petición no encuentra nada que corregir.
    await expectConvexError(
      coordinator.mutation(api.incidents.updateNote, {
        incidentId: incident._id,
        noteId: "inventado",
        note: "Reescrita.",
      }),
      "Esa nota ya no está en la incidencia.",
    );

    // Y con identificador pero sin firma sigue siendo intocable para todos,
    // incluso para quien coordina: no hay autor al que pedirle el cambio.
    const sinFirma =
      "Esta nota ya forma parte del historial de la incidencia y no se puede cambiar.";
    await expectConvexError(
      coordinator.mutation(api.incidents.updateNote, {
        incidentId: incident._id,
        noteId: "legacy-1",
        note: "Reescrita.",
      }),
      sinFirma,
    );
    await expectConvexError(
      tech.mutation(api.incidents.removeNote, {
        incidentId: incident._id,
        noteId: "legacy-1",
      }),
      sinFirma,
    );

    const after = await firstIncident(coordinator);
    expect(after.lifecycleNotes.map((entry) => entry.note)).toEqual([
      "Nota heredada del cuaderno de papel.",
      "Nota heredada a medias entre versiones.",
    ]);
  });

  test("una nota que ya no está se detecta por su identificador", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });
    await tech.mutation(api.incidents.addNote, {
      incidentId: incident._id,
      note: "Primera y única nota.",
    });

    // Un identificador inventado no se confunde con ninguna posición.
    await expectConvexError(
      tech.mutation(api.incidents.updateNote, {
        incidentId: incident._id,
        noteId: "inventado",
        note: "Tarde.",
      }),
      "Esa nota ya no está en la incidencia.",
    );
  });

  test("una nota retirada se recupera antes de volver a tocarla", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });
    const noteId = await tech.mutation(api.incidents.addNote, {
      incidentId: incident._id,
      note: "Primera y única nota.",
    });
    await tech.mutation(api.incidents.removeNote, {
      incidentId: incident._id,
      noteId,
    });

    // La nota sigue ahí, así que una segunda pulsación del botón en otra
    // pestaña se topa con ella retirada en vez de tocar otra cosa.
    const retirada = "Esa nota está retirada";
    await expectConvexError(
      tech.mutation(api.incidents.updateNote, {
        incidentId: incident._id,
        noteId,
        note: "Tarde.",
      }),
      retirada,
    );
    await expectConvexError(
      tech.mutation(api.incidents.removeNote, {
        incidentId: incident._id,
        noteId,
      }),
      retirada,
    );

    const after = await firstIncident(coordinator);
    expect(after.lifecycleNotes).toHaveLength(1);
    expect(after.lifecycleNotes[0].deletedAt).toBeTypeOf("number");
  });

  test("el coordinador recupera la nota de otro y un técnico ajeno no", async () => {
    const { t, coordinator, tech, techId } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });
    const noteId = await tech.mutation(api.incidents.addNote, {
      incidentId: incident._id,
      note: "Sustituido el fusible y probado en carga.",
    });
    await tech.mutation(api.incidents.removeNote, {
      incidentId: incident._id,
      noteId,
    });

    const otherId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Nuria Cano",
        email: "nuria@taller.es",
        role: "technician",
      }),
    );
    const other = t.withIdentity({ subject: `${otherId}|session1` });

    // Otro técnico no puede devolver al cuaderno lo que no escribió.
    await expectConvexError(
      other.mutation(api.incidents.restoreNote, {
        incidentId: incident._id,
        noteId,
      }),
      "Solo quien escribió la nota o quien coordina la incidencia pueden recuperarla.",
    );

    // Quien coordina sí: la nota vuelve con su firma y su fecha.
    await coordinator.mutation(api.incidents.restoreNote, {
      incidentId: incident._id,
      noteId,
    });
    const restored = await firstIncident(coordinator);
    expect(restored.lifecycleNotes).toHaveLength(1);
    expect(restored.lifecycleNotes[0].note).toBe(
      "Sustituido el fusible y probado en carga.",
    );
    expect(restored.lifecycleNotes[0].author).toBe("Iván Torres");
    expect(restored.lifecycleNotes[0].authorId).toBe(techId);
    expect(restored.lifecycleNotes[0].deletedAt).toBeUndefined();

    // Y recuperarla dos veces no duplica nada.
    await expectConvexError(
      coordinator.mutation(api.incidents.restoreNote, {
        incidentId: incident._id,
        noteId,
      }),
      "Esa nota ya está en el cuaderno.",
    );
    expect((await firstIncident(coordinator)).lifecycleNotes).toHaveLength(1);
  });

  test("la recuperación no tiene plazo: lo perdido se puede rescatar después", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });
    const noteId = await tech.mutation(api.incidents.addNote, {
      incidentId: incident._id,
      note: "Anotado a las prisas y retirado por error.",
    });
    await tech.mutation(api.incidents.removeNote, {
      incidentId: incident._id,
      noteId,
    });

    // Pasa el tiempo (mucho más que el plazo para corregirla).
    await t.run(async (ctx) => {
      const doc = await ctx.db.get(incident._id);
      await ctx.db.patch(incident._id, {
        lifecycleNotes: (doc?.lifecycleNotes ?? []).map((entry) => ({
          ...entry,
          createdAt: (entry.createdAt ?? entry.at) - 90 * 60 * 1000,
          ...(entry.deletedAt !== undefined
            ? { deletedAt: entry.deletedAt - 90 * 60 * 1000 }
            : {}),
        })),
      });
    });

    await tech.mutation(api.incidents.restoreNote, {
      incidentId: incident._id,
      noteId,
    });
    const restored = await firstIncident(coordinator);
    expect(restored.lifecycleNotes).toHaveLength(1);
    expect(restored.lifecycleNotes[0].deletedAt).toBeUndefined();

    // Y una vez de vuelta en el cuaderno, el plazo viejo sigue corriendo para
    // su texto: recuperarla no la reabre a correcciones.
    await expectConvexError(
      tech.mutation(api.incidents.updateNote, {
        incidentId: incident._id,
        noteId,
        note: "Reescrita al recuperarla.",
      }),
      "15 minutos",
    );
  });

  test("el rastro de auditoría guarda quién adjuntó, renombró y quitó cada documento", async () => {
    const { t, coordinator, coordinatorId } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);

    const documentId = await coordinator.mutation(
      api.incidents.attachDocument,
      {
        incidentId: incident._id,
        name: "Medición voltaje.xlsx",
        note: "Valor inicial",
      },
    );

    const afterAttach = await coordinator.query(api.incidents.documentTrail, {
      incidentId: incident._id,
    });
    expect(afterAttach).toHaveLength(1);
    expect(afterAttach[0].action).toBe("attached");
    expect(afterAttach[0].name).toBe("Medición voltaje.xlsx");
    expect(afterAttach[0].documentId).toBe(documentId);
    // Queda firmado con el usuario, no solo con el nombre visible.
    expect(afterAttach[0].by).toBe("Elena Vidal");
    expect(afterAttach[0].byId).toBe(coordinatorId);
    expect(afterAttach[0].previousName).toBeUndefined();

    await coordinator.mutation(api.incidents.updateDocument, {
      incidentId: incident._id,
      documentId,
      name: "Medición voltaje revisada.xlsx",
      note: "Valor tras recalibración",
    });

    const afterEdit = await coordinator.query(api.incidents.documentTrail, {
      incidentId: incident._id,
    });
    expect(afterEdit).toHaveLength(2);
    // La edición recuerda el nombre anterior: en el rastro se lee como un
    // renombrado, no como un cambio sin más.
    const editEntry = afterEdit.find((entry) => entry.action === "edited");
    expect(editEntry?.name).toBe("Medición voltaje revisada.xlsx");
    expect(editEntry?.previousName).toBe("Medición voltaje.xlsx");

    await coordinator.mutation(api.incidents.removeDocument, {
      incidentId: incident._id,
      documentId,
    });

    const afterRemove = await coordinator.query(api.incidents.documentTrail, {
      incidentId: incident._id,
    });
    expect(afterRemove).toHaveLength(3);
    // Se va el documento del expediente, no su historia: el identificador
    // apunta a una fila ya borrada y el nombre es el que tenía al quitarlo.
    const removeEntry = afterRemove.find((entry) => entry.action === "removed");
    expect(removeEntry?.name).toBe("Medición voltaje revisada.xlsx");
    expect(removeEntry?.documentId).toBe(documentId);
    expect(removeEntry?.byId).toBe(coordinatorId);
    expect((await firstIncident(coordinator)).documents).toHaveLength(0);

    // El orden es del más reciente al más antiguo. Las tres altas de prueba
    // caen en el mismo milisegundo, así que se separan sus fechas a mano: lo
    // que se comprueba es el orden que da la consulta, no el reloj.
    await t.run(async (ctx) => {
      const entries = (
        await ctx.db.query("incidentDocumentLog").collect()
      ).sort((a, b) => a._creationTime - b._creationTime);
      const base = Date.now();
      for (const [index, entry] of entries.entries()) {
        await ctx.db.patch(entry._id, { at: base + index * 1000 });
      }
    });
    const ordered = await coordinator.query(api.incidents.documentTrail, {
      incidentId: incident._id,
    });
    expect(ordered.map((entry) => entry.action)).toEqual([
      "removed",
      "edited",
      "attached",
    ]);
  });

  test("corregir la nota del adjunto deja rastro sin confundirse con un renombrado", async () => {
    const { t, coordinator } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    const documentId = await coordinator.mutation(
      api.incidents.attachDocument,
      {
        incidentId: incident._id,
        name: "Parte de intervención.pdf",
      },
    );

    // Mismo nombre, otra nota: no es un renombrado y el rastro lo distingue.
    await coordinator.mutation(api.incidents.updateDocument, {
      incidentId: incident._id,
      documentId,
      name: "Parte de intervención.pdf",
      note: "Firmado por el proveedor",
    });

    const trail = await coordinator.query(api.incidents.documentTrail, {
      incidentId: incident._id,
    });
    expect(trail).toHaveLength(2);
    const editEntry = trail.find((entry) => entry.action === "edited");
    expect(editEntry?.name).toBe("Parte de intervención.pdf");
    expect(editEntry?.previousName).toBeUndefined();

    // Y guardar sin cambiar nada no escribe una línea nueva.
    await coordinator.mutation(api.incidents.updateDocument, {
      incidentId: incident._id,
      documentId,
      name: "Parte de intervención.pdf",
      note: "Firmado por el proveedor",
    });
    expect(
      await coordinator.query(api.incidents.documentTrail, {
        incidentId: incident._id,
      }),
    ).toHaveLength(2);
  });

  test("el rastro de los documentos lo lee solo quien coordina", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await coordinator.mutation(api.incidents.attachDocument, {
      incidentId: incident._id,
      name: "Acta de intervención.pdf",
    });

    // Antes de tocar nada ya se lee (y vacío no: con el alta del adjunto).
    expect(
      await coordinator.query(api.incidents.documentTrail, {
        incidentId: incident._id,
      }),
    ).toHaveLength(1);

    // El técnico asignado trabaja la incidencia y ve sus notas, pero el
    // expediente y su auditoría son cosa de coordinación.
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });
    await expectConvexError(
      tech.query(api.incidents.documentTrail, { incidentId: incident._id }),
      "Solo el coordinador",
    );

    await tech.mutation(api.incidents.addNote, {
      incidentId: incident._id,
      note: "Anotación del técnico.",
    });
    expect(
      await coordinator.query(api.incidents.documentTrail, {
        incidentId: incident._id,
      }),
    ).toHaveLength(1);
  });

  test("una incidencia sin documentos tiene el rastro vacío", async () => {
    const { t, coordinator } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);

    expect(
      await coordinator.query(api.incidents.documentTrail, {
        incidentId: incident._id,
      }),
    ).toEqual([]);
  });
});

describe("notas y descripciones con formato", () => {
  test("una nota se guarda como documento y el historial la compara por bloques", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });

    const html =
      "<p>Fuga de <strong>aceite</strong> en el obturador.</p><ul><li>Revisado el sello</li></ul>";
    const noteId = await tech.mutation(api.incidents.addNote, {
      incidentId: incident._id,
      note: html,
    });

    // Lo que se guarda es el documento del editor —sus bloques y sus marcas—,
    // no el HTML con el que se escribió...
    const saved = await firstIncident(coordinator);
    expect(richDocBlocks(saved.lifecycleNotes[0].note)).toEqual([
      {
        type: "paragraph",
        inline: [
          { text: "Fuga de " },
          { text: "aceite", marks: ["bold"] },
          { text: " en el obturador." },
        ],
      },
      {
        type: "list",
        ordered: false,
        items: [
          [{ type: "paragraph", inline: [{ text: "Revisado el sello" }] }],
        ],
      },
    ]);
    expect(saved.lifecycleNotes[0].note).not.toContain("<p>");
    // ...y lo que lee el resto del programa es su texto, sin formato.
    expect(richDocToPlainText(saved.lifecycleNotes[0].note)).toBe(
      "Fuga de aceite en el obturador.\nRevisado el sello",
    );

    await tech.mutation(api.incidents.updateNote, {
      incidentId: incident._id,
      noteId,
      note: "<p>Fuga de <em>aceite</em> en el obturador: sello sustituido.</p>",
    });
    const corrected = await firstIncident(coordinator);
    // El diff del historial compara bloque a bloque: la lista que desapareció
    // se marca como el bloque que era, y aquí no se cuela ni una etiqueta.
    const [change] = noteVersionChanges(corrected.lifecycleNotes[0]);
    expect(change.to).toContain("sello sustituido");
    expect(change.to).not.toContain("<");
    expect(change.blocksRemoved).toBe(1);
    expect(change.blocksAdded).toBe(0);
    const removed = change.parts
      .filter((part) => part.kind === "removed")
      .map((part) => part.text)
      .join(" ");
    expect(removed).toContain("Revisado");
    expect(removed).not.toContain("<");
  });

  test("el hueco vacío que deja el editor no es una nota", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });

    await expectConvexError(
      tech.mutation(api.incidents.addNote, {
        incidentId: incident._id,
        note: "<p></p>",
      }),
      "Escribe una nota válida",
    );
    // Una imagen sola sí es contenido: la nota existe aunque no diga nada.
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["foto"], { type: "image/png" })),
    );
    await tech.mutation(api.incidents.addNote, {
      incidentId: incident._id,
      note: `<p><img src="https://taller/x.png" data-storage-id="${storageId}"></p>`,
    });
    expect((await firstIncident(coordinator)).lifecycleNotes).toHaveLength(1);
  });

  test("la descripción con formato se guarda como documento y viaja como texto al informe", async () => {
    const { t, coordinator } = await setup();
    const rich =
      "<p>La cámara <strong>se apaga sola</strong> en directo cuando se mueve el cable.</p>";
    await t.mutation(api.incidents.report, {
      ...reportArgs,
      description: rich,
    });

    const incident = await firstIncident(coordinator);
    expect(incident.description).not.toContain("<p>");
    expect(richDocBlocks(incident.description)).toEqual([
      {
        type: "paragraph",
        inline: [
          { text: "La cámara " },
          { text: "se apaga sola", marks: ["bold"] },
          { text: " en directo cuando se mueve el cable." },
        ],
      },
    ]);
    expect(richDocToPlainText(incident.description)).toBe(
      "La cámara se apaga sola en directo cuando se mueve el cable.",
    );
  });
});

describe("archivo real de los documentos del expediente", () => {
  test("el documento adjunto guarda el archivo y la cola lo enlaza", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["informe"], { type: "application/pdf" })),
    );

    await coordinator.mutation(api.incidents.attachDocument, {
      incidentId: incident._id,
      name: "Reporte técnico.pdf",
      storageId,
    });

    const updated = await firstIncident(coordinator);
    expect(updated.documents[0].storageId).toBe(storageId);
    // El enlace del archivo viaja con la ficha: se abre sin otra consulta.
    expect(updated.documents[0].url).toContain("api/storage/");
    // Y es el mismo archivo para cualquiera con sesión que abra el expediente.
    expect((await firstIncident(tech)).documents[0].url).toBe(
      updated.documents[0].url,
    );
  });

  test("un documento sin archivo se queda con su nombre y sin enlace", async () => {
    const { t, coordinator } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);

    await coordinator.mutation(api.incidents.attachDocument, {
      incidentId: incident._id,
      name: "Documento heredado.pdf",
    });

    const updated = await firstIncident(coordinator);
    expect(updated.documents[0].name).toBe("Documento heredado.pdf");
    expect(updated.documents[0].storageId).toBeUndefined();
    expect(updated.documents[0].url).toBeNull();
  });

  test("quitar el documento borra su archivo del almacenamiento", async () => {
    const { t, coordinator } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["foto"], { type: "image/jpeg" })),
    );
    const documentId = await coordinator.mutation(
      api.incidents.attachDocument,
      {
        incidentId: incident._id,
        name: "Foto del daño.jpg",
        storageId,
      },
    );
    expect(await t.run((ctx) => ctx.storage.getUrl(storageId))).not.toBeNull();

    await coordinator.mutation(api.incidents.removeDocument, {
      incidentId: incident._id,
      documentId,
    });

    // El archivo se va con el documento: del adjunto retirado solo queda su
    // movimiento en el rastro.
    expect(await t.run((ctx) => ctx.storage.getUrl(storageId))).toBeNull();
  });

  test("reemplazar el archivo borra el anterior y firma el cambio en el rastro", async () => {
    const { t, coordinator, coordinatorId } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    const firstFile = await t.run((ctx) =>
      ctx.storage.store(new Blob(["informe v1"], { type: "application/pdf" })),
    );
    const secondFile = await t.run((ctx) =>
      ctx.storage.store(new Blob(["informe v2"], { type: "application/pdf" })),
    );
    const documentId = await coordinator.mutation(
      api.incidents.attachDocument,
      {
        incidentId: incident._id,
        name: "Informe de avería.pdf",
        storageId: firstFile,
        note: "Primera entrega",
      },
    );

    // Corregir el documento con un archivo nuevo: mismo nombre, otra nota.
    await coordinator.mutation(api.incidents.updateDocument, {
      incidentId: incident._id,
      documentId,
      name: "Informe de avería.pdf",
      note: "Corregido tras la revisión",
      storageId: secondFile,
    });

    // El documento pasa a apuntar al archivo nuevo, con su enlace resuelto...
    const updated = await firstIncident(coordinator);
    expect(updated.documents[0].storageId).toBe(secondFile);
    expect(updated.documents[0].url).toContain("api/storage/");
    // ...y el anterior se va del almacén: reemplazarlo es dejarlo fuera.
    expect(await t.run((ctx) => ctx.storage.getUrl(firstFile))).toBeNull();
    expect(await t.run((ctx) => ctx.storage.getUrl(secondFile))).not.toBeNull();

    // El cambio queda firmado con su propio movimiento, no como una edición.
    const trail = await coordinator.query(api.incidents.documentTrail, {
      incidentId: incident._id,
    });
    expect(trail).toHaveLength(2);
    expect(trail.map((entry) => entry.action)).toEqual([
      "replaced",
      "attached",
    ]);
    const replaced = trail[0];
    expect(replaced.name).toBe("Informe de avería.pdf");
    expect(replaced.previousName).toBeUndefined();
    expect(replaced.byId).toBe(coordinatorId);
    expect(replaced.documentId).toBe(documentId);
  });

  test("volver a mandar el mismo archivo no es un reemplazo ni deja rastro", async () => {
    const { t, coordinator } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["informe"], { type: "application/pdf" })),
    );
    const documentId = await coordinator.mutation(
      api.incidents.attachDocument,
      { incidentId: incident._id, name: "Informe.pdf", storageId },
    );

    // Guardar de nuevo con el mismo archivo no cambia nada: ni movimiento en
    // el rastro, ni archivo de más en el almacén.
    await coordinator.mutation(api.incidents.updateDocument, {
      incidentId: incident._id,
      documentId,
      name: "Informe.pdf",
      storageId,
    });

    expect(
      await coordinator.query(api.incidents.documentTrail, {
        incidentId: incident._id,
      }),
    ).toHaveLength(1);
    expect(await t.run((ctx) => ctx.storage.getUrl(storageId))).not.toBeNull();
  });

  test("la URL de subida la pide quien puede mover el expediente", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);

    expect(
      await coordinator.mutation(api.incidents.generateUploadUrl, {}),
    ).toContain("upload");

    // El técnico asignado trabaja la incidencia, pero no sube archivos a su
    // expediente: la URL de subida es de quien lo gestiona.
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });
    await expectConvexError(
      tech.mutation(api.incidents.generateUploadUrl, {}),
      "Solo el coordinador",
    );
  });
});

describe("auditoría de documentos de todas las incidencias", () => {
  const DAY = 24 * 60 * 60 * 1000;

  /**
   * Administrador del taller: la auditoría global es suya (la capacidad
   * `viewAudit` está bloqueada, así que ningún otro rol la tiene).
   */
  async function audience(t: ReturnType<typeof convexTest>) {
    const adminId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Marta Ruiz",
        email: "admin@taller.es",
        role: "admin",
      }),
    );
    return {
      adminId,
      admin: t.withIdentity({ subject: `${adminId}|session1` }),
    };
  }

  /** Incidencias de la prueba, por referencia (la cola viene ordenada). */
  async function porReferencia(authed: Authed) {
    const list = await authed.query(api.incidents.list, {});
    return new Map(list.map((item) => [item.reference, item]));
  }

  test("el administrador reúne los movimientos de todas las incidencias", async () => {
    const { t, coordinator, coordinatorId } = await setup();
    const { admin, adminId } = await audience(t);

    await t.mutation(api.incidents.report, reportArgs);
    await t.mutation(api.incidents.report, {
      ...reportArgs,
      // Otra persona: el aviso anti-inundación corta dos avisos seguidos del
      // mismo notificador, y aquí hacen falta dos incidencias.
      reporterName: "Nacho Gil",
      description: "El monitor de plató parpadea durante la emisión.",
    });
    const incidentes = await porReferencia(coordinator);
    const primera = incidentes.get("INC-0001")!;
    const segunda = incidentes.get("INC-0002")!;

    await coordinator.mutation(api.incidents.attachDocument, {
      incidentId: primera._id,
      name: "Medición voltaje.xlsx",
    });
    await admin.mutation(api.incidents.attachDocument, {
      incidentId: segunda._id,
      name: "Acta de intervención.pdf",
    });

    const audit = await admin.query(api.incidents.documentAudit, {});
    // Dos expedientes distintos en una sola lectura, del más reciente al más
    // antiguo y con la ficha de cada uno resuelta.
    expect(audit.entries).toHaveLength(2);
    expect(audit.unfilteredTotal).toBe(2);
    expect(audit.entries.map((entry) => entry.reference).sort()).toEqual([
      "INC-0001",
      "INC-0002",
    ]);
    expect(audit.entries[0].at).toBeGreaterThanOrEqual(audit.entries[1].at);

    const fila = audit.entries.find((entry) => entry.reference === "INC-0001")!;
    expect(fila.title).toBe("Cámara de estudio HDC-3500");
    expect(fila.status).toBe("reported");
    expect(fila.archived).toBe(false);
    expect(fila.action).toBe("attached");
    expect(fila.by).toBe("Elena Vidal");
    expect(fila.byId).toBe(coordinatorId);
    expect(fila.documentId).toBeTypeOf("string");

    expect(audit.summary).toEqual({
      total: 2,
      people: 2,
      incidents: 2,
      byAction: { attached: 2, edited: 0, replaced: 0, removed: 0 },
    });
    // Quiénes firman movimientos: el reparto que ofrece el filtro por persona.
    expect(audit.authors.map((item) => item.name)).toEqual([
      "Elena Vidal",
      "Marta Ruiz",
    ]);
    expect(audit.authors.map((item) => item.id).sort()).toEqual(
      [coordinatorId, adminId].sort(),
    );
  });

  test("la auditoría la consulta el administrador, no el coordinador ni el técnico", async () => {
    const { t, coordinator, tech } = await setup();
    const { admin } = await audience(t);
    await t.mutation(api.incidents.report, reportArgs);

    // La capacidad está bloqueada: solo el administrador la tiene.
    expect(
      (await admin.query(api.permissions.myPermissions, {})).grants.viewAudit,
    ).toBe(true);
    expect(
      (await coordinator.query(api.permissions.myPermissions, {})).grants
        .viewAudit,
    ).toBe(false);
    expect(
      (await tech.query(api.permissions.myPermissions, {})).grants.viewAudit,
    ).toBe(false);

    // El coordinador mueve documentos, pero no audita los de todo el taller.
    const incident = await firstIncident(coordinator);
    await coordinator.mutation(api.incidents.attachDocument, {
      incidentId: incident._id,
      name: "Acta.pdf",
    });
    await expectConvexError(
      coordinator.query(api.incidents.documentAudit, {}),
      "Solo el administrador puede consultar la auditoría de documentos.",
    );
    await expectConvexError(
      tech.query(api.incidents.documentAudit, {}),
      "Solo el administrador puede consultar la auditoría de documentos.",
    );
  });

  test("el filtro por persona deja fuera los movimientos de los demás", async () => {
    const { t, coordinator, coordinatorId } = await setup();
    const { admin, adminId } = await audience(t);
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await coordinator.mutation(api.incidents.attachDocument, {
      incidentId: incident._id,
      name: "Acta del coordinador.pdf",
    });
    await admin.mutation(api.incidents.attachDocument, {
      incidentId: incident._id,
      name: "Acta del administrador.pdf",
    });

    const soloAdmin = await admin.query(api.incidents.documentAudit, {
      userId: adminId,
    });
    expect(soloAdmin.entries.map((entry) => entry.name)).toEqual([
      "Acta del administrador.pdf",
    ]);
    expect(soloAdmin.entries[0].by).toBe("Marta Ruiz");
    expect(soloAdmin.entries[0].byId).toBe(adminId);
    expect(soloAdmin.summary).toEqual({
      total: 1,
      people: 1,
      incidents: 1,
      byAction: { attached: 1, edited: 0, replaced: 0, removed: 0 },
    });
    // El histórico completo sigue a la vista: el desplegable desde el que se
    // elige no se queda sin las demás personas.
    expect(soloAdmin.unfilteredTotal).toBe(2);
    expect(soloAdmin.authors).toHaveLength(2);

    const soloCoordinador = await admin.query(api.incidents.documentAudit, {
      userId: coordinatorId,
    });
    expect(soloCoordinador.entries.map((entry) => entry.name)).toEqual([
      "Acta del coordinador.pdf",
    ]);
  });

  test("el filtro por fechas incluye los días elegidos, enteros", async () => {
    const { t, coordinator } = await setup();
    const { admin } = await audience(t);
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    for (const name of ["Antiguo.pdf", "Medio.pdf", "Nuevo.pdf"]) {
      await coordinator.mutation(api.incidents.attachDocument, {
        incidentId: incident._id,
        name,
      });
    }

    // El reloj del rastro se reparte a mano: se comprueba el filtro, no cuándo
    // tardó la prueba en hacer clic.
    const base = Date.now();
    await t.run(async (ctx) => {
      const entries = await ctx.db.query("incidentDocumentLog").collect();
      const porNombre = (name: string) =>
        entries.find((entry) => entry.name === name)!._id;
      await ctx.db.patch(porNombre("Antiguo.pdf"), { at: base - 20 * DAY });
      await ctx.db.patch(porNombre("Medio.pdf"), { at: base - 5 * DAY });
      await ctx.db.patch(porNombre("Nuevo.pdf"), { at: base });
    });

    const hoy = await admin.query(api.incidents.documentAudit, {
      from: dayFromInput(dayInputValue(base)),
      to: endOfDay(base),
    });
    expect(hoy.entries.map((entry) => entry.name)).toEqual(["Nuevo.pdf"]);
    expect(hoy.unfilteredTotal).toBe(3);

    // El día del movimiento de en medio entra entero: el tope «hasta» es
    // inclusivo.
    const medio = await admin.query(api.incidents.documentAudit, {
      from: dayFromInput(dayInputValue(base - 5 * DAY)),
      to: endOfDay(base - 5 * DAY),
    });
    expect(medio.entries.map((entry) => entry.name)).toEqual(["Medio.pdf"]);

    const semana = auditPresetRange("week", base);
    const ultimosSiete = await admin.query(api.incidents.documentAudit, {
      from: semana.from ?? undefined,
      to: semana.to ?? undefined,
    });
    expect(ultimosSiete.entries.map((entry) => entry.name)).toEqual([
      "Nuevo.pdf",
      "Medio.pdf",
    ]);

    const mes = auditPresetRange("month", base);
    expect(
      (
        await admin.query(api.incidents.documentAudit, {
          from: mes.from ?? undefined,
          to: mes.to ?? undefined,
        })
      ).entries.map((entry) => entry.name),
    ).toEqual(["Nuevo.pdf", "Medio.pdf", "Antiguo.pdf"]);

    // Un tramo sin movimientos devuelve la lista vacía, no el histórico.
    expect(
      (
        await admin.query(api.incidents.documentAudit, {
          from: dayFromInput("2020-01-01"),
          to: endOfDay(dayFromInput("2020-01-31")!),
        })
      ).entries,
    ).toEqual([]);
  });

  test("el filtro por movimiento separa altas, ediciones y retiradas", async () => {
    const { t, coordinator } = await setup();
    const { admin } = await audience(t);
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    const documentId = await coordinator.mutation(
      api.incidents.attachDocument,
      {
        incidentId: incident._id,
        name: "Acta.pdf",
      },
    );
    await coordinator.mutation(api.incidents.updateDocument, {
      incidentId: incident._id,
      documentId,
      name: "Acta revisada.pdf",
    });
    await coordinator.mutation(api.incidents.removeDocument, {
      incidentId: incident._id,
      documentId,
    });

    const retiradas = await admin.query(api.incidents.documentAudit, {
      action: "removed",
    });
    expect(retiradas.entries).toHaveLength(1);
    expect(retiradas.entries[0].name).toBe("Acta revisada.pdf");
    expect(retiradas.summary).toEqual({
      total: 1,
      people: 1,
      incidents: 1,
      byAction: { attached: 0, edited: 0, replaced: 0, removed: 1 },
    });

    const ediciones = await admin.query(api.incidents.documentAudit, {
      action: "edited",
    });
    expect(ediciones.entries[0].previousName).toBe("Acta.pdf");

    // La incidencia archivada sigue contando: su expediente no se borra al
    // salir del día a día, y la auditoría lo dice.
    await t.run((ctx) =>
      ctx.db.patch(incident._id, { archivedAt: Date.now() }),
    );
    const todas = await admin.query(api.incidents.documentAudit, {});
    expect(todas.entries).toHaveLength(3);
    expect(todas.entries.every((entry) => entry.archived)).toBe(true);
    expect(todas.entries.every((entry) => entry.reference === "INC-0001")).toBe(
      true,
    );
  });

  test("un movimiento cuya incidencia ya no está se sigue leyendo, sin ficha", async () => {
    const { t, coordinator } = await setup();
    const { admin } = await audience(t);
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await coordinator.mutation(api.incidents.attachDocument, {
      incidentId: incident._id,
      name: "Acta.pdf",
    });
    await t.run((ctx) => ctx.db.delete(incident._id));

    const audit = await admin.query(api.incidents.documentAudit, {});
    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0].name).toBe("Acta.pdf");
    expect(audit.entries[0].reference).toBe("—");
    expect(audit.entries[0].title).toBe("");
    expect(audit.entries[0].status).toBeUndefined();
    expect(audit.entries[0].archived).toBe(false);
  });

  test("sin movimientos la auditoría llega vacía", async () => {
    const { t } = await setup();
    const { admin } = await audience(t);
    await t.mutation(api.incidents.report, reportArgs);

    expect(await admin.query(api.incidents.documentAudit, {})).toEqual({
      entries: [],
      authors: [],
      summary: {
        total: 0,
        people: 0,
        incidents: 0,
        byAction: { attached: 0, edited: 0, replaced: 0, removed: 0 },
      },
      unfilteredTotal: 0,
    });
  });
});

describe("avisos de auditoría del expediente", () => {
  /**
   * El administrador es quien audita el expediente (la capacidad `viewAudit`
   * está bloqueada), así que de partida los avisos de documentos son suyos: aquí
   * se comprueba qué movimientos le llegan y a quién más, con dos
   * administradores para poder mirar la firma de quien provoca el aviso. A quién
   * le llegan se reparte por rol desde «Ajustes del taller», y eso también se
   * prueba aquí, que es donde está el aviso de verdad.
   */
  async function plantilla() {
    const { t, coordinator, coordinatorId, tech } = await setup();
    const adminId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Marta Ruiz",
        email: "admin@taller.es",
        role: "admin",
      }),
    );
    const otroAdminId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Pablo León",
        email: "admin2@taller.es",
        role: "admin",
      }),
    );
    return {
      t,
      coordinator,
      coordinatorId,
      tech,
      admin: t.withIdentity({ subject: `${adminId}|session1` }),
      otroAdmin: t.withIdentity({ subject: `${otroAdminId}|session1` }),
    };
  }

  /** Avisos de expediente que tiene esa persona. */
  async function avisosDeExpediente(authed: Authed) {
    const notifications = await authed.query(api.notifications.list, {});
    return notifications.filter((item) =>
      item.text.startsWith("Expediente de"),
    );
  }

  /**
   * Adjunta un documento y lo retira: la retirada es el movimiento que avisa
   * siempre, esté la incidencia abierta o cerrada. Devuelve el documento
   * retirado, por si la prueba quiere mirarlo.
   */
  async function retirarDocumento(
    actor: Authed,
    incidentId: Id<"incidents">,
    name: string,
  ) {
    const documentId = await actor.mutation(api.incidents.attachDocument, {
      incidentId,
      name,
    });
    await actor.mutation(api.incidents.removeDocument, {
      incidentId,
      documentId,
    });
    return documentId;
  }

  /** Un archivo distinto en cada subida: reemplazar es apuntar a otro. */
  let versionArchivo = 0;
  async function archivo(t: ReturnType<typeof convexTest>) {
    versionArchivo += 1;
    return await t.run((ctx) =>
      ctx.storage.store(
        new Blob([`version ${versionArchivo}`], { type: "application/pdf" }),
      ),
    );
  }

  /**
   * Adjunta un documento con su archivo y lo reemplaza por otro. El reemplazo es
   * el otro movimiento que destruye el archivo de un documento —el anterior se
   * borra del almacén, como en la retirada—, así que avisa en las mismas
   * condiciones y a los mismos: aquí se comprueba con la misma técnica que las
   * retiradas, moviendo la audiencia y mirando quién lo recibe.
   */
  async function reemplazarArchivo(
    t: ReturnType<typeof convexTest>,
    actor: Authed,
    incidentId: Id<"incidents">,
    name: string,
  ) {
    const documentId = await actor.mutation(api.incidents.attachDocument, {
      incidentId,
      name,
      storageId: await archivo(t),
    });
    await actor.mutation(api.incidents.updateDocument, {
      incidentId,
      documentId,
      name,
      storageId: await archivo(t),
    });
    return documentId;
  }

  test("el alta al día no avisa; la retirada sí, y a los administradores", async () => {
    const { t, coordinator, tech, admin, otroAdmin } = await plantilla();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);

    const documentId = await coordinator.mutation(
      api.incidents.attachDocument,
      { incidentId: incident._id, name: "Medición voltaje.xlsx" },
    );
    // Adjuntar un documento a una incidencia en curso es rutina: no se avisa.
    expect(await avisosDeExpediente(admin)).toEqual([]);
    expect(await avisosDeExpediente(otroAdmin)).toEqual([]);

    await coordinator.mutation(api.incidents.removeDocument, {
      incidentId: incident._id,
      documentId,
    });

    // Un documento retirado no deja nada en la ficha: el administrador se
    // entera por aquí, y quien lo quitó —que es el coordinador— no recibe nada:
    // el aviso es del administrador, no de la coordinación entera.
    const avisos = await avisosDeExpediente(admin);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].text).toBe(
      "Expediente de INC-0001 · se retiró «Medición voltaje.xlsx»",
    );
    expect(avisos[0].read).toBe(false);
    expect(avisos[0].incidentId).toBe(incident._id);
    expect(await avisosDeExpediente(otroAdmin)).toHaveLength(1);
    expect(await avisosDeExpediente(coordinator)).toEqual([]);
    // El técnico tampoco: no es un aviso de coordinación, es de auditoría.
    expect(await avisosDeExpediente(tech)).toEqual([]);
  });

  test("reemplazar el archivo avisa aunque la incidencia esté abierta", async () => {
    const { t, coordinator, admin, otroAdmin } = await plantilla();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    const firstFile = await t.run((ctx) =>
      ctx.storage.store(new Blob(["v1"], { type: "application/pdf" })),
    );
    const secondFile = await t.run((ctx) =>
      ctx.storage.store(new Blob(["v2"], { type: "application/pdf" })),
    );
    const documentId = await coordinator.mutation(
      api.incidents.attachDocument,
      {
        incidentId: incident._id,
        name: "Medición voltaje.xlsx",
        storageId: firstFile,
      },
    );
    // El alta es rutina: todavía no hay nada que contar.
    expect(await avisosDeExpediente(admin)).toEqual([]);

    await coordinator.mutation(api.incidents.updateDocument, {
      incidentId: incident._id,
      documentId,
      name: "Medición voltaje.xlsx",
      storageId: secondFile,
    });

    // El archivo anterior ya no está y el administrador se entera: como la
    // retirada, es un movimiento que destruye el archivo de un documento.
    const avisos = await avisosDeExpediente(admin);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].text).toBe(
      "Expediente de INC-0001 · se reemplazó el archivo de «Medición voltaje.xlsx»",
    );
    expect(await avisosDeExpediente(otroAdmin)).toHaveLength(1);
  });

  test("el expediente de una incidencia cerrada avisa aunque solo sea un alta", async () => {
    const { t, coordinator, tech, admin } = await plantilla();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);

    // Cerrada in situ: el caso queda terminado y su expediente, quieto.
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });
    await tech.mutation(api.incidents.verify, {
      incidentId: incident._id,
      outcome: "onsite",
      notes: "Cable de alimentación reinsertado.",
    });
    expect((await firstIncident(coordinator)).status).toBe("resolved");

    // Alta sobre la incidencia ya cerrada: eso sí avisa, y lo dice.
    const documentId = await coordinator.mutation(
      api.incidents.attachDocument,
      { incidentId: incident._id, name: "Informe final.pdf" },
    );
    let avisos = await avisosDeExpediente(admin);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].text).toBe(
      "Expediente de INC-0001 (incidencia cerrada) · se adjuntó «Informe final.pdf»",
    );

    // Renombrarlo también, con los dos nombres en el aviso.
    await coordinator.mutation(api.incidents.updateDocument, {
      incidentId: incident._id,
      documentId,
      name: "Informe final firmado.pdf",
    });
    avisos = await avisosDeExpediente(admin);
    expect(avisos).toHaveLength(2);
    expect(avisos.map((item) => item.text)).toContain(
      "Expediente de INC-0001 (incidencia cerrada) · se renombró «Informe final.pdf» a «Informe final firmado.pdf»",
    );

    // Y corregir solo la nota del adjunto no es un renombrado.
    await coordinator.mutation(api.incidents.updateDocument, {
      incidentId: incident._id,
      documentId,
      note: "Firmado por el proveedor",
    });
    avisos = await avisosDeExpediente(admin);
    expect(avisos).toHaveLength(3);
    expect(avisos.map((item) => item.text)).toContain(
      "Expediente de INC-0001 (incidencia cerrada) · se editó «Informe final firmado.pdf»",
    );

    // Guardar sin cambiar nada no deja rastro ni aviso.
    await coordinator.mutation(api.incidents.updateDocument, {
      incidentId: incident._id,
      documentId,
      note: "Firmado por el proveedor",
    });
    expect(await avisosDeExpediente(admin)).toHaveLength(3);
  });

  test("el aviso queda aunque lo provoque el propio administrador", async () => {
    const { t, coordinator, tech, admin, otroAdmin } = await plantilla();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await tech.mutation(api.incidents.selfAssign, { incidentId: incident._id });
    await tech.mutation(api.incidents.verify, {
      incidentId: incident._id,
      outcome: "onsite",
    });

    // El administrador mueve el expediente de la incidencia cerrada y la
    // constancia queda en su propio avisador: en un taller de un solo
    // administrador, de otro modo el aviso no lo vería nadie.
    await admin.mutation(api.incidents.attachDocument, {
      incidentId: incident._id,
      name: "Informe final.pdf",
    });

    const texto =
      "Expediente de INC-0001 (incidencia cerrada) · se adjuntó «Informe final.pdf»";
    expect((await avisosDeExpediente(admin)).map((item) => item.text)).toEqual([
      texto,
    ]);
    expect(
      (await avisosDeExpediente(otroAdmin)).map((item) => item.text),
    ).toEqual([texto]);
  });

  test("la audiencia configurada manda: el aviso va a esos roles y a nadie más", async () => {
    const { t, coordinator, tech, admin, otroAdmin } = await plantilla();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);

    // De partida el aviso es de quien audita: el administrador. El propio
    // movimiento lo provoca la coordinación, que no recibe nada.
    await retirarDocumento(coordinator, incident._id, "Medición voltaje.xlsx");
    expect((await avisosDeExpediente(admin)).map((item) => item.text)).toEqual([
      "Expediente de INC-0001 · se retiró «Medición voltaje.xlsx»",
    ]);
    expect(await avisosDeExpediente(coordinator)).toEqual([]);

    // Se añade la coordinación y se quita al administrador: la lista guardada es
    // la que manda, y sacar a un rol es tan válido como meterlo.
    await admin.mutation(api.auditAlerts.setAudience, {
      roleKeys: ["manager"],
    });
    await retirarDocumento(
      coordinator,
      incident._id,
      "Acta de intervención.pdf",
    );

    expect(
      (await avisosDeExpediente(coordinator)).map((item) => item.text),
    ).toEqual([
      "Expediente de INC-0001 · se retiró «Acta de intervención.pdf»",
    ]);
    // El administrador sigue con el aviso anterior y no recibe el nuevo.
    expect((await avisosDeExpediente(admin)).map((item) => item.text)).toEqual([
      "Expediente de INC-0001 · se retiró «Medición voltaje.xlsx»",
    ]);
    // El otro administrador tampoco recibe el segundo movimiento: solo le queda
    // el aviso que sí le llegó con la audiencia de partida.
    expect(
      (await avisosDeExpediente(otroAdmin)).map((item) => item.text),
    ).toEqual(["Expediente de INC-0001 · se retiró «Medición voltaje.xlsx»"]);
    expect(await avisosDeExpediente(tech)).toEqual([]);

    // Al contrario que el resto de avisos, aquí no se excluye a quien provoca
    // el movimiento: es la constancia del cambio, no una novedad, así que el
    // coordinador que retiró el documento también lo recibe.
    const propios = await avisosDeExpediente(coordinator);
    expect(propios).toHaveLength(1);
    expect(propios[0].read).toBe(false);
  });

  test("un rol personalizado añadido a la audiencia recibe el aviso", async () => {
    const { t, coordinator, admin } = await plantilla();
    const key = await admin.mutation(api.permissions.createRole, {
      label: "Auxiliar de almacén",
      templateKey: "technician",
    });
    const keeperId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Nuria Cano",
        email: "almacen@taller.es",
        role: key,
      }),
    );
    const keeper = t.withIdentity({ subject: `${keeperId}|session1` });
    await admin.mutation(api.auditAlerts.setAudience, { roleKeys: [key] });

    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await retirarDocumento(coordinator, incident._id, "Medición voltaje.xlsx");

    // Los roles personalizados reparten igual que los de serie.
    expect((await avisosDeExpediente(keeper)).map((item) => item.text)).toEqual(
      ["Expediente de INC-0001 · se retiró «Medición voltaje.xlsx»"],
    );
    expect(await avisosDeExpediente(admin)).toEqual([]);
  });

  test("sin nadie en la audiencia el movimiento no le avisa a nadie", async () => {
    const { t, coordinator, tech, admin, otroAdmin } = await plantilla();
    await admin.mutation(api.auditAlerts.setAudience, { roleKeys: [] });

    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await retirarDocumento(coordinator, incident._id, "Medición voltaje.xlsx");

    // El movimiento queda en el rastro del módulo de Auditoría, que es de quien
    // audita; lo que no hay es aviso.
    expect(await avisosDeExpediente(admin)).toEqual([]);
    expect(await avisosDeExpediente(otroAdmin)).toEqual([]);
    expect(await avisosDeExpediente(coordinator)).toEqual([]);
    expect(await avisosDeExpediente(tech)).toEqual([]);
  });

  test("la audiencia configurada manda también en un reemplazo de archivo", async () => {
    const { t, coordinator, tech, admin, otroAdmin } = await plantilla();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);

    // De partida el aviso es de quien audita: los dos administradores. Quien
    // provoca el reemplazo es la coordinación, que no recibe nada.
    const reemplazo =
      "Expediente de INC-0001 · se reemplazó el archivo de «Medición voltaje.xlsx»";
    await reemplazarArchivo(
      t,
      coordinator,
      incident._id,
      "Medición voltaje.xlsx",
    );
    expect((await avisosDeExpediente(admin)).map((item) => item.text)).toEqual([
      reemplazo,
    ]);
    expect(
      (await avisosDeExpediente(otroAdmin)).map((item) => item.text),
    ).toEqual([reemplazo]);
    expect(await avisosDeExpediente(coordinator)).toEqual([]);
    expect(await avisosDeExpediente(tech)).toEqual([]);

    // Se añade la coordinación y se quita al administrador: la lista guardada es
    // la que manda también aquí, y el reemplazo siguiente va a ese rol.
    await admin.mutation(api.auditAlerts.setAudience, {
      roleKeys: ["manager"],
    });
    await reemplazarArchivo(
      t,
      coordinator,
      incident._id,
      "Acta de intervención.pdf",
    );

    expect(
      (await avisosDeExpediente(coordinator)).map((item) => item.text),
    ).toEqual([
      "Expediente de INC-0001 · se reemplazó el archivo de «Acta de intervención.pdf»",
    ]);
    // Los administradores se quedan con el aviso anterior y no reciben el nuevo.
    expect((await avisosDeExpediente(admin)).map((item) => item.text)).toEqual([
      reemplazo,
    ]);
    expect(
      (await avisosDeExpediente(otroAdmin)).map((item) => item.text),
    ).toEqual([reemplazo]);
    expect(await avisosDeExpediente(tech)).toEqual([]);

    // Y el movimiento queda en el rastro, que es de donde se lee lo que pasó
    // aunque no llegue ningún aviso.
    expect(
      (await admin.query(api.incidents.documentAudit, {})).summary.byAction,
    ).toMatchObject({ replaced: 2, removed: 0 });
  });

  test("un rol personalizado añadido a la audiencia recibe también el reemplazo", async () => {
    const { t, coordinator, admin } = await plantilla();
    const key = await admin.mutation(api.permissions.createRole, {
      label: "Auxiliar de almacén",
      templateKey: "technician",
    });
    const keeperId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Nuria Cano",
        email: "almacen@taller.es",
        role: key,
      }),
    );
    const keeper = t.withIdentity({ subject: `${keeperId}|session1` });
    await admin.mutation(api.auditAlerts.setAudience, { roleKeys: [key] });

    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await reemplazarArchivo(
      t,
      coordinator,
      incident._id,
      "Medición voltaje.xlsx",
    );

    // Los roles personalizados reparten igual que los de serie, y el
    // administrador —que ya no está en la lista— no recibe nada.
    expect((await avisosDeExpediente(keeper)).map((item) => item.text)).toEqual(
      [
        "Expediente de INC-0001 · se reemplazó el archivo de «Medición voltaje.xlsx»",
      ],
    );
    expect(await avisosDeExpediente(admin)).toEqual([]);
  });

  test("sin nadie en la audiencia, un reemplazo no le avisa a nadie", async () => {
    const { t, coordinator, tech, admin, otroAdmin } = await plantilla();
    await admin.mutation(api.auditAlerts.setAudience, { roleKeys: [] });

    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);
    await reemplazarArchivo(
      t,
      coordinator,
      incident._id,
      "Medición voltaje.xlsx",
    );

    // El reemplazo ocurrió —está en el rastro, que es de quien audita—; lo que
    // no hay es aviso, porque no hay nadie apuntado a recibirlo.
    expect(
      (await admin.query(api.incidents.documentAudit, {})).summary.byAction,
    ).toMatchObject({ replaced: 1 });
    expect(await avisosDeExpediente(admin)).toEqual([]);
    expect(await avisosDeExpediente(otroAdmin)).toEqual([]);
    expect(await avisosDeExpediente(coordinator)).toEqual([]);
    expect(await avisosDeExpediente(tech)).toEqual([]);

    // Y con la audiencia de partida —quien audita— el mismo movimiento sí avisa:
    // lo que decide es la lista, no el movimiento.
    await admin.mutation(api.auditAlerts.setAudience, { roleKeys: ["admin"] });
    await reemplazarArchivo(
      t,
      coordinator,
      incident._id,
      "Acta de intervención.pdf",
    );
    expect((await avisosDeExpediente(admin)).map((item) => item.text)).toEqual([
      "Expediente de INC-0001 · se reemplazó el archivo de «Acta de intervención.pdf»",
    ]);
  });
});

describe("rastro de documentos de un lote de incidencias", () => {
  /** Incidencias de la prueba por referencia (la cola viene ordenada). */
  async function porReferencia(authed: Authed) {
    const list = await authed.query(api.incidents.list, {});
    return new Map(list.map((item) => [item.reference, item]));
  }

  test("devuelve los movimientos del lote pedido, y solo de esas incidencias", async () => {
    const { t, coordinator } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    // Cada aviso, de una persona distinta: el anti-inundación de `report` corta
    // dos notificaciones seguidas del mismo notificador.
    await t.mutation(api.incidents.report, {
      ...reportArgs,
      reporterName: "Nacho Gil",
      description: "El monitor de plató parpadea durante la emisión.",
    });
    await t.mutation(api.incidents.report, {
      ...reportArgs,
      reporterName: "Sara Muro",
      description: "El foco no mantiene la intensidad al 100 %.",
    });
    const incidencias = await porReferencia(coordinator);
    const primera = incidencias.get("INC-0001")!;
    const segunda = incidencias.get("INC-0002")!;
    const tercera = incidencias.get("INC-0003")!;

    await coordinator.mutation(api.incidents.attachDocument, {
      incidentId: primera._id,
      name: "Acta.pdf",
    });
    const enSegunda = await coordinator.mutation(api.incidents.attachDocument, {
      incidentId: segunda._id,
      name: "Plano.pdf",
    });
    await coordinator.mutation(api.incidents.removeDocument, {
      incidentId: segunda._id,
      documentId: enSegunda,
    });
    await coordinator.mutation(api.incidents.attachDocument, {
      incidentId: tercera._id,
      name: "Fuera del lote.pdf",
    });

    const lote = await coordinator.query(api.incidents.documentTrails, {
      incidentIds: [primera._id, segunda._id],
    });
    expect(lote).toHaveLength(3);
    expect(new Set(lote.map((entry) => entry.incidentId))).toEqual(
      new Set([primera._id, segunda._id]),
    );
    // La tercera no entra: el lote no se lleva el histórico entero.
    expect(lote.some((entry) => entry.name === "Fuera del lote.pdf")).toBe(
      false,
    );
    // Del movimiento más reciente al más antiguo, como el rastro de una ficha.
    expect(lote[0].at).toBeGreaterThanOrEqual(lote[1].at);
    // Y la retirada sigue contando, con el nombre que tenía el documento.
    expect(
      lote.some(
        (entry) => entry.action === "removed" && entry.name === "Plano.pdf",
      ),
    ).toBe(true);

    // Pedir ninguna incidencia no devuelve todo: devuelve nada.
    expect(
      await coordinator.query(api.incidents.documentTrails, {
        incidentIds: [],
      }),
    ).toEqual([]);
  });

  test("el rastro del lote lo lee solo quien coordina", async () => {
    const { t, coordinator, tech } = await setup();
    await t.mutation(api.incidents.report, reportArgs);
    const incident = await firstIncident(coordinator);

    await expectConvexError(
      tech.query(api.incidents.documentTrails, {
        incidentIds: [incident._id],
      }),
      "Solo el coordinador",
    );
    // El coordinador sí, aunque el expediente todavía no se haya movido.
    expect(
      await coordinator.query(api.incidents.documentTrails, {
        incidentIds: [incident._id],
      }),
    ).toEqual([]);
  });
});

describe("papelera de incidencias", () => {
  const DAY = 24 * 60 * 60 * 1000;

  /** La incidencia notificada sin sesión, como llega desde `/reportar`. */
  async function reported() {
    const contexto = await setup();
    const { reference, code } = await contexto.t.mutation(
      api.incidents.report,
      reportArgs,
    );
    const [incident] = await contexto.coordinator.query(api.incidents.list, {});
    return {
      ...contexto,
      reference,
      code,
      incident,
      incidentId: incident._id,
    };
  }

  test("retirar la saca de la cola y del seguimiento, y la deja en la papelera con su plazo", async () => {
    const { coordinator, reference, code, incidentId } = await reported();

    await coordinator.mutation(api.incidents.withdraw, {
      incidentId,
      reason: "Duplicada de la INC-0001",
    });

    // Fuera de las dos caras de la cola y del seguimiento, por su referencia y
    // por su código: una retirada no se sigue, y si se recupera vuelve a
    // contestar por los dos.
    expect(
      await coordinator.query(api.incidents.list, { includeArchived: true }),
    ).toEqual([]);
    expect(
      await coordinator.query(api.incidents.byReference, { reference }),
    ).toBeNull();
    // Y por el código tampoco: el aviso por correo se lo cuenta, pero su código
    // deja de contestar hasta que se recupere.
    expect(
      await coordinator.mutation(api.incidents.byCode, { code }),
    ).toBeNull();

    const papelera = await coordinator.query(api.incidents.trash, {});
    expect(papelera.items).toHaveLength(1);
    expect(papelera.items[0].reference).toBe(reference);
    expect(papelera.items[0].deletedBy).toBe("Elena Vidal");
    expect(papelera.items[0].deletedReason).toBe("Duplicada de la INC-0001");
    expect(papelera.items[0].archived).toBe(false);
    expect(papelera.retentionDays).toBe(DEFAULT_TRASH_RETENTION_DAYS);
    // El plazo se apunta al retirarla: se cuenta desde ahora, no desde el plazo
    // que tenga el taller el día que caduque.
    expect(papelera.items[0].purgeAt - papelera.items[0].deletedAt).toBe(
      DEFAULT_TRASH_RETENTION_DAYS * DAY,
    );
  });

  test("recuperarla la devuelve tal y como estaba, con su traza", async () => {
    const { t, coordinator, reference, code, incidentId } = await reported();
    await coordinator.mutation(api.incidents.withdraw, { incidentId });

    await coordinator.mutation(api.incidents.restore, { incidentId });

    const cola = await coordinator.query(api.incidents.list, {});
    expect(cola.map((item) => item.reference)).toEqual([reference]);
    expect(
      await coordinator.query(api.incidents.byReference, { reference }),
    ).not.toBeNull();
    // Y quien la notificó vuelve a poder seguirla con su código.
    expect(
      (await coordinator.mutation(api.incidents.byCode, { code }))?.code,
    ).toBe(code);
    expect((await coordinator.query(api.incidents.trash, {})).items).toEqual(
      [],
    );

    const stored = await t.run((ctx) => ctx.db.get(incidentId));
    expect(stored?.deletedAt).toBeUndefined();
    expect(stored?.purgeAt).toBeUndefined();
    expect(stored?.deletedReason).toBeUndefined();
    // Los dos pasos quedan escritos en la ficha, detrás del aviso original.
    expect(stored?.history.at(-2)?.note).toBe("Retirada a la papelera");
    expect(stored?.history.at(-1)?.note).toBe("Recuperada de la papelera");
  });

  test("retirar es cosa de coordinación, y borrar exige haber retirado antes", async () => {
    const { t, coordinator, tech, incidentId } = await reported();

    await expectConvexError(
      tech.mutation(api.incidents.withdraw, { incidentId }),
      "Solo el coordinador puede retirar una incidencia",
    );
    await expectConvexError(
      tech.query(api.incidents.trash, {}),
      "No tienes permisos para ver la papelera de incidencias",
    );
    // Borrar de un tirón lo que nunca pasó por la papelera no se puede: sería
    // irreversible sin margen para arrepentirse.
    await expectConvexError(
      coordinator.mutation(api.incidents.deleteNow, { incidentId }),
      "Retira la incidencia antes de borrarla",
    );
    expect(await t.run((ctx) => ctx.db.get(incidentId))).not.toBeNull();
  });

  test("borrar ya se lleva la incidencia, su expediente y sus avisos", async () => {
    const { t, coordinator, incidentId } = await reported();
    await coordinator.mutation(api.incidents.attachDocument, {
      incidentId,
      name: "Parte interno.pdf",
    });
    await coordinator.mutation(api.incidents.withdraw, { incidentId });

    await coordinator.mutation(api.incidents.deleteNow, { incidentId });

    expect(await t.run((ctx) => ctx.db.get(incidentId))).toBeNull();
    expect(
      await t.run((ctx) => ctx.db.query("incidentDocuments").collect()),
    ).toEqual([]);
    const notifications = await t.run((ctx) =>
      ctx.db.query("notifications").collect(),
    );
    expect(notifications).toEqual([]);
    // Lo que sí se queda es el rastro de auditoría de los documentos: no se
    // borra nunca (es la única constancia de un adjunto retirado), y la
    // auditoría del taller resuelve la incidencia que ya no está sin romperse.
    const audit = await t.run((ctx) =>
      ctx.db.query("incidentDocumentLog").collect(),
    );
    expect(audit).toHaveLength(1);
    expect(audit[0].name).toBe("Parte interno.pdf");
  });

  test("la pasada de la papelera borra lo caducado y respeta lo que está en plazo", async () => {
    const { t, coordinator, incidentId } = await reported();
    await coordinator.mutation(api.incidents.withdraw, { incidentId });

    // Dentro de plazo: la pasada no la toca.
    expect(await t.mutation(internal.incidents.purgeExpired, {})).toBe(0);
    expect(await t.run((ctx) => ctx.db.get(incidentId))).not.toBeNull();

    // Cumplido el plazo: se va de verdad.
    await t.run((ctx) =>
      ctx.db.patch(incidentId, { purgeAt: Date.now() - 1000 }),
    );
    expect(await t.mutation(internal.incidents.purgeExpired, {})).toBe(1);
    expect(await t.run((ctx) => ctx.db.get(incidentId))).toBeNull();
  });

  test("el plazo que se le apunta es el que tiene ajustado el taller", async () => {
    const { t, coordinator, incidentId } = await reported();
    // El plazo de la papelera es el mismo que el del almacén: 30 días.
    await t.run((ctx) =>
      ctx.db.insert("storageSettings", {
        key: "default",
        trashRetentionDays: 30,
        updatedAt: Date.now(),
        updatedBy: "Ada Admin",
      }),
    );

    await coordinator.mutation(api.incidents.withdraw, { incidentId });

    const papelera = await coordinator.query(api.incidents.trash, {});
    expect(papelera.retentionDays).toBe(30);
    expect(
      (papelera.items[0].purgeAt - papelera.items[0].deletedAt) / DAY,
    ).toBe(30);
  });

  test("una retirada no aparece en la cola de nadie más", async () => {
    const { t, coordinator, tech, incidentId } = await reported();
    await coordinator.mutation(api.incidents.withdraw, {
      incidentId,
      reason: "Aviso equivocado",
    });

    // El técnico tampoco la ve: la retirada vale para todo el taller, y el
    // motivo queda apuntado para saber por qué está en la papelera.
    expect(await tech.query(api.incidents.list, {})).toEqual([]);
    expect((await t.run((ctx) => ctx.db.get(incidentId)))?.deletedReason).toBe(
      "Aviso equivocado",
    );
  });
});
