import {
  createServer,
  type AddressInfo,
  type Server,
  type Socket,
} from "node:net";
import { afterEach, describe, expect, test } from "vitest";
import {
  MAX_RECIPIENTS,
  RelayConfigError,
  RelayRequestError,
  RelaySmtpError,
  applySmtpOverride,
  composeMessage,
  createRelayServer,
  dotStuff,
  parseEnvelope,
  parseSmtpOverride,
  readRelayConfig,
  resolveSmtp,
  sendSmtp,
  verifySmtp,
} from "../scripts/mail-relay-lib.mjs";

/**
 * El relevo de correo: el puente HTTP que entrega por SMTP lo que el backend de
 * Convex no puede mandar por su cuenta.
 *
 * El protocolo SMTP se prueba contra un servidor de mentira en `127.0.0.1`: se
 * mira la conversación real —saludo, autenticación, remitente, destinatarios,
 * mensaje— y no una maqueta del cliente. Y el HTTP se prueba levantando el
 * servidor de verdad en un puerto libre, con el envío inyectado, para ver los
 * códigos que verá el backend.
 */

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
});

const envelope = {
  from: { email: "avisos@taller.es", name: "Pulso Taller" },
  to: ["sandra.ruiz@taller.es"],
  bcc: ["archivo@taller.es"],
  subject: "Nueva incidencia · INC-0129",
  text: "Ha entrado una incidencia nueva en el taller.",
  html: "<p>Ha entrado una incidencia nueva en el taller.</p>",
  replyTo: "",
};

/** El servidor que trae un sobre de Gmail: lo compone `src/lib/mail.ts`. */
const smtpOverride = {
  host: "smtp.gmail.com",
  port: 465,
  tls: "ssl",
  user: "taller@gmail.com",
  pass: "abcd efgh ijkl mnop",
};

/* ------------------------------------------------------------------ */
/* Configuración                                                       */
/* ------------------------------------------------------------------ */

describe("el relevo — la configuración", () => {
  test("sin servidor SMTP arranca igual: el sobre de Gmail o Ethereal trae el suyo", () => {
    // El taller que solo prueba con Gmail o con el buzón de Ethereal no tiene un
    // servidor de la casa que poner en SMTP_HOST: exigirlo le dejaba sin puente
    // justo en el caso más fácil.
    const config = readRelayConfig({});
    expect(config.port).toBe(8788);
    expect(config.smtp).toBeNull();
  });

  test("unas credenciales sueltas sin servidor no se ignoran en silencio", () => {
    expect(() => readRelayConfig({ SMTP_USER: "taller" })).toThrow(
      RelayConfigError,
    );
    expect(() => readRelayConfig({ SMTP_FROM: "avisos@taller.es" })).toThrow(
      /SMTP_HOST/,
    );
  });

  test("sin servidor ni en el entorno ni en el sobre se dice qué falta", () => {
    // Con el relevo arrancado sin SMTP_HOST, un sobre que no trae servidor no
    // tiene a dónde ir: se contesta con una frase, no con un error de red.
    expect(() => resolveSmtp(null, null)).toThrow(RelayRequestError);
    expect(() => resolveSmtp(null, null)).toThrow(/SMTP_HOST/);
    // Y cuando el sobre sí lo trae, se entrega por él con los valores del relevo.
    const smtp = resolveSmtp(null, smtpOverride);
    expect(smtp).toMatchObject({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      user: "taller@gmail.com",
      helo: "pulso-taller.local",
      rejectUnauthorized: true,
    });
  });

  test("los valores de partida son los del taller", () => {
    const config = readRelayConfig({ SMTP_HOST: "correo.taller.local" });
    expect(config.port).toBe(8788);
    expect(config.path).toBe("/enviar");
    expect(config.maxBodyBytes).toBe(1024 * 1024);
    expect(config.smtp.port).toBe(587);
    // 587 negocia STARTTLS si el servidor lo ofrece; 465 es TLS directo.
    expect(config.smtp.tls).toBe("auto");
    expect(config.smtp.secure).toBe(false);
    expect(readRelayConfig({ SMTP_HOST: "x", SMTP_PORT: "465" }).smtp.tls).toBe(
      "ssl",
    );
  });

  test("una credencial a medias o un modo raro se rechazan al arrancar", () => {
    expect(() =>
      readRelayConfig({ SMTP_HOST: "x", SMTP_USER: "taller" }),
    ).toThrow(/SMTP_PASS/);
    expect(() =>
      readRelayConfig({ SMTP_HOST: "x", SMTP_PASS: "secreto" }),
    ).toThrow(/SMTP_USER/);
    expect(() => readRelayConfig({ SMTP_HOST: "x", SMTP_TLS: "ssl3" })).toThrow(
      /SMTP_TLS/,
    );
    expect(() =>
      readRelayConfig({ SMTP_HOST: "x", SMTP_FROM: "no-es-un-correo" }),
    ).toThrow(/SMTP_FROM/);
  });

  test("el testigo y el camino se normalizan", () => {
    const config = readRelayConfig({
      SMTP_HOST: "correo.taller.local",
      MAIL_RELAY_TOKEN: "  testigo-123  ",
      MAIL_RELAY_PATH: "correo",
    });
    expect(config.token).toBe("testigo-123");
    expect(config.path).toBe("/correo");
  });
});

