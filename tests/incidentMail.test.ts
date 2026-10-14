import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../src/convex/_generated/api";
import schema from "../src/convex/schema";
import { formatPublicCode } from "../src/lib/publicCode";
import {
  INCIDENT_MAIL_STATUSES,
  INCIDENT_WITHDRAWN_NOTICE,
  incidentTrackingLink,
  isWithdrawnNotice,
  looksLikeEmail,
  mailNotice,
  mailableStatus,
  normalizeReporterEmail,
  renderIncidentMail,
  reporterFirstName,
  reporterNoticeText,
} from "../src/lib/incidentMail";

/** Todos los módulos de funciones de la app (convex-test los levanta in-process). */
const modules = import.meta.glob("../src/convex/**/!(*.*.*)*.*s");

type Test = ReturnType<typeof convexTest>;

/* ------------------------------------------------------------------ */
/* El texto: se prueba sin servidor                                    */
/* ------------------------------------------------------------------ */

const mailInput = {
  code: "A7K2QX9M",
  reporterName: "Sandra Ruiz",
  notice: "assigned",
  equipmentKind: "Cámara de estudio",
  model: "HDC-3500",
  location: "Plató 2",
  reportedAt: Date.UTC(2026, 0, 2, 9, 30),
  assigneeName: "Iván Torres",
  appUrl: "https://taller.example/",
};

