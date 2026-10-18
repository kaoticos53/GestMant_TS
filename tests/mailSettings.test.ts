import { backend } from "./backend";
import { ConvexError } from "convex/values";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../src/convex/_generated/api";
import {
  MAIL_LOG_LIMIT,
  MAIL_PROVIDERS,
  MAIL_PROVIDER_META,
  MAIL_PROVIDER_OPTIONS,
  buildMailCheckRequest,
  buildMailRequest,
  formatSender,
  mailCheckSummary,
  mailConfigBlocker,
  mailCredentialsWarning,
  normalizeRecipients,
  usesMailRelay,
  validateMailSettings,
  type MailTransport,
} from "../src/lib/mail";

type Test = ReturnType<typeof backend>;

/* ------------------------------------------------------------------ */
/* El catálogo y las peticiones: se prueban sin servidor              */
/* ------------------------------------------------------------------ */

const message = {
  to: ["sandra.ruiz@taller.es"],
  subject: "Tu aviso ya está en el taller",
  text: "Texto del correo",
  html: "<p>Texto del correo</p>",
};

/** Un transporte completo; cada prueba cambia solo lo que mira. */
function transport(over: Partial<MailTransport> = {}): MailTransport {
  return {
    provider: "resend",
    fromName: "Pulso Taller",
    fromEmail: "avisos@taller.es",
    replyTo: "",
    bcc: "",
    domain: "",
    relayUrl: "",
    smtpUser: "",
    apiKey: "key_123",
    relayToken: "",
    ...over,
  };
}

describe("el correo del taller — el catálogo", () => {
  test("cada servicio tiene su ficha, y la pasarela va primero", () => {
    expect(MAIL_PROVIDERS[0]).toBe("vly");
    // El catálogo de la pantalla y el de los servicios son el mismo: una opción
    // sin ficha se pintaría sin nombre y sin campos.
    expect(MAIL_PROVIDER_OPTIONS.map((option) => option.id)).toEqual([
      ...MAIL_PROVIDERS,
    ]);
    for (const option of MAIL_PROVIDER_OPTIONS) {
      expect(option.label).not.toBe("");
      expect(option.summary).not.toBe("");
    }
  });

  test("Gmail y el buzón de pruebas traen su servidor puesto y piden su cuenta", () => {
    for (const id of ["gmail", "ethereal"] as const) {
      const meta = MAIL_PROVIDER_META[id];
      // El taller no tiene que acordarse del puerto ni del cifrado: van puestos,
      // que es lo único que aporta elegir «Gmail» en vez de «Relevo propio».
      expect(meta.smtp, id).not.toBeNull();
      expect(meta.smtp!.port, id).toBeGreaterThan(0);
      expect(meta.userLabel, id).not.toBeNull();
      expect(meta.secretLabel, id).not.toBeNull();
      // Y salen por el relevo: sin su dirección no hay por dónde entregar.
      expect(meta.fields, id).toContain("relayUrl");
      expect(meta.fields, id).toContain("smtpUser");
      expect(usesMailRelay(id), id).toBe(true);
    }
    expect(MAIL_PROVIDER_META.gmail.smtp).toEqual({
      host: "smtp.gmail.com",
      port: 465,
      tls: "ssl",
    });
    expect(MAIL_PROVIDER_META.ethereal.smtp?.host).toBe("smtp.ethereal.email");
    // El buzón de pruebas no tiene variable de entorno que lo supla.
    expect(MAIL_PROVIDER_META.ethereal.apiKeyEnv).toBeNull();
    // Los que tienen API propia no pasan por el puente. El relevo sí, que es el
    // puente mismo.
    for (const id of [
      "vly",
      "resend",
      "sendgrid",
      "mailgun",
      "brevo",
      "relay",
    ] as const) {
      expect(usesMailRelay(id), id).toBe(id === "relay");
    }
  });

  test("el remitente se compone como lo leen los servicios", () => {
    expect(formatSender(transport())).toBe("Pulso Taller <avisos@taller.es>");
    expect(formatSender(transport({ fromName: "  " }))).toBe(
      "avisos@taller.es",
    );
    // Un nombre con ángulos o comillas no puede convertirse en otra cabecera.
    expect(
      formatSender(transport({ fromName: 'Taller "Norte" <admin>' })),
    ).toBe("Taller Norte admin <avisos@taller.es>");
  });

  test("los destinatarios no se repiten ni se mandan con espacios", () => {
    expect(
      normalizeRecipients([
        " Sandra@Taller.es ",
        "sandra@taller.es",
        "",
        "ivan@taller.es",
      ]),
    ).toEqual(["sandra@taller.es", "ivan@taller.es"]);
  });
});