/* ------------------------------------------------------------------ */
/* El sobre                                                            */
/* ------------------------------------------------------------------ */

describe("el relevo — el sobre que llega", () => {
  test("se normaliza y se rellenan los dos cuerpos", () => {
    const parsed = parseEnvelope({
      from: { email: "Avisos@Taller.es" },
      to: [" Sandra.Ruiz@Taller.es "],
      subject: "  Nueva incidencia  ",
      text: "Solo texto",
    });
    expect(parsed.from).toEqual({ email: "avisos@taller.es", name: "" });
    expect(parsed.to).toEqual(["sandra.ruiz@taller.es"]);
    expect(parsed.subject).toBe("Nueva incidencia");
    // Sin HTML se compone uno para no mandar un correo a medias.
    expect(parsed.html).toContain("Solo texto");
    expect(parsed.bcc).toEqual([]);
  });

  test("quien ya está en «para» no se repite en la copia oculta", () => {
    const parsed = parseEnvelope({
      ...envelope,
      bcc: ["SANDRA.RUIZ@taller.es", "archivo@taller.es"],
    });
    expect(parsed.bcc).toEqual(["archivo@taller.es"]);
  });

  test("solo HTML: el texto se saca sin etiquetas", () => {
    const parsed = parseEnvelope({
      from: { email: "avisos@taller.es" },
      to: ["sandra@taller.es"],
      subject: "Hola",
      html: "<p>Uno</p><p>Dos</p>",
    });
    expect(parsed.text).toContain("Uno");
    expect(parsed.text).toContain("Dos");
    expect(parsed.text).not.toContain("<p>");
  });

  test("un salto de línea en una cabecera se rechaza", () => {
    expect(() =>
      parseEnvelope({ ...envelope, subject: "Hola\r\nBcc: otro@taller.es" }),
    ).toThrow(/saltos de línea/);
    expect(() =>
      parseEnvelope({
        ...envelope,
        to: ["ok@taller.es\r\nBcc: otro@taller.es"],
      }),
    ).toThrow(RelayRequestError);
  });

  test("sin destinatarios, sin remitente o con demasiados no hay correo", () => {
    expect(() => parseEnvelope({ ...envelope, to: [] })).toThrow(
      /destinatarios/,
    );
    expect(() => parseEnvelope({ ...envelope, from: {} })).toThrow(
      /from\.email/,
    );
    const many = Array.from(
      { length: MAX_RECIPIENTS + 1 },
      (_, index) => `persona${index}@taller.es`,
    );
    expect(() => parseEnvelope({ ...envelope, to: many })).toThrow(
      /demasiados destinatarios/,
    );
  });

  test("un sobre vacío tampoco se manda", () => {
    expect(() =>
      parseEnvelope({ ...envelope, text: "  ", html: "  " }),
    ).toThrow(/cuerpo/);
    expect(() => parseEnvelope([])).toThrow(/objeto JSON/);
  });
});