describe("el texto del aviso a quien notificó", () => {
  test("cada cambio de estado que se cuenta sale con su código", () => {
    for (const status of INCIDENT_MAIL_STATUSES) {
      const mail = renderIncidentMail({ ...mailInput, notice: status });
      // El código es lo único que une el correo con el caso: tiene que estar en
      // el asunto (para encontrarlo en la bandeja) y en el cuerpo, y con los
      // guiones que lo hacen legible, que es como se copia a la consulta.
      expect(mail.subject).toContain("A7K2-QX9M");
      expect(mail.text).toContain("A7K2-QX9M");
      expect(mail.html).toContain("A7K2-QX9M");
      // Y el enlace de seguimiento lleva el código ya puesto, para no teclearlo.
      expect(mail.text).toContain(
        "https://taller.example/dashboard?codigo=A7K2QX9M",
      );
    }
  });

  test("los pasos intermedios no son cosa de quien notificó", () => {
    // Ni la verificación ni el archivado: eso es trabajo del taller y a quien
    // avisó no le dice nada.
    for (const status of ["verified", "archived"]) {
      expect(mailableStatus(status)).toBe(null);
    }
    // Los que sí se cuentan lo dicen, uno por uno.
    for (const status of INCIDENT_MAIL_STATUSES) {
      expect(mailableStatus(status)).toBe(status);
    }
    expect(() =>
      renderIncidentMail({ ...mailInput, notice: "verified" }),
    ).toThrow(/no se cuenta por correo/);
    // La retirada no es un estado —el caso sigue en el que estaba— pero sí un
    // aviso que se cuenta: es lo que deja el código sin funcionar.
    expect(mailableStatus(INCIDENT_WITHDRAWN_NOTICE)).toBe(null);
    expect(isWithdrawnNotice(INCIDENT_WITHDRAWN_NOTICE)).toBe(true);
    expect(mailNotice(INCIDENT_WITHDRAWN_NOTICE)).toBe(INCIDENT_WITHDRAWN_NOTICE);
    expect(mailNotice("assigned")).toBe("assigned");
    // Y el alta también se cuenta: es el correo que lleva el código a quien
    // avisó, que si no se queda solo con la pantalla que va a cerrar.
    expect(mailNotice("reported")).toBe("reported");
    expect(mailableStatus("reported")).toBe("reported");
  });

  test("el correo del alta lleva el código y no promete un cambio de estado", () => {
    // Como sale de verdad: recién notificada, sin nadie a cargo todavía.
    const mail = renderIncidentMail({
      ...mailInput,
      notice: "reported",
      assigneeName: null,
      workshopAssigneeName: null,
    });

    expect(mail.subject).toContain("A7K2-QX9M");
    expect(mail.subject).toContain("ya está en el taller");
    expect(mail.text).toContain("Este es tu código: A7K2-QX9M.");
    // Y se le dice que lo guarde, que es lo único que le hace falta: con él
    // vuelve al caso sin cuenta del taller.
    expect(mail.text).toContain("Guarda este código");
    expect(mail.text).toContain(
      "https://taller.example/dashboard?codigo=A7K2QX9M",
    );
    // Del alta no hay estado que contar —«Nueva» es que acaba de entrar— ni
    // nadie a cargo que anunciar.
    expect(mail.text).not.toContain("ESTADO:");
    expect(mail.text).not.toContain("ha cambiado de estado");
    expect(mail.text).not.toContain("Lo lleva");
    expect(mail.html).toContain("Hemos recibido tu aviso");
  });

  test("la retirada se cuenta, y no promete un seguimiento que ya no existe", () => {
    const mail = renderIncidentMail({
      ...mailInput,
      notice: INCIDENT_WITHDRAWN_NOTICE,
    });

    // El código sigue siendo lo que ata el correo al caso.
    expect(mail.subject).toContain("A7K2-QX9M");
    expect(mail.subject).toContain("se ha retirado");
    expect(mail.text).toContain("ya no se sigue desde el taller");
    expect(mail.text).toContain("Equipo: Cámara de estudio HDC-3500");
    // Nada de estado ni de quién la lleva: la incidencia no está en ninguna cola.
    expect(mail.text).not.toContain("ESTADO:");
    expect(mail.text).not.toContain("Lo lleva");
    // Y sin enlace de seguimiento: el código ya no contesta. Lo que se le dice
    // es lo que puede hacer.
    expect(mail.text).not.toContain("/dashboard?codigo=");
    expect(mail.html).not.toContain("/dashboard?codigo=");
    expect(mail.text).toContain("vuelve a notificarlo");
    // Aun sin dirección pública, la retirada se cuenta igual.
    const sinApp = renderIncidentMail({
      ...mailInput,
      appUrl: null,
      notice: INCIDENT_WITHDRAWN_NOTICE,
    });
    expect(sinApp.text).not.toContain("http");
  });

  test("no es la puerta de atrás del expediente", () => {
    // El correo se compone sin notas, sin historial y sin quién dio cada paso:
    // lo mismo que ve el invitado al consultar su código.
    const mail = renderIncidentMail({ ...mailInput, notice: "workshop" });
    expect(mail.text).not.toContain("Derivada a taller");
    expect(mail.text).not.toContain("Notas");
    expect(mail.text).toContain("se ha trasladado al taller");
    expect(mail.text).toContain("Lo lleva: Iván Torres");
  });

  test("sin dirección pública se dice cómo seguir el caso", () => {
    const mail = renderIncidentMail({ ...mailInput, appUrl: null });
    expect(mail.text).toContain("Entra en la aplicación y consulta A7K2-QX9M.");
    expect(mail.text).not.toContain("http");
    expect(mail.html).not.toContain("http");
  });

  test("el enlace de seguimiento lleva el código, no la referencia interna", () => {
    // El código va sin guiones: en una dirección sobran, y la consulta los quita
    // igualmente si alguien pega el que se lee.
    expect(incidentTrackingLink("A7K2QX9M", "https://taller.example/")).toBe(
      "https://taller.example/dashboard?codigo=A7K2QX9M",
    );
    // Sin barra final de más, y sin dirección no hay enlace que dar.
    expect(incidentTrackingLink("A7K2QX9M", "https://taller.example")).toBe(
      "https://taller.example/dashboard?codigo=A7K2QX9M",
    );
    expect(incidentTrackingLink("A7K2QX9M", "  ")).toBe(null);
    expect(incidentTrackingLink("A7K2QX9M")).toBe(null);
  });

  test("el saludo usa el nombre de pila", () => {
    expect(reporterFirstName("Sandra Ruiz")).toBe("Sandra");
    expect(reporterFirstName("  Iván  ")).toBe("Iván");
    expect(reporterFirstName("   ")).toBe("hola");
  });

  test("la ficha del taller cuenta cómo va el aviso", () => {
    expect(reporterNoticeText({})).toContain("Sin correo");
    expect(
      reporterNoticeText({
        reporterEmail: "sandra.ruiz@taller.es",
        emailedAt: Date.UTC(2026, 0, 2, 10, 0),
      }),
    ).toMatch(/^Enviado a sandra\.ruiz@taller\.es el \d{2} \w+ 2026\.$/);
    // Antes de que salga, el taller ve lo que va a pasar: el código va camino
    // del correo que dejó quien avisó.
    expect(
      reporterNoticeText({ reporterEmail: "sandra.ruiz@taller.es" }),
    ).toContain("Se le enviará su código a sandra.ruiz@taller.es");
    // El motivo del fallo se enseña tal cual: es lo que hay que arreglar.
    expect(
      reporterNoticeText({
        reporterEmail: "sandra.ruiz@taller.es",
        emailError: "El deployment no tiene VLY_INTEGRATION_KEY.",
      }),
    ).toBe(
      "No se pudo enviar: El deployment no tiene VLY_INTEGRATION_KEY.",
    );
  });

  test("el correo de quien avisa se guarda en minúsculas y se comprueba antes", () => {
    expect(normalizeReporterEmail("  Sandra.Ruiz@Taller.ES ")).toBe(
      "sandra.ruiz@taller.es",
    );
    expect(looksLikeEmail("sandra.ruiz@taller.es")).toBe(true);
    expect(looksLikeEmail("sandra.ruiz@taller")).toBe(false);
    expect(looksLikeEmail("sandra.ruiz")).toBe(false);
    expect(looksLikeEmail("@taller.es")).toBe(false);
    expect(looksLikeEmail("sandra ruiz@taller.es")).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* El envío: con el servidor de pruebas                                */
/* ------------------------------------------------------------------ */

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
  return {
    t,
    coordinator: t.withIdentity({ subject: `${coordinatorId}|session1` }),
    tech: t.withIdentity({ subject: `${techId}|session1` }),
    coordinatorId,
    techId,
  };
}

/** El aviso lo dejó Sandra con su correo: es el caso que se le sigue. */
const reportArgs = {
  reporterName: "Sandra Ruiz",
  reporterEmail: "  Sandra.Ruiz@Taller.ES ",
  equipmentKind: "Cámara de estudio",
  model: "HDC-3500",
  description: "Se apaga sola en directo cuando se mueve el cable de vídeo.",
  reportedAt: Date.now() - 60 * 60 * 1000,
};

/** La fila de la incidencia tal y como quedó guardada. */
async function incidentRow(t: Test) {
  const incident = await t.run((ctx) =>
    ctx.db
      .query("incidents")
      .withIndex("by_reference", (q) => q.eq("reference", "INC-0001"))
      .unique(),
  );
  expect(incident).not.toBeNull();
  return incident!;
}

/**
 * Deja correr lo que las mutaciones programaron. El aviso se manda desde una
 * acción y va programado con retardo cero: aquí se le da cuerda para que salga
 * dentro de la prueba, no cuando el taller esté mirando.
 */
/**
 * El código con el que se firma el correo, tal y como se lee en él: el guardado
 * en la ficha, con sus guiones. Es lo que quien lo recibe copia en la consulta.
 */
function mailCode(row: { publicCode?: string }): string {
  expect(row.publicCode, "La incidencia no tiene código.").toBeTypeOf("string");
  return formatPublicCode(row.publicCode!);
}

async function deliverScheduled(t: Test) {
  vi.useFakeTimers();
  try {
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  } finally {
    vi.useRealTimers();
  }
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

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.VLY_INTEGRATION_KEY;
});

describe("el aviso por correo a quien notificó", () => {
  test("el formulario guarda el correo en minúsculas y rechaza la errata", async () => {
    const { t } = await setup();

    await t.mutation(api.incidents.report, reportArgs);
    // El alta programa su correo: se entrega aquí para no dejar nada colgando.
    // Sin clave de integraciones el intento queda apuntado en la ficha, que es lo
    // que hace en un taller que aún no la tiene configurada.
    await deliverScheduled(t);

    const row = await incidentRow(t);
    expect(row.reporterEmail).toBe("sandra.ruiz@taller.es");

    // Un correo con una errata de dedo se avisa al notificar, que es cuando
    // todavía se puede corregir: si no, el aviso se pierde en silencio.
    await expectConvexError(
      t.mutation(api.incidents.report, {
        ...reportArgs,
        reporterEmail: "sandra.ruiz@taller",
      }),
      "no parece una dirección válida",
    );
  });

  test("el alta manda el código al correo que dejó quien avisó", async () => {
    const { t } = await setup();
    process.env.VLY_INTEGRATION_KEY = "sk_test_123";
    const fetchMock = stubGateway();

    // Nadie ha tocado la incidencia todavía: el correo sale por notificarla, que
    // es lo que impide que el código se quede en la pantalla que se va a cerrar.
    const created = await t.mutation(api.incidents.report, reportArgs);
    await deliverScheduled(t);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    const payload = JSON.parse(init.body) as {
      to: string[];
      subject: string;
      text: string;
    };
    const row = await incidentRow(t);
    expect(payload.to).toEqual(["sandra.ruiz@taller.es"]);
    expect(payload.subject).toContain(mailCode(row));
    expect(payload.text).toContain(mailCode(row));
    expect(payload.text).toContain("Hemos recibido tu aviso");
    // El mismo código que se le ha enseñado en pantalla: dos formas de lo mismo,
    // no dos códigos.
    expect(mailCode(row)).toBe(formatPublicCode(created.code));

    // Y queda apuntado como el aviso que es: así el primer cambio de estado
    // —otro aviso distinto— sigue contándose en vez de darse por dicho.
    const updated = await incidentRow(t);
    expect(updated.emailedStatus).toBe("reported");
    expect(updated.emailedAt).toBeTypeOf("number");
    expect(updated.emailError).toBeUndefined();
  });

  test("al ponerse un técnico al caso, se avisa con su código", async () => {
    const { t, coordinator, techId } = await setup();
    process.env.VLY_INTEGRATION_KEY = "sk_test_123";
    const fetchMock = stubGateway();

    await t.mutation(api.incidents.report, reportArgs);
    await deliverScheduled(t);

    const row = await incidentRow(t);
    await coordinator.mutation(api.incidents.assign, {
      incidentId: row._id,
      assigneeId: techId,
    });
    await deliverScheduled(t);

    // Salen dos correos: el del alta —que va en cuanto se notifica— y este, el de
    // ponerse alguien al caso. Aquí se mira el segundo.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, init] = fetchMock.mock.calls[1] as unknown as [
      string,
      { body: string },
    ];
    const payload = JSON.parse(init.body) as {
      to: string[];
      subject: string;
      text: string;
    };
    // El correo sale de verdad, al correo que dejó quien avisó y con su código:
    // es lo que le permite reconocer el caso.
    expect(payload.to).toEqual(["sandra.ruiz@taller.es"]);
    expect(payload.subject).toContain(mailCode(row));
    expect(payload.text).toContain(mailCode(row));

    // Y queda apuntado en la ficha: qué estado se avisó y cuándo, sin motivo de
    // error (esto es lo que luego mira el taller para saber qué salió).
    const updated = await incidentRow(t);
    expect(updated.emailedStatus).toBe("assigned");
    expect(updated.emailedAt).toBeTypeOf("number");
    expect(updated.emailError).toBeUndefined();
  });

  test("una incidencia anterior a los códigos recibe uno al avisar", async () => {
    const { t, coordinator, techId } = await setup();

    // Lo que dejó una instalación de antes de que existieran los códigos: la
    // incidencia tiene correo al que avisar, pero no código de seguimiento.
    const at = Date.now() - 60 * 60 * 1000;
    const incidentId = await t.run((ctx) =>
      ctx.db.insert("incidents", {
        reference: "INC-0009",
        reporterName: "Sandra Ruiz",
        reporterEmail: "sandra.ruiz@taller.es",
        equipmentKind: "Cámara de estudio",
        model: "HDC-3500",
        description:
          "La cámara se apaga sola en directo cuando se mueve el cable.",
        reportedAt: at,
        status: "reported",
        history: [{ status: "reported", at, by: "Sandra Ruiz" }],
        createdAt: at,
        updatedAt: at,
      }),
    );
    expect(
      (await t.run((ctx) => ctx.db.get(incidentId)))?.publicCode,
    ).toBeUndefined();

    process.env.VLY_INTEGRATION_KEY = "sk_test_123";
    const fetchMock = stubGateway();
    await coordinator.mutation(api.incidents.assign, {
      incidentId,
      assigneeId: techId,
    });
    await deliverScheduled(t);

    // Se le reparte uno al avisar: el correo sale con código, como el de
    // cualquier otra, y no con una referencia interna que ya no consulta nada.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const row = await t.run((ctx) => ctx.db.get(incidentId));
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    const payload = JSON.parse(init.body) as { subject: string; text: string };
    expect(payload.subject).toContain(mailCode(row!));
    expect(payload.text).toContain(mailCode(row!));
    // Y queda guardado, así que el siguiente aviso sale ya con el mismo: se
    // reparte una vez, no uno por correo.
    expect(row!.publicCode).toHaveLength(8);
    expect(row!.reference).toBe("INC-0009");
  });

  test("el mismo estado no se avisa dos veces", async () => {
    const { t, coordinator, techId, coordinatorId } = await setup();
    process.env.VLY_INTEGRATION_KEY = "sk_test_123";
    const fetchMock = stubGateway();

    await t.mutation(api.incidents.report, reportArgs);
    await deliverScheduled(t);

    const row = await incidentRow(t);
    await coordinator.mutation(api.incidents.assign, {
      incidentId: row._id,
      assigneeId: techId,
    });
    await deliverScheduled(t);
    // Reasignar a otra persona no es un cambio de estado que contar: sería el
    // mismo correo otra vez.
    await coordinator.mutation(api.incidents.assign, {
      incidentId: row._id,
      assigneeId: coordinatorId,
    });
    await deliverScheduled(t);

    // El alta y la asignación: dos. Reasignar no añade uno más.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("sin correo no se avisa a nadie", async () => {
    const { t, coordinator, techId } = await setup();
    process.env.VLY_INTEGRATION_KEY = "sk_test_123";
    const fetchMock = stubGateway();
    await t.mutation(api.incidents.report, {
      ...reportArgs,
      reporterEmail: undefined,
    });

    const row = await incidentRow(t);
    await coordinator.mutation(api.incidents.assign, {
      incidentId: row._id,
      assigneeId: techId,
    });
    await deliverScheduled(t);

    expect(fetchMock).not.toHaveBeenCalled();
    const updated = await incidentRow(t);
    expect(updated.emailedStatus).toBeUndefined();
  });

  test("sin clave de integraciones el motivo queda escrito, no se pierde", async () => {
    const { t, coordinator, techId } = await setup();
    await t.mutation(api.incidents.report, reportArgs);

    const row = await incidentRow(t);
    await coordinator.mutation(api.incidents.assign, {
      incidentId: row._id,
      assigneeId: techId,
    });
    await deliverScheduled(t);

    const updated = await incidentRow(t);
    expect(updated.emailedStatus).toBe("assigned");
    expect(updated.emailError).toContain("VLY_INTEGRATION_KEY");
    expect(updated.emailedAt).toBeUndefined();
  });

  test("el caso avisa al entrar en taller y al cerrarse", async () => {
    const { t, coordinator, tech, techId } = await setup();
    process.env.VLY_INTEGRATION_KEY = "sk_test_123";
    const fetchMock = stubGateway();

    await t.mutation(api.incidents.report, reportArgs);
    await deliverScheduled(t);

    const row = await incidentRow(t);
    await coordinator.mutation(api.incidents.assign, {
      incidentId: row._id,
      assigneeId: techId,
    });
    await deliverScheduled(t);
    await tech.mutation(api.incidents.verify, {
      incidentId: row._id,
      outcome: "workshop",
    });
    await deliverScheduled(t);
    await tech.mutation(api.incidents.close, {
      incidentId: row._id,
      outcome: "resolved",
    });
    await deliverScheduled(t);

    // El código del alta y los tres cambios de estado que se cuentan.
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const updated = await incidentRow(t);
    expect(updated.status).toBe("resolved");
    expect(updated.emailedStatus).toBe("resolved");
  });

  test("al retirarla se le cuenta: su referencia no deja de funcionar sin explicación", async () => {
    const { t, coordinator } = await setup();
    process.env.VLY_INTEGRATION_KEY = "sk_test_123";
    const fetchMock = stubGateway();

    await t.mutation(api.incidents.report, reportArgs);
    await deliverScheduled(t);

    const row = await incidentRow(t);
    // Se retira porque era un aviso equivocado o duplicado: la referencia que se
    // le dio deja de seguir el caso, y eso hay que decírselo.
    await coordinator.mutation(api.incidents.withdraw, {
      incidentId: row._id,
      reason: "Aviso duplicado.",
    });
    await deliverScheduled(t);

    // El código del alta y la retirada: lo que se mira aquí es la retirada.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, init] = fetchMock.mock.calls[1] as unknown as [
      string,
      { body: string },
    ];
    const payload = JSON.parse(init.body) as {
      to: string[];
      subject: string;
      text: string;
    };
    expect(payload.to).toEqual(["sandra.ruiz@taller.es"]);
    expect(payload.subject).toContain(mailCode(row));
    expect(payload.subject).toContain("retirado");
    expect(payload.text).toContain("ya no se sigue desde el taller");
    expect(payload.text).toContain("vuelve a notificarlo");
    // Sin enlace de seguimiento: la referencia ya no contesta.
    expect(payload.text).not.toContain("/dashboard?referencia=");

    // El aviso tampoco va sobre el estado que tenía la incidencia.
    const updated = await incidentRow(t);
    expect(updated.status).toBe("reported");
    expect(updated.emailedStatus).toBe(INCIDENT_WITHDRAWN_NOTICE);
    expect(updated.emailedAt).toBeTypeOf("number");
    expect(updated.emailError).toBeUndefined();

    // Y la papelera —único sitio donde vive una retirada— enseña que se le
    // explicó: es lo que impide que el taller se quede con la duda.
    const papelera = await coordinator.query(api.incidents.trash, {});
    expect(papelera.items[0].reporterEmail).toBe("sandra.ruiz@taller.es");
    expect(reporterNoticeText(papelera.items[0])).toContain(
      "Enviado a sandra.ruiz@taller.es",
    );
  });

  test("la misma retirada no se cuenta dos veces", async () => {
    const { t, coordinator, techId } = await setup();
    process.env.VLY_INTEGRATION_KEY = "sk_test_123";
    const fetchMock = stubGateway();

    await t.mutation(api.incidents.report, reportArgs);
    await deliverScheduled(t);

    const row = await incidentRow(t);
    await coordinator.mutation(api.incidents.withdraw, {
      incidentId: row._id,
    });
    await deliverScheduled(t);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Retirar dos veces no es un error, y tocar una retirada no la vuelve a
    // contar: el aviso salió después de retirarla, así que ya está dicho.
    await coordinator.mutation(api.incidents.withdraw, {
      incidentId: row._id,
    });
    await coordinator.mutation(api.incidents.assign, {
      incidentId: row._id,
      assigneeId: techId,
    });
    await deliverScheduled(t);

    // Siguen siendo el código del alta y la retirada: nada nuevo.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("recuperarla y volver a retirarla se cuenta otra vez", async () => {
    const { t, coordinator } = await setup();
    process.env.VLY_INTEGRATION_KEY = "sk_test_123";
    const fetchMock = stubGateway();

    await t.mutation(api.incidents.report, reportArgs);
    await deliverScheduled(t);

    const row = await incidentRow(t);
    await coordinator.mutation(api.incidents.withdraw, {
      incidentId: row._id,
    });
    await deliverScheduled(t);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Se recuperó por error y se volvió a retirar: su código deja de funcionar
    // otra vez, así que se le explica otra vez.
    await coordinator.mutation(api.incidents.restore, { incidentId: row._id });
    await coordinator.mutation(api.incidents.withdraw, {
      incidentId: row._id,
    });
    await deliverScheduled(t);

    // El código del alta y las dos retiradas: la segunda vuelve a contarse.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("sin correo no se avisa de la retirada, y queda dicho en la papelera", async () => {
    const { t, coordinator } = await setup();
    process.env.VLY_INTEGRATION_KEY = "sk_test_123";
    const fetchMock = stubGateway();
    await t.mutation(api.incidents.report, {
      ...reportArgs,
      reporterEmail: undefined,
    });

    const row = await incidentRow(t);
    await coordinator.mutation(api.incidents.withdraw, {
      incidentId: row._id,
    });
    await deliverScheduled(t);

    expect(fetchMock).not.toHaveBeenCalled();
    const papelera = await coordinator.query(api.incidents.trash, {});
    expect(papelera.items[0].reporterEmail).toBe(null);
    expect(reporterNoticeText(papelera.items[0])).toContain("Sin correo");
  });

  test("sin clave de integraciones, la retirada también deja su motivo", async () => {
    const { t, coordinator } = await setup();
    await t.mutation(api.incidents.report, reportArgs);

    const row = await incidentRow(t);
    await coordinator.mutation(api.incidents.withdraw, {
      incidentId: row._id,
    });
    await deliverScheduled(t);

    const updated = await incidentRow(t);
    expect(updated.emailedStatus).toBe(INCIDENT_WITHDRAWN_NOTICE);
    expect(updated.emailError).toContain("VLY_INTEGRATION_KEY");
    expect(updated.emailedAt).toBeUndefined();
    // Y en la papelera se lee por qué no se le pudo avisar.
    const papelera = await coordinator.query(api.incidents.trash, {});
    expect(reporterNoticeText(papelera.items[0])).toContain("No se pudo enviar");
  });
});