describe("el correo del taller — los ajustes se validan antes de guardar", () => {
  const base = {
    provider: "resend",
    enabled: true,
    fromName: "Pulso Taller",
    fromEmail: "Avisos@Taller.es",
    replyTo: "",
    bcc: "",
    domain: "",
    relayUrl: "",
  };

  test("lo válido se guarda en minúsculas y sin lo que no usa el servicio", () => {
    const result = validateMailSettings({
      ...base,
      fromEmail: "  Avisos@Taller.es ",
      domain: "taller.es", // de otro servicio: se descarta
      replyTo: "Mantenimiento@Taller.es",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.fromEmail).toBe("avisos@taller.es");
    expect(result.value.replyTo).toBe("mantenimiento@taller.es");
    expect(result.value.domain).toBe("");
  });

  test("un servicio propio sin remitente no se guarda", () => {
    const result = validateMailSettings({ ...base, fromEmail: "" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("remitente");
  });

  test("la pasarela no necesita remitente: firma con el suyo", () => {
    expect(
      validateMailSettings({ ...base, provider: "vly", fromEmail: "" }).ok,
    ).toBe(true);
  });

  test("las direcciones con errata se rechazan, y las de respuesta también", () => {
    expect(
      validateMailSettings({ ...base, fromEmail: "avisos@taller" }).ok,
    ).toBe(false);
    const reply = validateMailSettings({ ...base, replyTo: "mantenimiento" });
    expect(reply.ok).toBe(false);
    if (reply.ok) return;
    expect(reply.error).toContain("respuesta");
  });

  test("Mailgun exige dominio y el relevo exige dirección", () => {
    const sinDominio = validateMailSettings({ ...base, provider: "mailgun" });
    expect(sinDominio.ok).toBe(false);
    if (!sinDominio.ok) expect(sinDominio.error).toContain("dominio");
    expect(
      validateMailSettings({
        ...base,
        provider: "mailgun",
        domain: "taller.es",
      }).ok,
    ).toBe(true);

    const sinRelevo = validateMailSettings({ ...base, provider: "relay" });
    expect(sinRelevo.ok).toBe(false);
    if (!sinRelevo.ok) expect(sinRelevo.error).toContain("relevo");
    expect(
      validateMailSettings({
        ...base,
        provider: "relay",
        relayUrl: "taller.local/enviar",
      }).ok,
    ).toBe(false);
    expect(
      validateMailSettings({
        ...base,
        provider: "relay",
        relayUrl: "https://correo.taller.local/enviar",
      }).ok,
    ).toBe(true);
  });

  test("Gmail y Ethereal piden cuenta, dirección del relevo y nada más", () => {
    const gmail = {
      ...base,
      provider: "gmail",
      relayUrl: "https://correo.taller.local/enviar",
    };
    const sinCuenta = validateMailSettings(gmail);
    expect(sinCuenta.ok).toBe(false);
    if (!sinCuenta.ok) expect(sinCuenta.error).toContain("Cuenta de Gmail");

    const sinRelevo = validateMailSettings({
      ...gmail,
      relayUrl: "",
      smtpUser: "taller@gmail.com",
    });
    expect(sinRelevo.ok).toBe(false);
    if (!sinRelevo.ok) expect(sinRelevo.error).toContain("relevo");

    const ok = validateMailSettings({
      ...gmail,
      smtpUser: " Taller@Gmail.com ",
    });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.value.smtpUser).toBe("taller@gmail.com");
    // El dominio de Mailgun no se cuela al cambiar de servicio.
    expect(ok.value.domain).toBe("");

    // Una errata se ve antes de guardar, y la cuenta no viaja en los servicios
    // que no la usan.
    expect(validateMailSettings({ ...gmail, smtpUser: "taller" }).ok).toBe(
      false,
    );
    const resend = validateMailSettings({
      ...base,
      smtpUser: "taller@gmail.com",
    });
    expect(resend.ok).toBe(true);
    if (resend.ok) expect(resend.value.smtpUser).toBe("");
    // El buzón de pruebas no necesita nada más que Gmail.
    expect(
      validateMailSettings({
        ...gmail,
        provider: "ethereal",
        smtpUser: "usuario@ethereal.email",
      }).ok,
    ).toBe(true);
  });

  test("un servicio inventado no pasa", () => {
    const result = validateMailSettings({ ...base, provider: "smtp" });
    expect(result.ok).toBe(false);
  });

  test("la copia oculta se valida y se guarda en minúsculas", () => {
    const result = validateMailSettings({
      ...base,
      bcc: "  Archivo@Taller.es ",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.bcc).toBe("archivo@taller.es");

    // Una errata o dos buzones a la vez: se dice antes de guardar, no cuando el
    // servicio contesta que la dirección no le vale.
    for (const bad of ["archivo", "a@taller.es, b@taller.es"]) {
      const rejected = validateMailSettings({ ...base, bcc: bad });
      expect(rejected.ok, `Se esperaba rechazo de: ${bad}`).toBe(false);
      if (!rejected.ok) expect(rejected.error).toContain("copia oculta");
    }
  });
});

describe("el correo del taller — la copia oculta viaja en el sobre", () => {
  const copied = transport({ bcc: " Archivo@Taller.es ", replyTo: "" });

  test("Resend, Brevo y el relevo la mandan como lista de copia", () => {
    for (const provider of ["resend", "brevo", "relay"] as const) {
      const built = buildMailRequest(
        {
          ...copied,
          provider,
          ...(provider === "relay"
            ? { relayUrl: "https://correo.taller.local/enviar" }
            : {}),
        },
        message,
      );
      expect(built.ok, provider).toBe(true);
      if (!built.ok) continue;
      const payload = JSON.parse(built.request.body) as {
        bcc?: { email: string }[] | string[];
        to: unknown;
      };
      // Brevo espera objetos; Resend y el relevo, direcciones sueltas.
      expect(payload.bcc, provider).toEqual(
        provider === "brevo"
          ? [{ email: "archivo@taller.es" }]
          : ["archivo@taller.es"],
      );
      // Los destinatarios de verdad no cambian: la copia es oculta.
      expect(payload.to, provider).not.toContain("archivo@taller.es");
    }
  });

  test("SendGrid la lleva dentro de la personalización", () => {
    const built = buildMailRequest(
      { ...copied, provider: "sendgrid" },
      message,
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const payload = JSON.parse(built.request.body) as {
      personalizations: {
        to: { email: string }[];
        bcc?: { email: string }[];
      }[];
    };
    expect(payload.personalizations[0].bcc).toEqual([
      { email: "archivo@taller.es" },
    ]);
    expect(payload.personalizations[0].to).toEqual([
      { email: "sandra.ruiz@taller.es" },
    ]);
  });

  test("Mailgun la manda en el formulario", () => {
    const built = buildMailRequest(
      { ...copied, provider: "mailgun", domain: "taller.es" },
      message,
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const form = new URLSearchParams(built.request.body);
    expect(form.get("bcc")).toBe("archivo@taller.es");
    expect(form.getAll("to")).toEqual(["sandra.ruiz@taller.es"]);
  });

  test("sin copia configurada no se inventa ninguna", () => {
    for (const provider of ["resend", "sendgrid", "brevo", "relay"] as const) {
      const built = buildMailRequest(
        {
          ...transport({ provider }),
          ...(provider === "relay"
            ? { relayUrl: "https://correo.taller.local/enviar" }
            : {}),
        },
        message,
      );
      expect(built.ok, provider).toBe(true);
      if (!built.ok) continue;
      expect(built.request.body, provider).not.toContain('"bcc"');
    }
    const mailgun = buildMailRequest(
      transport({ provider: "mailgun", domain: "taller.es" }),
      message,
    );
    expect(mailgun.ok).toBe(true);
    if (!mailgun.ok) return;
    expect(new URLSearchParams(mailgun.request.body).get("bcc")).toBeNull();
  });
});

describe("el correo del taller — la petición de cada servicio", () => {
  test("Resend: la clave en la cabecera y el sobre en JSON", () => {
    const built = buildMailRequest(
      transport({ replyTo: "mantenimiento@taller.es" }),
      message,
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.request.url).toBe("https://api.resend.com/emails");
    expect(built.request.headers.Authorization).toBe("Bearer key_123");
    const payload = JSON.parse(built.request.body) as Record<string, unknown>;
    expect(payload.from).toBe("Pulso Taller <avisos@taller.es>");
    expect(payload.to).toEqual(["sandra.ruiz@taller.es"]);
    expect(payload.reply_to).toBe("mantenimiento@taller.es");
    expect(payload.text).toBe(message.text);
  });

  test("SendGrid: personalizaciones, remitente aparte y los dos cuerpos", () => {
    const built = buildMailRequest(
      transport({ provider: "sendgrid" }),
      message,
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.request.url).toBe("https://api.sendgrid.com/v3/mail/send");
    const payload = JSON.parse(built.request.body) as {
      personalizations: { to: { email: string }[] }[];
      from: { email: string; name?: string };
      content: { type: string; value: string }[];
    };
    expect(payload.personalizations[0].to).toEqual([
      { email: "sandra.ruiz@taller.es" },
    ]);
    expect(payload.from).toEqual({
      email: "avisos@taller.es",
      name: "Pulso Taller",
    });
    expect(payload.content.map((part) => part.type)).toEqual([
      "text/plain",
      "text/html",
    ]);
  });

  test("Mailgun: el dominio va en la dirección y la clave en Basic", () => {
    const built = buildMailRequest(
      transport({ provider: "mailgun", domain: "taller.es" }),
      message,
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.request.url).toBe(
      "https://api.mailgun.net/v3/taller.es/messages",
    );
    const encoded = built.request.headers.Authorization.replace("Basic ", "");
    expect(Buffer.from(encoded, "base64").toString()).toBe("api:key_123");
    expect(built.request.headers["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    const form = new URLSearchParams(built.request.body);
    expect(form.get("from")).toBe("Pulso Taller <avisos@taller.es>");
    expect(form.getAll("to")).toEqual(["sandra.ruiz@taller.es"]);
    expect(form.get("text")).toBe(message.text);
  });

  test("Brevo: la clave en `api-key` y el cuerpo con sus nombres", () => {
    const built = buildMailRequest(transport({ provider: "brevo" }), message);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.request.url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(built.request.headers["api-key"]).toBe("key_123");
    const payload = JSON.parse(built.request.body) as Record<string, unknown>;
    expect(payload.sender).toEqual({
      email: "avisos@taller.es",
      name: "Pulso Taller",
    });
    expect(payload.htmlContent).toBe(message.html);
    expect(payload.textContent).toBe(message.text);
  });

  test("el relevo propio manda el sobre tal cual, con testigo si lo hay", () => {
    const built = buildMailRequest(
      transport({
        provider: "relay",
        relayUrl: "https://correo.taller.local/enviar",
        relayToken: "testigo_1",
        replyTo: "mantenimiento@taller.es",
      }),
      message,
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.request.url).toBe("https://correo.taller.local/enviar");
    expect(built.request.headers.Authorization).toBe("Bearer testigo_1");
    const payload = JSON.parse(built.request.body) as Record<string, unknown>;
    expect(payload.from).toEqual({
      email: "avisos@taller.es",
      name: "Pulso Taller",
    });
    expect(payload.replyTo).toBe("mantenimiento@taller.es");
  });

  test("Gmail viaja por el relevo con su servidor y sus credenciales dentro", () => {
    const built = buildMailRequest(
      transport({
        provider: "gmail",
        relayUrl: "https://correo.taller.local/enviar",
        relayToken: "testigo_1",
        smtpUser: " Taller@Gmail.com ",
        apiKey: "abcd efgh ijkl mnop",
        replyTo: "mantenimiento@taller.es",
      }),
      message,
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.request.url).toBe("https://correo.taller.local/enviar");
    expect(built.request.headers.Authorization).toBe("Bearer testigo_1");
    const payload = JSON.parse(built.request.body) as {
      to: string[];
      replyTo?: string;
      smtp?: Record<string, unknown>;
    };
    // El backend no puede hablar SMTP: el destino y la cuenta van en el sobre, y
    // el relevo entrega por ahí. La cuenta se normaliza como cualquier correo.
    expect(payload.smtp).toEqual({
      host: "smtp.gmail.com",
      port: 465,
      tls: "ssl",
      user: "taller@gmail.com",
      pass: "abcd efgh ijkl mnop",
    });
    expect(payload.to).toEqual(["sandra.ruiz@taller.es"]);
    expect(payload.replyTo).toBe("mantenimiento@taller.es");

    // El relevo de siempre no lleva servidor: entrega por el suyo del entorno.
    const relay = buildMailRequest(
      transport({
        provider: "relay",
        relayUrl: "https://correo.taller.local/enviar",
      }),
      message,
    );
    expect(relay.ok).toBe(true);
    if (!relay.ok) return;
    expect(
      JSON.parse(relay.request.body) as { smtp?: unknown },
    ).not.toHaveProperty("smtp");
  });

  test("a Gmail, a Ethereal y al relevo se les dice qué les falta", () => {
    const gmail = transport({
      provider: "gmail",
      relayUrl: "https://correo.taller.local/enviar",
      smtpUser: "taller@gmail.com",
    });
    // Sin contraseña se nombra la variable que la puede suplir.
    expect(mailConfigBlocker({ ...gmail, apiKey: "" })).toContain(
      "GMAIL_APP_PASSWORD",
    );
    expect(mailConfigBlocker({ ...gmail, smtpUser: "" })).toContain(
      "Cuenta de Gmail",
    );
    expect(mailConfigBlocker({ ...gmail, relayUrl: "" })).toContain("relevo");
    expect(mailConfigBlocker(gmail)).toBeNull();
    // El buzón de pruebas no tiene variable que lo supla: o está guardada, o no
    // hay nada que mandar.
    const ethereal = {
      ...gmail,
      provider: "ethereal" as const,
      smtpUser: "usuario@ethereal.email",
    };
    expect(mailConfigBlocker({ ...ethereal, apiKey: "" })).toContain(
      "ajustes del correo",
    );
    expect(mailConfigBlocker(ethereal)).toBeNull();
  });

  test("en http:// se avisa de que la contraseña viaja sin cifrar", () => {
    const warning = mailCredentialsWarning({
      provider: "gmail",
      relayUrl: "http://correo.taller.local:8788/enviar",
    });
    expect(warning).toContain("sin cifrar");
    expect(warning).toContain("http://");
    expect(
      mailCredentialsWarning({
        provider: "gmail",
        relayUrl: "https://correo.taller.local/enviar",
      }),
    ).toBeNull();
    // El relevo de siempre no manda credenciales en el sobre: no hay nada que
    // avisar, aunque el puente esté dentro de la red.
    expect(
      mailCredentialsWarning({
        provider: "relay",
        relayUrl: "http://correo.taller.local:8788/enviar",
      }),
    ).toBeNull();
  });

  test("sin clave no se compone nada, y se dice qué falta y dónde", () => {
    const built = buildMailRequest(transport({ apiKey: "" }), message);
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.error).toContain("RESEND_API_KEY");
    expect(mailConfigBlocker(transport({ apiKey: "" }))).toContain("Resend");
    // La pasarela no se pide por esta puerta: la manda su SDK.
    expect(buildMailRequest(transport({ provider: "vly" }), message).ok).toBe(
      false,
    );
  });

  test("sin destinatarios no hay petición", () => {
    const built = buildMailRequest(transport(), { ...message, to: [] });
    expect(built.ok).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* La comprobación previa: conectarse y autenticarse, sin mandar nada  */
/* ------------------------------------------------------------------ */

describe("el correo del taller — la comprobación previa", () => {
  test("se le pide al relevo, con el servidor del sobre si lo tiene", () => {
    // El relevo propio comprueba el suyo del entorno: no lleva servidor.
    const relay = buildMailCheckRequest(
      transport({
        provider: "relay",
        relayUrl: "https://correo.taller.local/enviar",
        relayToken: "testigo_1",
      }),
    );
    expect(relay.ok).toBe(true);
    if (!relay.ok) return;
    // La dirección es la del relevo con `/comprobar` detrás.
    expect(relay.request.url).toBe(
      "https://correo.taller.local/enviar/comprobar",
    );
    expect(relay.request.headers.Authorization).toBe("Bearer testigo_1");
    expect(JSON.parse(relay.request.body) as unknown).toEqual({});

    // Gmail comprueba exactamente el servidor con el que manda después.
    const gmail = buildMailCheckRequest(
      transport({
        provider: "gmail",
        relayUrl: "https://correo.taller.local/enviar/",
        smtpUser: " Taller@Gmail.com ",
        apiKey: "abcd efgh ijkl mnop",
      }),
    );
    expect(gmail.ok).toBe(true);
    if (!gmail.ok) return;
    expect(gmail.request.url).toBe(
      "https://correo.taller.local/enviar/comprobar",
    );
    expect(JSON.parse(gmail.request.body) as unknown).toEqual({
      smtp: {
        host: "smtp.gmail.com",
        port: 465,
        tls: "ssl",
        user: "taller@gmail.com",
        pass: "abcd efgh ijkl mnop",
      },
    });
  });

  test("lo que no se puede comprobar se dice antes de llamar a nadie", () => {
    // Un servicio con API no tiene por dónde conectarse: su prueba manda correo.
    const resend = buildMailCheckRequest(transport({ provider: "resend" }));
    expect(resend.ok).toBe(false);
    if (!resend.ok) expect(resend.error).toContain("Resend");

    const gmail = {
      provider: "gmail" as const,
      relayUrl: "https://correo.taller.local/enviar",
      smtpUser: "taller@gmail.com",
    };
    const sinCuenta = buildMailCheckRequest(
      transport({ ...gmail, smtpUser: "" }),
    );
    expect(sinCuenta.ok).toBe(false);
    if (!sinCuenta.ok) expect(sinCuenta.error).toContain("Cuenta de Gmail");

    const sinClave = buildMailCheckRequest(transport({ ...gmail, apiKey: "" }));
    expect(sinClave.ok).toBe(false);
    if (!sinClave.ok) expect(sinClave.error).toContain("GMAIL_APP_PASSWORD");

    const sinRelevo = buildMailCheckRequest(
      transport({ ...gmail, relayUrl: "" }),
    );
    expect(sinRelevo.ok).toBe(false);
    if (!sinRelevo.ok) expect(sinRelevo.error).toContain("relevo");
  });

  test("lo que contestó el relevo se cuenta en una frase", () => {
    expect(
      mailCheckSummary({
        host: "smtp.gmail.com",
        port: 465,
        tls: "ssl",
        auth: "PLAIN",
      }),
    ).toBe("smtp.gmail.com:465 · TLS directo · AUTH PLAIN");
    expect(
      mailCheckSummary({
        host: "correo.taller.local",
        port: 25,
        tls: "none",
        auth: null,
      }),
    ).toBe("correo.taller.local:25 · sin cifrar · sin autenticación");
  });
});

/* ------------------------------------------------------------------ */
/* Los ajustes guardados: con el servidor de pruebas                   */
/* ------------------------------------------------------------------ */

async function setup() {
  const t = backend();
  const adminId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Ana Ferrer",
      email: "admin@taller.es",
      role: "admin",
    }),
  );
  const managerId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Elena Vidal",
      email: "coord@taller.es",
      role: "manager",
    }),
  );
  return {
    t,
    adminId,
    managerId,
    admin: t.withIdentity({ subject: `${adminId}|session1` }),
    manager: t.withIdentity({ subject: `${managerId}|session1` }),
  };
}

/** Los ajustes de un servicio propio, con lo que manda la pantalla. */
const resendDraft = {
  provider: "resend",
  enabled: true,
  fromName: "Pulso Taller",
  fromEmail: "avisos@taller.es",
  replyTo: "",
  bcc: "",
  domain: "",
  relayUrl: "",
};

/** Respuesta buena del servicio, sin salir a la red. */
function stubFetch(status = 200, body = '{"id":"msg_1"}') {
  const fetchMock = vi.fn(async () => new Response(body, { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function expectConvexError(promise: Promise<unknown>, fragment: string) {
  const error = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(error, `Se esperaba un error con: ${fragment}`).not.toBeNull();
  const message =
    error instanceof ConvexError ? String(error.data) : String(error);
  expect(message).toContain(fragment);
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.RESEND_API_KEY;
  delete process.env.SENDGRID_API_KEY;
  delete process.env.VLY_INTEGRATION_KEY;
});

describe("el correo del taller — los ajustes guardados", () => {
  test("solo el administrador los lee, los cambia y los prueba", async () => {
    const { manager } = await setup();
    await expectConvexError(
      manager.query(api.mailSettings.settings, {}),
      "Solo el administrador",
    );
    await expectConvexError(
      manager.mutation(api.mailSettings.save, {
        ...resendDraft,
        apiKey: "key_123",
      }),
      "Solo el administrador",
    );
    await expectConvexError(
      manager.action(api.mailSettings.sendTest, { to: "admin@taller.es" }),
      "Solo el administrador",
    );
  });

  test("la clave se guarda y no vuelve al navegador", async () => {
    const { admin } = await setup();
    await admin.mutation(api.mailSettings.save, {
      ...resendDraft,
      apiKey: "re_123456789",
    });

    const view = await admin.query(api.mailSettings.settings, {});
    expect(view.provider).toBe("resend");
    expect(view.fromEmail).toBe("avisos@taller.es");
    expect(view.hasKey).toBe(true);
    expect(view.keySource).toBe("guardada");
    // Lo único que se enseña de la clave son sus últimos cuatro caracteres.
    expect(view.keyHint).toBe("…6789");
    expect(JSON.stringify(view)).not.toContain("re_123456789");
  });

  test("sin clave guardada vale la del servidor, y se dice de dónde viene", async () => {
    const { admin } = await setup();
    process.env.RESEND_API_KEY = "re_env_9876";
    await admin.mutation(api.mailSettings.save, resendDraft);

    const view = await admin.query(api.mailSettings.settings, {});
    expect(view.hasKey).toBe(true);
    expect(view.keySource).toBe("entorno");
    expect(view.envVar).toBe("RESEND_API_KEY");
    expect(view.envConfigured).toBe(true);
    expect(JSON.stringify(view)).not.toContain("re_env_9876");
  });

  test("cambiar de servicio no arrastra la clave del anterior", async () => {
    const { admin } = await setup();
    await admin.mutation(api.mailSettings.save, {
      ...resendDraft,
      apiKey: "re_123456789",
    });
    const view = await admin.mutation(api.mailSettings.save, {
      ...resendDraft,
      provider: "sendgrid",
    });
    expect(view.provider).toBe("sendgrid");
    expect(view.hasKey).toBe(false);
    expect(view.keySource).toBe("ninguna");
  });

  test("un ajuste a medias no se guarda y el motivo se lee", async () => {
    const { admin } = await setup();
    await expectConvexError(
      admin.mutation(api.mailSettings.save, { ...resendDraft, fromEmail: "" }),
      "remitente",
    );
    // Sin nada guardado, la consulta devuelve los ajustes de partida.
    const view = await admin.query(api.mailSettings.settings, {});
    expect(view.provider).toBe("vly");
  });

  test("la prueba manda el correo por el servicio guardado y apunta el resultado", async () => {
    const { admin } = await setup();
    await admin.mutation(api.mailSettings.save, {
      ...resendDraft,
      apiKey: "re_test_123",
    });
    const fetchMock = stubFetch();

    const result = await admin.action(api.mailSettings.sendTest, {
      to: "Ana@Taller.es",
    });
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test_123");
    const payload = JSON.parse(init.body) as {
      to: string[];
      subject: string;
      text: string;
    };
    expect(payload.to).toEqual(["ana@taller.es"]);
    expect(payload.subject).toContain("Prueba");
    expect(payload.text).toContain("Resend");

    const view = await admin.query(api.mailSettings.settings, {});
    expect(view.lastTestOk).toBe(true);
    expect(view.lastTestTo).toBe("ana@taller.es");
    expect(view.lastTestError).toBeNull();
  });

  test("si el servicio contesta con un error, se lee en la pantalla", async () => {
    const { admin } = await setup();
    await admin.mutation(api.mailSettings.save, {
      ...resendDraft,
      apiKey: "re_test_123",
    });
    stubFetch(401, '{"message":"API key is invalid"}');

    const result = await admin.action(api.mailSettings.sendTest, {
      to: "ana@taller.es",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("HTTP 401");
    expect(result.error).toContain("Resend");

    const view = await admin.query(api.mailSettings.settings, {});
    expect(view.lastTestOk).toBe(false);
    expect(view.lastTestError).toContain("API key is invalid");
  });

  test("la prueba exige una dirección con forma de correo", async () => {
    const { admin } = await setup();
    await expectConvexError(
      admin.action(api.mailSettings.sendTest, { to: "ana" }),
      "no parece un correo",
    );
  });
});

/* ------------------------------------------------------------------ */
/* El histórico de envíos: qué salió, a quién y qué contestó el servicio */
/* ------------------------------------------------------------------ */

describe("el correo del taller — el histórico de envíos", () => {
  test("apunta el sobre y el resultado, y lo lee solo el administrador", async () => {
    const { admin, manager } = await setup();
    await admin.mutation(api.mailSettings.save, {
      ...resendDraft,
      bcc: "Archivo@Taller.es",
      apiKey: "re_test_123",
    });
    stubFetch();
    await admin.action(api.mailSettings.sendTest, { to: "Ana@Taller.es" });

    const rows = await admin.query(api.mailLog.history, {});
    expect(rows).toHaveLength(1);
    expect(rows[0].origin).toBe("prueba");
    expect(rows[0].ok).toBe(true);
    expect(rows[0].provider).toBe("resend");
    expect(rows[0].to).toEqual(["ana@taller.es"]);
    expect(rows[0].bcc).toEqual(["archivo@taller.es"]);
    expect(rows[0].subject).toContain("Prueba");
    expect(rows[0].error).toBeUndefined();
    // El histórico guarda el sobre, no el cuerpo del correo.
    expect(JSON.stringify(rows[0])).not.toContain("Ajustes del taller");

    await expectConvexError(
      manager.query(api.mailLog.history, {}),
      "Solo el administrador",
    );
  });

  test("un envío fallido también queda, con el motivo del servicio", async () => {
    const { admin } = await setup();
    await admin.mutation(api.mailSettings.save, {
      ...resendDraft,
      apiKey: "re_test_123",
    });
    stubFetch(401, '{"message":"API key is invalid"}');
    await admin.action(api.mailSettings.sendTest, { to: "ana@taller.es" });

    const rows = await admin.query(api.mailLog.history, {});
    expect(rows).toHaveLength(1);
    expect(rows[0].ok).toBe(false);
    expect(rows[0].error).toContain("API key is invalid");
    // Sin copia oculta, la lista va vacía: no se rellena con el remitente.
    expect(rows[0].bcc).toEqual([]);
  });

  test("se queda con los últimos y no crece sin freno", async () => {
    const { t, admin } = await setup();
    await admin.mutation(api.mailSettings.save, {
      ...resendDraft,
      apiKey: "re_test_123",
    });
    await t.run(async (ctx) => {
      for (let index = 0; index < MAIL_LOG_LIMIT + 3; index += 1) {
        await ctx.db.insert("mailLog", {
          at: index,
          what: "un envío viejo",
          origin: "resumen",
          provider: "resend",
          to: ["taller@taller.es"],
          bcc: [],
          subject: `Resumen ${index}`,
          ok: true,
        });
      }
    });
    stubFetch();
    await admin.action(api.mailSettings.sendTest, { to: "ana@taller.es" });

    const rows = await admin.query(api.mailLog.history, {
      limit: MAIL_LOG_LIMIT,
    });
    expect(rows).toHaveLength(MAIL_LOG_LIMIT);
    // El más reciente es el que se acaba de mandar; los viejos se han ido.
    expect(rows[0].origin).toBe("prueba");
    expect(rows[rows.length - 1].at).toBeGreaterThan(3);
  });
});

/* ------------------------------------------------------------------ */
/* El aviso interno: qué roles lo reciben                              */
/* ------------------------------------------------------------------ */

describe("el aviso interno de una incidencia nueva", () => {
  test("solo el administrador elige los roles, y un rol borrado no se guarda", async () => {
    const { admin, manager } = await setup();
    await expectConvexError(
      manager.mutation(api.mailSettings.setIncidentRoles, {
        roleKeys: ["technician"],
      }),
      "Solo el administrador",
    );
    await expectConvexError(
      admin.mutation(api.mailSettings.setIncidentRoles, {
        roleKeys: ["rol-inventado"],
      }),
      "ya no existen",
    );
    // Sin repetidos, y se devuelve la vista para que la pantalla no recargue.
    const view = await admin.mutation(api.mailSettings.setIncidentRoles, {
      roleKeys: ["technician", "technician"],
    });
    expect(view.incidentRoles).toEqual(["technician"]);
  });

  test("sale a los roles marcados, sin invitados ni cuentas de baja", async () => {
    const { t, admin } = await setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        name: "Técnico Uno",
        email: "tecnico@taller.es",
        role: "technician",
      });
      await ctx.db.insert("users", {
        name: "Técnico de baja",
        email: "baja@taller.es",
        role: "technician",
        active: false,
      });
      await ctx.db.insert("users", {
        name: "Otra coordinación",
        email: "coord2@taller.es",
        role: "manager",
      });
    });
    await admin.mutation(api.mailSettings.save, {
      ...resendDraft,
      apiKey: "re_test_123",
    });
    await admin.mutation(api.mailSettings.setIncidentRoles, {
      roleKeys: ["technician"],
    });
    const fetchMock = stubFetch();

    await t.mutation(api.incidents.report, reportArgs);
    await deliverScheduled(t);

    // Dos correos distintos: el de quien notificó —su código— y el interno.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const bodies = fetchMock.mock.calls.map(
      ([, init]) =>
        JSON.parse((init as { body: string }).body) as {
          to: string[];
          subject: string;
        },
    );
    const internal = bodies.find((body) =>
      body.to.includes("tecnico@taller.es"),
    );
    expect(internal, "el aviso interno no salió").toBeTruthy();
    expect(internal?.to).toEqual(["tecnico@taller.es"]);
    expect(internal?.subject).toContain("Nueva incidencia");
    expect(internal?.subject).toContain("INC-0001");
    // La baja y la coordinación no estaban marcadas: no reciben nada.
    expect(internal?.to).not.toContain("baja@taller.es");
    expect(internal?.to).not.toContain("coord2@taller.es");

    const log = await admin.query(api.mailLog.history, {});
    const entry = log.find((row) => row.origin === "equipo");
    expect(entry?.to).toEqual(["tecnico@taller.es"]);
    expect(entry?.ok).toBe(true);
    expect(entry?.subject).toContain("INC-0001");
  });

  test("sin roles marcados no se manda el aviso interno", async () => {
    const { t, admin } = await setup();
    await admin.mutation(api.mailSettings.save, {
      ...resendDraft,
      apiKey: "re_test_123",
    });
    const fetchMock = stubFetch();

    await t.mutation(api.incidents.report, reportArgs);
    await deliverScheduled(t);

    // Solo el correo de quien notificó.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const log = await admin.query(api.mailLog.history, {});
    expect(log.filter((row) => row.origin === "equipo")).toHaveLength(0);
  });

  test("la asignación y el cierre también salen al taller, una vez cada uno", async () => {
    const { t, admin, adminId, managerId } = await setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        name: "Técnico Uno",
        email: "tecnico@taller.es",
        role: "technician",
      });
    });
    await admin.mutation(api.mailSettings.save, {
      ...resendDraft,
      apiKey: "re_test_123",
    });
    await admin.mutation(api.mailSettings.setIncidentRoles, {
      roleKeys: ["technician"],
    });
    const fetchMock = stubFetch();

    await t.mutation(api.incidents.report, reportArgs);
    await deliverScheduled(t);
    const row = await t.run((ctx) =>
      ctx.db
        .query("incidents")
        .withIndex("by_reference", (q) => q.eq("reference", "INC-0001"))
        .unique(),
    );

    await admin.mutation(api.incidents.assign, {
      incidentId: row!._id,
      assigneeId: managerId,
    });
    await deliverScheduled(t);

    // Reasignar no es un aviso nuevo: ni el invitado ni el taller lo reciben
    // otra vez, que es la misma regla que ya valía para quien notificó.
    await admin.mutation(api.incidents.assign, {
      incidentId: row!._id,
      assigneeId: adminId,
    });
    await deliverScheduled(t);

    await admin.mutation(api.incidents.verify, {
      incidentId: row!._id,
      outcome: "onsite",
    });
    await deliverScheduled(t);

    const bodies = fetchMock.mock.calls.map(
      ([, init]) =>
        JSON.parse((init as { body: string }).body) as {
          to: string[];
          subject: string;
          text: string;
        },
    );
    const internal = bodies.filter((body) =>
      body.to.includes("tecnico@taller.es"),
    );
    // Alta, asignación y cierre: tres, no uno por cada toque de la ficha.
    expect(internal).toHaveLength(3);
    const subjects = internal.map((body) => body.subject).join("\n");
    expect(subjects).toContain("Nueva incidencia");
    expect(subjects).toContain("Incidencia asignada");
    expect(subjects).toContain("Incidencia resuelta");
    const assigned = internal.find((body) => body.subject.includes("asignada"));
    expect(assigned?.text).toContain("Lo lleva: Elena Vidal");

    const log = await admin.query(api.mailLog.history, {});
    expect(log.filter((entry) => entry.origin === "equipo")).toHaveLength(3);
    const updated = await t.run((ctx) => ctx.db.get(row!._id));
    expect(updated?.staffNotifiedStatus).toBe("resolved");
  });

  test("dos toques seguidos no reparten dos veces el mismo aviso", async () => {
    const { t, admin, adminId, managerId } = await setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        name: "Técnico Uno",
        email: "tecnico@taller.es",
        role: "technician",
      });
    });
    await admin.mutation(api.mailSettings.save, {
      ...resendDraft,
      apiKey: "re_test_123",
    });
    await admin.mutation(api.mailSettings.setIncidentRoles, {
      roleKeys: ["technician"],
    });
    const fetchMock = stubFetch();

    await t.mutation(api.incidents.report, reportArgs);
    const row = await t.run((ctx) =>
      ctx.db
        .query("incidents")
        .withIndex("by_reference", (q) => q.eq("reference", "INC-0001"))
        .unique(),
    );

    // Dos asignaciones antes de que salga el primer correo: las dos ven la ficha
    // sin el aviso apuntado todavía, así que las dos lo programan. El segundo
    // sobra, y lo descarta el propio envío al ver que ya se dio.
    await admin.mutation(api.incidents.assign, {
      incidentId: row!._id,
      assigneeId: managerId,
    });
    await admin.mutation(api.incidents.assign, {
      incidentId: row!._id,
      assigneeId: adminId,
    });
    await deliverScheduled(t);

    const internal = fetchMock.mock.calls
      .map(
        ([, init]) =>
          JSON.parse((init as { body: string }).body) as {
            to: string[];
            subject: string;
          },
      )
      .filter((body) => body.to.includes("tecnico@taller.es"));
    expect(internal).toHaveLength(2);
    expect(
      internal.filter((body) => body.subject.includes("asignada")),
    ).toHaveLength(1);
  });

  test("guardar el servidor de correo no borra los roles del aviso", async () => {
    const { admin } = await setup();
    await admin.mutation(api.mailSettings.setIncidentRoles, {
      roleKeys: ["manager"],
    });
    await admin.mutation(api.mailSettings.save, {
      ...resendDraft,
      apiKey: "re_test_123",
    });
    const view = await admin.query(api.mailSettings.settings, {});
    expect(view.incidentRoles).toEqual(["manager"]);
  });
});