/* ------------------------------------------------------------------ */
/* El servidor SMTP que puede traer el sobre                           */
/* ------------------------------------------------------------------ */

describe("el relevo — el servidor SMTP del sobre", () => {
  test("se lee entero: host, puerto, cifrado y credenciales", () => {
    expect(
      parseSmtpOverride({
        host: " SMTP.Gmail.com ",
        port: 465,
        tls: "SSL",
        user: "taller@gmail.com",
        pass: "abcd efgh ijkl mnop",
      }),
    ).toEqual({
      host: "smtp.gmail.com",
      port: 465,
      tls: "ssl",
      secure: true,
      user: "taller@gmail.com",
      pass: "abcd efgh ijkl mnop",
    });
    // Sin servidor en el sobre vale el del entorno del relevo.
    expect(parseSmtpOverride(undefined)).toBeNull();
    expect(parseSmtpOverride(null)).toBeNull();
    // Un puerto también puede llegar como texto, que es lo que hace un JSON.
    expect(
      parseSmtpOverride({
        host: "smtp.ethereal.email",
        port: "587",
        tls: "starttls",
        user: "usuario@ethereal.email",
        pass: "prueba",
      })?.port,
    ).toBe(587);
  });

  test("un servidor a medias o con mala pinta no se usa", () => {
    const base = {
      host: "smtp.gmail.com",
      port: 465,
      tls: "ssl",
      user: "taller@gmail.com",
      pass: "secreto",
    };
    const rejected: unknown[] = [
      "smtp.gmail.com",
      { ...base, host: "" },
      { ...base, host: "smtp gmail.com" },
      { ...base, host: "smtp..gmail..com;drop" },
      { ...base, port: "465x" },
      { ...base, port: 70000 },
      { ...base, tls: "ssl3" },
      { ...base, user: "" },
      { ...base, pass: "" },
      { ...base, pass: "linea\r\nsecreta" },
    ];
    for (const value of rejected) {
      expect(() => parseSmtpOverride(value), JSON.stringify(value)).toThrow(
        RelayRequestError,
      );
    }
    // Ni la contraseña ni el usuario se cuelan en el motivo del error.
    const error = (() => {
      try {
        parseSmtpOverride({ ...base, pass: "" });
        return null;
      } catch (reason) {
        return reason as Error;
      }
    })();
    expect(error?.message).not.toContain("taller@gmail.com");
  });

  test("el servidor del sobre manda sobre el del entorno, y solo en lo suyo", () => {
    const base = {
      host: "correo.taller.local",
      port: 25,
      tls: "auto",
      secure: false,
      user: "",
      pass: "",
      from: "",
      helo: "relevo.test",
    };
    const override = parseSmtpOverride({
      host: "smtp.gmail.com",
      port: 465,
      tls: "ssl",
      user: "taller@gmail.com",
      pass: "abcd efgh ijkl mnop",
    });
    expect(applySmtpOverride(base, override)).toMatchObject({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      user: "taller@gmail.com",
      // Google y Ethereal dan permiso a esa misma cuenta para mandar: el
      // remitente SMTP es ella, no el del taller.
      from: "taller@gmail.com",
      // Lo que ya estaba decidido en el relevo no se toca.
      helo: "relevo.test",
    });
    expect(
      applySmtpOverride({ ...base, from: "avisos@taller.es" }, override).from,
    ).toBe("avisos@taller.es");
    // Sin servidor en el sobre, la configuración del relevo tal cual.
    expect(applySmtpOverride(base, null)).toBe(base);
  });
});

/* ------------------------------------------------------------------ */
/* El mensaje                                                          */
/* ------------------------------------------------------------------ */