/* ------------------------------------------------------------------ */
/* El aviso de una incidencia sale por donde diga el taller            */
/* ------------------------------------------------------------------ */

/** Deja correr lo que las mutaciones programaron (el aviso sale con retardo 0). */
async function deliverScheduled(t: Test) {
  vi.useFakeTimers();
  try {
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  } finally {
    vi.useRealTimers();
  }
}

const reportArgs = {
  reporterName: "Sandra Ruiz",
  reporterEmail: "sandra.ruiz@taller.es",
  equipmentKind: "Cámara de estudio",
  model: "HDC-3500",
  description: "Se apaga sola en directo cuando se mueve el cable de vídeo.",
  reportedAt: Date.now() - 60 * 60 * 1000,
};

describe("el aviso a quien notificó — sale por el servicio configurado", () => {
  test("con un servicio propio, el aviso va por él y no por la pasarela", async () => {
    const { t, admin } = await setup();
    await admin.mutation(api.mailSettings.save, {
      ...resendDraft,
      apiKey: "re_test_123",
    });
    // La clave del deployment sigue puesta: si el aviso acabara en la pasarela,
    // esta prueba lo vería en la dirección de la llamada.
    process.env.VLY_INTEGRATION_KEY = "sk_deployment";
    const fetchMock = stubFetch();

    await t.mutation(api.incidents.report, reportArgs);
    await deliverScheduled(t);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    expect(url).toBe("https://api.resend.com/emails");
    const payload = JSON.parse(init.body) as {
      to: string[];
      from: string;
      subject: string;
    };
    expect(payload.to).toEqual(["sandra.ruiz@taller.es"]);
    expect(payload.from).toBe("Pulso Taller <avisos@taller.es>");
    // El correo va con el código de seguimiento, no con la referencia interna.
    expect(payload.subject).toMatch(/[A-Z0-9]{4}-[A-Z0-9]{4}/);
    expect(payload.subject).not.toContain("INC-");

    const row = await t.run((ctx) =>
      ctx.db
        .query("incidents")
        .withIndex("by_reference", (q) => q.eq("reference", "INC-0001"))
        .unique(),
    );
    expect(row?.emailedAt).toBeTypeOf("number");
    expect(row?.emailError).toBeUndefined();

    // El envío queda en el histórico, con la incidencia a la que pertenece.
    const log = await admin.query(api.mailLog.history, {});
    expect(log).toHaveLength(1);
    expect(log[0].origin).toBe("incidencia");
    expect(log[0].to).toEqual(["sandra.ruiz@taller.es"]);
    expect(log[0].relatedId).toBe(row?._id);
  });

  test("con el correo apagado no sale nada, y el motivo queda en la ficha", async () => {
    const { t, admin } = await setup();
    await admin.mutation(api.mailSettings.save, {
      ...resendDraft,
      enabled: false,
      apiKey: "re_test_123",
    });
    const fetchMock = stubFetch();

    await t.mutation(api.incidents.report, reportArgs);
    await deliverScheduled(t);

    expect(fetchMock).not.toHaveBeenCalled();
    const row = await t.run((ctx) =>
      ctx.db
        .query("incidents")
        .withIndex("by_reference", (q) => q.eq("reference", "INC-0001"))
        .unique(),
    );
    expect(row?.emailedAt).toBeUndefined();
    expect(row?.emailError).toContain("apagado");

    // El intento no salió, y eso también se apunta: es la respuesta a «no me
    // llegó nada» sin tener que abrir la ficha.
    const log = await admin.query(api.mailLog.history, {});
    expect(log).toHaveLength(1);
    expect(log[0].ok).toBe(false);
    expect(log[0].error).toContain("apagado");
  });

  test("un Gmail guardado manda la prueba por el relevo con su cuenta", async () => {
    const { admin } = await setup();
    await admin.mutation(api.mailSettings.save, {
      provider: "gmail",
      enabled: true,
      fromName: "Pulso Taller",
      fromEmail: "taller@gmail.com",
      replyTo: "",
      bcc: "",
      domain: "",
      relayUrl: "https://correo.taller.local/enviar",
      smtpUser: " Taller@Gmail.com ",
      apiKey: "abcd efgh ijkl mnop",
    });
    const fetchMock = stubFetch();

    const result = await admin.action(api.mailSettings.sendTest, {
      to: "sandra.ruiz@taller.es",
    });
    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    expect(url).toBe("https://correo.taller.local/enviar");
    const payload = JSON.parse(init.body) as { smtp?: Record<string, unknown> };
    expect(payload.smtp).toEqual({
      host: "smtp.gmail.com",
      port: 465,
      tls: "ssl",
      user: "taller@gmail.com",
      pass: "abcd efgh ijkl mnop",
    });

    // La pantalla tiene que poder corregir la cuenta sin volver a escribir la
    // contraseña, y la contraseña no puede volver nunca.
    const view = await admin.query(api.mailSettings.settings, {});
    expect(view.provider).toBe("gmail");
    expect(view.smtpUser).toBe("taller@gmail.com");
    expect(view.hasKey).toBe(true);
    expect(view.keyHint).toBe("…mnop");
    expect(view.relayUrl).toBe("https://correo.taller.local/enviar");
    expect(JSON.stringify(view)).not.toContain("abcd efgh");
  });

  test("la comprobación previa conecta y se autentica, sin mandar ningún correo", async () => {
    const { admin } = await setup();
    await admin.mutation(api.mailSettings.save, {
      provider: "gmail",
      enabled: true,
      fromName: "Pulso Taller",
      fromEmail: "taller@gmail.com",
      replyTo: "",
      bcc: "",
      domain: "",
      relayUrl: "https://correo.taller.local/enviar",
      smtpUser: "taller@gmail.com",
      apiKey: "abcd efgh ijkl mnop",
    });
    const fetchMock = stubFetch(
      200,
      JSON.stringify({
        ok: true,
        check: {
          host: "smtp.gmail.com",
          port: 465,
          tls: "ssl",
          auth: "PLAIN",
          greeting: "ESMTP",
        },
      }),
    );

    const result = await admin.action(api.mailSettings.check, {});
    expect(result.ok).toBe(true);
    expect(result.detail).toBe("smtp.gmail.com:465 · TLS directo · AUTH PLAIN");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    expect(url).toBe("https://correo.taller.local/enviar/comprobar");
    const payload = JSON.parse(init.body) as { smtp?: Record<string, unknown> };
    expect(payload.smtp).toEqual({
      host: "smtp.gmail.com",
      port: 465,
      tls: "ssl",
      user: "taller@gmail.com",
      pass: "abcd efgh ijkl mnop",
    });

    // No ha salido ningún correo, así que no hay nada que apuntar en el
    // histórico: allí se apunta el sobre que salió.
    const log = await admin.query(api.mailLog.history, {});
    expect(log).toHaveLength(0);
  });

  test("si el relevo no puede, el motivo llega a la pantalla", async () => {
    const { admin, manager } = await setup();
    await admin.mutation(api.mailSettings.save, {
      provider: "relay",
      enabled: true,
      fromName: "Pulso Taller",
      fromEmail: "avisos@taller.es",
      replyTo: "",
      bcc: "",
      domain: "",
      relayUrl: "https://correo.taller.local/enviar",
    });
    stubFetch(
      502,
      JSON.stringify({
        ok: false,
        error: "SMTP 535 en AUTH PLAIN: usuario o contraseña",
      }),
    );

    const failed = await admin.action(api.mailSettings.check, {});
    expect(failed.ok).toBe(false);
    expect(failed.error).toContain("535");

    // Y sin poder tocar el correo no se comprueba nada.
    await expectConvexError(
      manager.action(api.mailSettings.check, {}),
      "Solo el administrador",
    );
  });
});