describe("el relevo — el mensaje MIME", () => {
  test("asunto con acentos y remitente con nombre", () => {
    const message = composeMessage({
      ...envelope,
      subject: "Relevo de correo · así sí",
    });
    expect(message).toContain('From: "Pulso Taller" <avisos@taller.es>');
    // RFC 2047: un asunto con acentos viaja codificado, no roto.
    expect(message).toMatch(/Subject: =\?UTF-8\?B\?/);
    expect(message).toContain("MIME-Version: 1.0");
    expect(message).toContain("multipart/alternative");
  });

  test("la copia oculta no aparece en ninguna cabecera", () => {
    const message = composeMessage(envelope);
    const headers = message.split("\r\n\r\n")[0];
    expect(headers).toContain("sandra.ruiz@taller.es");
    expect(headers).not.toContain("archivo@taller.es");
    expect(headers.toLowerCase()).not.toContain("bcc:");
  });

  test("los dos cuerpos llegan íntegros en base64", () => {
    const message = composeMessage({
      ...envelope,
      text: "Línea uno\nLínea dos con ñ y á",
    });
    const bodies = message.split("\r\n\r\n").slice(1).join("\r\n\r\n");
    const decoded = bodies
      .split(/Content-Transfer-Encoding: base64\r\n\r\n/)
      .slice(1)
      .map((part) =>
        Buffer.from(
          part.split(/\r\n--/)[0].replace(/\r\n/g, ""),
          "base64",
        ).toString("utf8"),
      )
      .join("\n");
    expect(decoded).toContain("Línea uno");
    expect(decoded).toContain("Línea dos con ñ y á");
    expect(decoded).toContain("<p>");
  });

  test("un punto al principio de línea se duplica y SMTP lo deshace", () => {
    expect(dotStuff("uno\r\n.dos")).toBe("uno\r\n..dos");
    expect(dotStuff("uno\r\n..dos")).toBe("uno\r\n...dos");
  });
});

/* ------------------------------------------------------------------ */
/* SMTP contra un servidor de mentira                                  */
/* ------------------------------------------------------------------ */

interface FakeSmtp {
  port: number;
  commands: string[];
  data: () => string;
}

/** Un servidor SMTP mínimo: lo justo para mirar la conversación del relevo. */
async function fakeSmtp(
  options: { rejectRcpt?: string; authCode?: number } = {},
): Promise<FakeSmtp> {
  const commands: string[] = [];
  let data = "";
  const server = createServer((socket: Socket) => {
    // El relevo cierra la conexión al terminar (y al rendirse): eso en el lado
    // del servidor de mentira es un reset, no un fallo de la prueba.
    socket.on("error", () => {});
    socket.setEncoding("utf8");
    socket.write("220 fake ESMTP\r\n");
    let buffer = "";
    let inData = false;
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      for (;;) {
        if (inData) {
          const end = buffer.indexOf("\r\n.\r\n");
          if (end === -1) return;
          data = buffer.slice(0, end);
          buffer = buffer.slice(end + 5);
          inData = false;
          socket.write("250 entregado\r\n");
          continue;
        }
        const index = buffer.indexOf("\r\n");
        if (index === -1) return;
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        commands.push(line);
        const verb = line.slice(0, 4).toUpperCase();
        if (verb === "EHLO") {
          socket.write("250-fake\r\n250-AUTH PLAIN LOGIN\r\n250 OK\r\n");
        } else if (verb === "HELO") {
          socket.write("250 fake\r\n");
        } else if (verb === "DATA") {
          inData = true;
          socket.write("354 adelante\r\n");
        } else if (verb === "RCPT") {
          if (options.rejectRcpt && line.includes(options.rejectRcpt)) {
            socket.write("550 buzon inexistente\r\n");
          } else {
            socket.write("250 ok\r\n");
          }
        } else if (verb === "MAIL") {
          socket.write("250 ok\r\n");
        } else if (verb === "QUIT") {
          socket.write("221 adios\r\n");
          socket.end();
        } else {
          socket.write(`${options.authCode ?? 235} ok\r\n`);
        }
      }
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    port: (server.address() as AddressInfo).port,
    commands,
    data: () => data,
  };
}

function smtpConfig(port: number, over: Record<string, unknown> = {}) {
  return {
    host: "127.0.0.1",
    port,
    tls: "none",
    secure: false,
    user: "taller",
    pass: "secreto-de-prueba",
    from: "",
    helo: "relevo.test",
    rejectUnauthorized: true,
    timeoutMs: 5000,
    ...over,
  };
}

describe("el relevo — la conversación SMTP", () => {
  test("saluda, se autentica y entrega a los destinatarios y a la copia oculta", async () => {
    const fake = await fakeSmtp();
    await sendSmtp(smtpConfig(fake.port), envelope);

    const text = fake.commands.join("\n");
    expect(text).toContain("EHLO relevo.test");
    expect(text).toContain("MAIL FROM:<avisos@taller.es>");
    expect(text).toContain("RCPT TO:<sandra.ruiz@taller.es>");
    expect(text).toContain("RCPT TO:<archivo@taller.es>");
    expect(text).toContain("DATA");
    expect(text).toContain("QUIT");

    // La contraseña viaja en el AUTH, no en un registro ni en un error.
    const auth = fake.commands.find((line) => line.startsWith("AUTH PLAIN "));
    expect(auth).toBeTruthy();
    const decoded = Buffer.from(
      auth!.replace("AUTH PLAIN ", ""),
      "base64",
    ).toString("utf8");
    expect(decoded).toBe("\0taller\0secreto-de-prueba");

    // Y el mensaje que llegó es el compuesto, sin la cabecera de la copia oculta.
    expect(fake.data()).toContain('From: "Pulso Taller" <avisos@taller.es>');
    expect(fake.data()).not.toContain("Bcc:");
  });

  test("si el servidor rechaza un buzón, el motivo vuelve con su código", async () => {
    const fake = await fakeSmtp({ rejectRcpt: "archivo@taller.es" });
    const error = await sendSmtp(smtpConfig(fake.port), envelope).then(
      () => null,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(RelaySmtpError);
    expect((error as Error).message).toContain("550");
    expect((error as Error).message).toContain("buzon inexistente");
    // Y la contraseña no se cuela en el motivo.
    expect((error as Error).message).not.toContain("secreto-de-prueba");
  });

  test("sin credenciales no se autentica, pero se entrega", async () => {
    const fake = await fakeSmtp();
    await sendSmtp(smtpConfig(fake.port, { user: "", pass: "" }), envelope);
    expect(fake.commands.some((line) => line.startsWith("AUTH"))).toBe(false);
    expect(fake.commands.join("\n")).toContain("MAIL FROM");
  });

  test("un servidor que no existe se cuenta en el motivo, no como fallo interno", async () => {
    // Un puerto que nadie escucha: se pide uno efímero y se cierra. Es el caso
    // del servidor que viene en el sobre con una errata en el nombre o el puerto.
    const probe = createServer();
    await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
    const port = (probe.address() as AddressInfo).port;
    await new Promise<void>((resolve) => probe.close(() => resolve()));

    const error = await sendSmtp(smtpConfig(port), envelope).then(
      () => null,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(RelaySmtpError);
    // Con el servidor dentro: es lo único que permite saber qué dirección falla.
    expect((error as Error).message).toContain(`127.0.0.1:${port}`);
    // Y sin la contraseña, aunque el motivo venga del sistema.
    expect((error as Error).message).not.toContain("secreto-de-prueba");
  });

  test("la comprobación previa saluda y se autentica, y no manda nada", async () => {
    const fake = await fakeSmtp();
    const result = await verifySmtp(smtpConfig(fake.port));
    expect(result).toEqual({
      host: "127.0.0.1",
      port: fake.port,
      tls: "none",
      auth: "PLAIN",
      greeting: "fake ESMTP",
    });

    const conversation = fake.commands.join("\n");
    // Se saluda, se autentica y se corta…
    expect(conversation).toContain("EHLO relevo.test");
    expect(conversation).toContain("AUTH PLAIN ");
    expect(conversation).toContain("QUIT");
    // …y ahí se queda: ni remitente, ni destinatarios, ni mensaje. Es la
    // diferencia entre comprobar que se puede mandar y mandar.
    expect(conversation).not.toContain("MAIL FROM");
    expect(conversation).not.toContain("RCPT TO");
    expect(conversation).not.toContain("DATA");
    expect(fake.data()).toBe("");
    // Y la contraseña no vuelve en el resultado.
    expect(JSON.stringify(result)).not.toContain("secreto-de-prueba");
  });

  test("sin credenciales la comprobación dice que no hubo autenticación", async () => {
    const fake = await fakeSmtp();
    const result = await verifySmtp(
      smtpConfig(fake.port, { user: "", pass: "" }),
    );
    expect(result.auth).toBeNull();
    expect(fake.commands.some((line) => line.startsWith("AUTH"))).toBe(false);
    // Sigue sin mandar nada, aunque no haya nada que autenticar.
    expect(fake.commands.join("\n")).not.toContain("MAIL FROM");
  });

  test("unas credenciales que el servidor rechaza se cuentan con su código", async () => {
    const fake = await fakeSmtp({ authCode: 535 });
    const error = await verifySmtp(smtpConfig(fake.port)).then(
      () => null,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(RelaySmtpError);
    expect((error as Error).message).toContain("535");
    expect((error as Error).message).not.toContain("secreto-de-prueba");
    // Y un rechazo de credenciales no deja medio mensaje por ahí.
    expect(fake.data()).toBe("");
  });

  test("un servidor que no contesta no deja el relevo colgado", async () => {
    const server = createServer((socket: Socket) => {
      socket.on("error", () => {});
      socket.write("220 mudo\r\n");
    });
    servers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const port = (server.address() as AddressInfo).port;
    const error = await sendSmtp(
      smtpConfig(port, { timeoutMs: 600 }),
      envelope,
    ).then(
      () => null,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(RelaySmtpError);
    expect((error as Error).message).toMatch(/no contestó/);
  });
});

/* ------------------------------------------------------------------ */
/* El HTTP que ve el backend                                           */
/* ------------------------------------------------------------------ */

interface StartedRelay {
  url: string;
  calls: unknown[];
  /** El servidor SMTP de cada entrega: el del sobre, o `null` si no traía. */
  overrides: unknown[];
  /** Lo mismo, para la comprobación previa: con qué servidor se comprobó. */
  checks: unknown[];
}

async function startRelay(
  options: {
    token?: string;
    maxBodyBytes?: number;
    send?: (value: unknown, smtp: unknown) => Promise<unknown>;
    /** `null` monta el relevo sin comprobación, que es lo que contesta 501. */
    verify?: ((smtp: unknown) => Promise<unknown>) | null;
  } = {},
): Promise<StartedRelay> {
  const calls: unknown[] = [];
  const overrides: unknown[] = [];
  const checks: unknown[] = [];
  const verify =
    options.verify === null
      ? undefined
      : (options.verify ??
        (async (smtp: unknown) => {
          checks.push(smtp ?? null);
          return {
            host: "correo.taller.local",
            port: 587,
            tls: "starttls",
            auth: "PLAIN",
            greeting: "correo.taller.local ESMTP",
          };
        }));
  const server = createRelayServer({
    config: {
      path: "/enviar",
      token: options.token ?? "",
      maxBodyBytes: options.maxBodyBytes ?? 64 * 1024,
    },
    send:
      options.send ??
      (async (value: unknown, smtp: unknown) => {
        calls.push(value);
        overrides.push(smtp ?? null);
        return { recipients: [] };
      }),
    verify,
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  return { url: `http://127.0.0.1:${port}/enviar`, calls, overrides, checks };
}

function post(url: string, body: unknown, token?: string) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("el relevo — el servidor HTTP", () => {
  test("un sobre válido con su testigo se entrega y se contesta 200", async () => {
    const relay = await startRelay({ token: "testigo-123" });
    const response = await post(relay.url, envelope, "testigo-123");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
    expect(relay.calls).toHaveLength(1);
    expect((relay.calls[0] as { bcc: string[] }).bcc).toEqual([
      "archivo@taller.es",
    ]);
  });

  test("el servidor SMTP del sobre llega entero a la entrega", async () => {
    const relay = await startRelay({ token: "testigo-123" });
    const mail = { ...envelope, smtp: smtpOverride };
    expect((await post(relay.url, mail, "testigo-123")).status).toBe(200);
    expect(relay.overrides[0]).toEqual({
      host: "smtp.gmail.com",
      port: 465,
      tls: "ssl",
      secure: true,
      user: "taller@gmail.com",
      pass: "abcd efgh ijkl mnop",
    });
    // Y el sobre de siempre sigue sin llevar servidor: usa el del entorno.
    expect((await post(relay.url, envelope, "testigo-123")).status).toBe(200);
    expect(relay.overrides[1]).toBeNull();
  });

  test("un servidor SMTP a medias en el sobre se rechaza con 400", async () => {
    const relay = await startRelay();
    const broken: unknown[] = [
      "smtp.gmail.com",
      { ...smtpOverride, host: "" },
      { ...smtpOverride, port: 0 },
      { ...smtpOverride, tls: "ninguno" },
      { ...smtpOverride, user: "" },
      { ...smtpOverride, pass: "" },
    ];
    for (const smtp of broken) {
      const response = await post(relay.url, { ...envelope, smtp });
      expect(response.status, JSON.stringify(smtp)).toBe(400);
    }
    expect(relay.calls).toHaveLength(0);
  });

  test("de punta a punta: el buzón del sobre recibe el correo", async () => {
    const fake = await fakeSmtp();
    const relay = await startRelay({
      send: (value, smtp) =>
        sendSmtp(
          applySmtpOverride(
            smtpConfig(fake.port, { user: "", pass: "" }),
            smtp,
          ),
          value as typeof envelope,
        ),
    });
    const response = await post(relay.url, {
      ...envelope,
      smtp: {
        host: "127.0.0.1",
        port: fake.port,
        tls: "none",
        user: "usuario@ethereal.email",
        pass: "prueba-123",
      },
    });
    expect(response.status).toBe(200);
    const conversation = fake.commands.join("\n");
    // La cuenta del sobre autentica y firma: es a la que Ethereal da permiso.
    expect(conversation).toContain("MAIL FROM:<usuario@ethereal.email>");
    const auth = fake.commands.find((line) => line.startsWith("AUTH PLAIN "));
    expect(
      Buffer.from(auth!.replace("AUTH PLAIN ", ""), "base64").toString("utf8"),
    ).toBe("\0usuario@ethereal.email\0prueba-123");
    expect(fake.data()).toContain("multipart/alternative");
  });

  test("la comprobación previa se pide al relevo y no manda ningún correo", async () => {
    const relay = await startRelay({ token: "testigo-123" });
    const url = relay.url.replace("/enviar", "/comprobar");

    const response = await post(url, {}, "testigo-123");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      check: { host: "correo.taller.local", port: 587 },
    });
    // No es un envío: no hay sobre que entregar, ni se toca el camino del correo.
    expect(relay.calls).toHaveLength(0);
    // Sin servidor en el cuerpo se comprueba el del entorno del relevo.
    expect(relay.checks[0]).toBeNull();

    // Y admite el servidor del sobre, como los envíos: se comprueba el mismo que
    // se va a usar, no otro.
    expect(
      (await post(url, { smtp: smtpOverride }, "testigo-123")).status,
    ).toBe(200);
    expect(relay.checks[1]).toMatchObject({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      user: "taller@gmail.com",
    });
  });

  test("la comprobación también vive detrás del camino del relevo", async () => {
    const relay = await startRelay();
    const response = await post(`${relay.url}/comprobar`, {});
    expect(response.status).toBe(200);
  });

  test("sin testigo, con un servidor a medias o si el SMTP falla, la comprobación lo dice", async () => {
    const relay = await startRelay({ token: "testigo-123" });
    const url = relay.url.replace("/enviar", "/comprobar");
    // Sin testigo no se comprueba nada: la puerta es la misma que la del correo.
    expect((await post(url, {})).status).toBe(401);
    // Un servidor a medias en el sobre es un 400, como en un envío.
    expect(
      (await post(url, { smtp: { ...smtpOverride, pass: "" } }, "testigo-123"))
        .status,
    ).toBe(400);
    // Y si el servidor de correo no contesta, el motivo viaja en un 502.
    const failing = await startRelay({
      verify: async () => {
        throw new RelaySmtpError(
          "No se pudo conectar con 127.0.0.1:2599: connect ECONNREFUSED",
        );
      },
    });
    const failed = await post(failing.url.replace("/enviar", "/comprobar"), {});
    expect(failed.status).toBe(502);
    await expect(failed.json()).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining("ECONNREFUSED"),
    });
    // Comprobar no es leer: con GET no se comprueba nada.
    expect((await fetch(url)).status).toBe(405);
  });

  test("un relevo sin la comprobación montada lo dice, no finge haber comprobado", async () => {
    const relay = await startRelay({ verify: null });
    const response = await post(relay.url.replace("/enviar", "/comprobar"), {});
    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });

  test("de punta a punta: la comprobación habla con el servidor del sobre y no entrega nada", async () => {
    const fake = await fakeSmtp();
    const relay = await startRelay({
      send: (value, smtp) =>
        sendSmtp(
          applySmtpOverride(
            smtpConfig(fake.port, { user: "", pass: "" }),
            smtp,
          ),
          value as typeof envelope,
        ),
      verify: (smtp) =>
        verifySmtp(
          applySmtpOverride(
            smtpConfig(fake.port, { user: "", pass: "" }),
            smtp,
          ),
        ),
    });
    const response = await post(relay.url.replace("/enviar", "/comprobar"), {
      smtp: {
        host: "127.0.0.1",
        port: fake.port,
        tls: "none",
        user: "taller@gmail.com",
        pass: "abcd efgh ijkl mnop",
      },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      check: { host: "127.0.0.1", port: fake.port, tls: "none", auth: "PLAIN" },
    });
    // El servidor de mentira lo vio autenticarse… y nada más: no llegó mensaje.
    const conversation = fake.commands.join("\n");
    expect(conversation).toContain("AUTH PLAIN ");
    expect(conversation).not.toContain("RCPT TO");
    expect(conversation).not.toContain("DATA");
    expect(fake.data()).toBe("");
    expect(relay.calls).toHaveLength(0);
  });

  test("sin testigo o con otro no se manda nada", async () => {
    const relay = await startRelay({ token: "testigo-123" });
    expect((await post(relay.url, envelope)).status).toBe(401);
    expect((await post(relay.url, envelope, "otro")).status).toBe(401);
    expect(relay.calls).toHaveLength(0);
  });

  test("sin testigo configurado se acepta, que es el modo de red cerrada", async () => {
    const relay = await startRelay();
    expect((await post(relay.url, envelope)).status).toBe(200);
  });

  test("un cuerpo que no es JSON o un sobre incompleto se rechazan", async () => {
    const relay = await startRelay();
    const broken = await post(relay.url, "{no es json");
    expect(broken.status).toBe(400);
    await expect(broken.json()).resolves.toMatchObject({
      ok: false,
    });
    expect((await post(relay.url, { ...envelope, to: [] })).status).toBe(400);
    expect(relay.calls).toHaveLength(0);
  });

  test("un sobre gigante se corta con 413", async () => {
    const relay = await startRelay({ maxBodyBytes: 4096 });
    const response = await post(relay.url, {
      ...envelope,
      text: "x".repeat(6000),
    });
    expect(response.status).toBe(413);
  });

  test("si el SMTP falla, el motivo viaja con un 502", async () => {
    const relay = await startRelay({
      send: async () => {
        throw new RelaySmtpError("SMTP 550 en RCPT TO: buzón inexistente");
      },
    });
    const response = await post(relay.url, envelope);
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining("550"),
    });
  });

  test("la ruta equivocada y el método equivocado no entregan", async () => {
    const relay = await startRelay();
    expect((await fetch(relay.url.replace("/enviar", "/otra"))).status).toBe(
      404,
    );
    expect((await fetch(relay.url)).status).toBe(405);
    expect(relay.calls).toHaveLength(0);
    const health = await fetch(relay.url.replace("/enviar", "/salud"));
    expect(health.status).toBe(200);
  });

  test("de punta a punta: del HTTP al buzón del servidor SMTP", async () => {
    const fake = await fakeSmtp();
    const relay = await startRelay({
      token: "testigo-123",
      send: (value) =>
        sendSmtp(smtpConfig(fake.port), value as typeof envelope),
    });
    const response = await post(relay.url, envelope, "testigo-123");
    expect(response.status).toBe(200);
    expect(fake.data()).toContain("multipart/alternative");
    expect(fake.commands.join("\n")).toContain("RCPT TO:<archivo@taller.es>");
  });
});
