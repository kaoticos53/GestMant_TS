/**
 * El relevo de correo del taller: recibe el sobre por HTTP y lo entrega por SMTP.
 *
 * El backend de Convex no abre conexiones TCP, así que no puede hablar SMTP. La
 * opción «Relevo propio» de los ajustes apunta a un puente HTTP que sí puede: este.
 * Recibe el mismo sobre que compone `src/lib/mail.ts` —de, para, copia oculta,
 * asunto, texto y HTML— y lo entrega al servidor de correo del taller. El sobre
 * puede traer además su propio servidor SMTP (`smtp`), que es como el taller usa
 * su cuenta de Gmail o un buzón de pruebas de Ethereal sin reconfigurar el
 * puente: si lo trae, se entrega por ahí; si no, por el del entorno.
 *
 * Aquí no hay ninguna librería de correo: son `node:http`, `node:net`,
 * `node:tls` y el protocolo SMTP a mano. Es a propósito. Un relevo pequeño que se
 * instala en una red de taller no debería arrastrar un árbol de dependencias para
 * hablar un protocolo de 1982, y todo lo que hay aquí se puede probar contra un
 * servidor de mentira.
 *
 * Las tres reglas que no son de estilo:
 *
 * - **El testigo es opcional y se comprueba siempre que esté.** El servicio se
 *   instala en la red del taller; si está expuesto, sin testigo lo puede usar
 *   cualquiera que lo alcance, y por eso el arranque avisa cuando no lo hay.
 * - **Nada de reenviar a ciegas.** Cada dirección se comprueba y ningún campo
 *   puede llevar saltos de línea: una cabecera con `\r\n` deja de ser un asunto y
 *   pasa a ser otra cabecera.
 * - **La copia oculta es oculta.** Los destinatarios de `bcc` reciben el correo
 *   (RCPT TO) y **no** aparecen en ninguna cabecera.
 *
 * Lo que no hace: no reintenta envíos, no guarda cola y no firma DKIM. Si el
 * servidor SMTP dice que no, el motivo vuelve al backend, que lo apunta en el
 * histórico del correo. La cola y la firma son cosas del servidor de correo del
 * taller, no de un puente.
 */

import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { connect as netConnect } from "node:net";
import { connect as tlsConnect } from "node:tls";

/** Puerto por defecto del puente. No es el de ningún servicio ya usado. */
export const DEFAULT_RELAY_PORT = 8788;

/** La ruta del sobre, la que se pega en los ajustes del taller. */
export const DEFAULT_RELAY_PATH = "/enviar";

/** Un correo del taller no llega a un mega; más que eso es un error o un abuso. */
export const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;

/** Más destinatarios que esto en un aviso del taller es una lista, no un aviso. */
export const MAX_RECIPIENTS = 50;

/** El asunto se recorta en el correo, así que tampoco se admiten novelas. */
export const MAX_SUBJECT = 300;

/** Un secreto SMTP, en caracteres: una contraseña de aplicación y poco más. */
export const MAX_SMTP_SECRET = 500;

/** Cada cuerpo (texto o HTML), en bytes. */
export const MAX_BODY_PART = 512 * 1024;

/** Los modos de cifrado que entiende `SMTP_TLS`. */
export const TLS_MODES = ["auto", "starttls", "ssl", "none"];

/** Falta algo en la configuración: se dice qué y no se arranca. */
export class RelayConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "RelayConfigError";
  }
}

/** El sobre que llegó no vale. Lleva su código HTTP: 400 o 413. */
export class RelayRequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "RelayRequestError";
    this.status = status;
  }
}

/** El servidor SMTP no quiso el correo. El motivo es para quien mire el histórico. */
export class RelaySmtpError extends Error {
  constructor(message) {
    super(message);
    this.name = "RelaySmtpError";
  }
}

/** Un texto en una línea y con un tope, para un registro o un error. */
function short(value, max = 200) {
  const clean = String(value).replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

/** Un número entero de una variable de entorno, o el valor de partida. */
function readNumber(value, fallback, name, { min = 1, max = 65535 } = {}) {
  const raw = (value ?? "").trim();
  if (raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new RelayConfigError(
      `${name} tiene que ser un número entero entre ${min} y ${max}.`,
    );
  }
  return parsed;
}

/** Un booleano de una variable de entorno: `true`/`false`, `1`/`0`, `si`/`no`. */
function readBoolean(value, fallback, name) {
  const raw = (value ?? "").trim().toLowerCase();
  if (raw === "") return fallback;
  if (["true", "1", "si", "sí", "yes", "on"].includes(raw)) return true;
  if (["false", "0", "no", "off"].includes(raw)) return false;
  throw new RelayConfigError(
    `${name} tiene que ser true o false, y dice «${short(value, 20)}».`,
  );
}

/** La misma forma de correo que comprueba la app (`looksLikeEmail`). */
export function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Un texto de cabecera: sin saltos de línea y con tope. */
function headerValue(value, what, max) {
  const text = String(value ?? "").trim();
  if (text === "") return "";
  if (/[\r\n]/.test(text)) {
    throw new RelayRequestError(
      `El campo «${what}» no puede llevar saltos de línea.`,
    );
  }
  if (text.length > max) {
    throw new RelayRequestError(`El campo «${what}» es demasiado largo.`);
  }
  return text;
}

/** Una dirección de una cabecera: normalizada, con forma de correo y de una línea. */
function addressValue(value, what) {
  const email = headerValue(value, what, 200).toLowerCase();
  if (!looksLikeEmail(email)) {
    throw new RelayRequestError(
      `El campo «${what}» no parece una dirección de correo.`,
    );
  }
  return email;
}

/** Una lista de direcciones: sin repetidos ni vacías, y con tope. */
function addressList(value, what, { required }) {
  if (value === undefined || value === null) {
    if (required)
      throw new RelayRequestError(
        `Falta «${what}»: el correo no tiene destinatarios.`,
      );
    return [];
  }
  if (!Array.isArray(value)) {
    throw new RelayRequestError(
      `El campo «${what}» tiene que ser una lista de direcciones.`,
    );
  }
  const seen = new Set();
  const out = [];
  for (const item of value) {
    if (typeof item !== "string") {
      throw new RelayRequestError(
        `El campo «${what}» tiene una dirección que no es texto.`,
      );
    }
    const email = addressValue(item, what);
    if (seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  if (required && out.length === 0) {
    throw new RelayRequestError(
      `Falta «${what}»: el correo no tiene destinatarios.`,
    );
  }
  if (out.length > MAX_RECIPIENTS) {
    throw new RelayRequestError(
      `El correo tiene demasiados destinatarios: ${out.length} de ${MAX_RECIPIENTS} como mucho.`,
    );
  }
  return out;
}

/** Lo que un cuerpo de correo puede pesar, en bytes y no en caracteres. */
function bodyPart(value, what) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    throw new RelayRequestError(`El campo «${what}» tiene que ser texto.`);
  }
  if (Buffer.byteLength(value, "utf8") > MAX_BODY_PART) {
    throw new RelayRequestError(
      `El campo «${what}» pasa de ${Math.round(MAX_BODY_PART / 1024)} KB.`,
      413,
    );
  }
  return value;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Un HTML sin etiquetas, para cuando solo llega el HTML y hay que rellenar el texto. */
function htmlToText(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Lee y comprueba el sobre que manda el backend.
 *
 * Devuelve las direcciones ya normalizadas y los dos cuerpos rellenos: si solo
 * llega el texto se compone el HTML, y al revés. Un correo del taller siempre se
 * entrega con las dos versiones, porque no se sabe qué cliente lo va a abrir.
 */
export function parseEnvelope(payload) {
  if (
    payload === null ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw new RelayRequestError(
      "El cuerpo del sobre tiene que ser un objeto JSON.",
    );
  }
  const from = payload.from;
  if (from === null || from === undefined || typeof from !== "object") {
    throw new RelayRequestError("Falta «from»: el correo no tiene remitente.");
  }
  const fromEmail = addressValue(from.email, "from.email");
  const fromName = headerValue(from.name, "from.name", 120);

  const to = addressList(payload.to, "to", { required: true });
  const bccRaw = addressList(payload.bcc, "bcc", { required: false });
  // Quien ya está en «para» no se repite en la copia oculta: recibiría el correo
  // dos veces y el servidor de correo lo vería como un error del puente.
  const bcc = bccRaw.filter((email) => !to.includes(email));

  const subject = headerValue(payload.subject, "subject", MAX_SUBJECT);
  if (subject === "") {
    throw new RelayRequestError("Falta el asunto del correo.");
  }
  const replyToRaw = headerValue(payload.replyTo, "replyTo", 200);
  const replyTo = replyToRaw === "" ? "" : addressValue(replyToRaw, "replyTo");

  const text = bodyPart(payload.text, "text");
  const html = bodyPart(payload.html, "html");
  if (text.trim() === "" && html.trim() === "") {
    throw new RelayRequestError("El correo no tiene cuerpo: ni texto ni HTML.");
  }
  const filledText = text.trim() === "" ? htmlToText(html) : text;
  const filledHtml =
    html.trim() === ""
      ? `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(text)}</pre>`
      : html;

  return {
    from: { email: fromEmail, name: fromName },
    to,
    bcc,
    subject,
    text: filledText,
    html: filledHtml,
    replyTo,
  };
}

/**
 * El servidor SMTP que puede traer el propio sobre, o `null` si no trae ninguno.
 *
 * Es lo que permite que un taller mande desde su cuenta de Gmail o desde un
 * buzón de pruebas de Ethereal sin tocar la configuración del relevo: el backend
 * no habla SMTP, así que el destino y las credenciales viajan en el sobre y el
 * puente los usa para esa entrega. Sin servidor en el sobre vale el del entorno,
 * que es el caso del relevo de siempre.
 *
 * Se comprueba como todo lo que llega de fuera: el nombre del servidor no puede
 * ser cualquier texto, el puerto tiene que ser un puerto, el cifrado uno de los
 * modos conocidos, y las credenciales van juntas o no van.
 */
export function parseSmtpOverride(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new RelayRequestError(
      "El campo «smtp» tiene que ser un objeto con host, puerto, cifrado y credenciales.",
    );
  }
  const host = String(value.host ?? "")
    .trim()
    .toLowerCase();
  if (
    host === "" ||
    host.length > 200 ||
    !/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(host)
  ) {
    throw new RelayRequestError(
      "El servidor SMTP del sobre no parece un nombre de servidor.",
    );
  }
  const rawPort = String(value.port ?? "").trim();
  const port = Number(rawPort);
  if (rawPort === "" || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RelayRequestError(
      "El puerto del servidor SMTP del sobre no es un puerto.",
    );
  }
  const tls = String(value.tls ?? "")
    .trim()
    .toLowerCase();
  if (!TLS_MODES.includes(tls)) {
    throw new RelayRequestError(
      `El cifrado del servidor SMTP del sobre tiene que ser uno de: ${TLS_MODES.join(", ")}.`,
    );
  }
  const user = headerValue(value.user, "smtp.user", 200);
  const pass = String(value.pass ?? "");
  if (user === "" || pass === "") {
    throw new RelayRequestError(
      "El sobre trae un servidor SMTP pero le faltan el usuario o la contraseña.",
    );
  }
  if (/[\r\n]/.test(pass) || pass.length > MAX_SMTP_SECRET) {
    throw new RelayRequestError(
      "La contraseña del servidor SMTP del sobre no es válida.",
    );
  }
  return { host, port, tls, secure: tls === "ssl", user, pass };
}

/**
 * La configuración con la que se entrega: la del entorno, con lo que traiga el
 * sobre por encima.
 *
 * Cuando el sobre trae credenciales, el remitente SMTP es esa misma cuenta —es
 * a quien Google y Ethereal dan permiso para mandar—, salvo que el taller haya
 * fijado un `SMTP_FROM` a propósito. Lo demás —el saludo, los tiempos, la
 * validación del certificado— sigue siendo del relevo: no se deja elegir desde
 * fuera lo que ya está decidido en su configuración.
 */
export function applySmtpOverride(base, override) {
  if (override === null) return base;
  return {
    ...base,
    ...override,
    secure: override.tls === "ssl",
    from: base.from || override.user,
  };
}

/**
 * Lo que el relevo pone de su parte cuando no tiene servidor propio: un saludo,
 * un plazo y una validación de certificado razonables. El servidor y sus
 * credenciales llegan en el sobre y los pone el servicio que lo manda.
 */
const SMTP_DEFAULTS = {
  host: "",
  port: 587,
  tls: "auto",
  secure: false,
  user: "",
  pass: "",
  from: "",
  helo: "pulso-taller.local",
  rejectUnauthorized: true,
  timeoutMs: 20000,
};

/**
 * El servidor con el que se entrega de verdad: el del sobre si lo trae, el del
 * entorno si no.
 *
 * Un relevo arrancado sin `SMTP_HOST` —el caso de un taller que solo prueba con
 * Gmail o con el buzón de Ethereal— no puede entregar un sobre que tampoco traiga
 * servidor. Eso se dice con un 400 y una frase que explica qué falta, en vez de
 * intentar conectar con un servidor vacío y devolver un error de red opaco.
 */
export function resolveSmtp(base, override) {
  if (base === null && override === null) {
    throw new RelayRequestError(
      "Este relevo no tiene servidor SMTP propio y el sobre no trae el suyo: define SMTP_HOST en el relevo o elige en los ajustes un servicio que mande su servidor.",
    );
  }
  return applySmtpOverride(base ?? SMTP_DEFAULTS, override);
}

/** ¿Hay que codificar esta cabecera? Solo si lleva algo que no es ASCII imprimible. */
function needsEncoding(value) {
  return /[^\x20-\x7E]/.test(value) || value.includes("=?");
}

/** Una palabra codificada de RFC 2047: es como se manda un asunto con acentos. */
function encodeWord(value) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function headerText(value) {
  return needsEncoding(value) ? encodeWord(value) : value;
}

/** «Nombre <correo>», con el nombre entre comillas o codificado si hace falta. */
export function formatAddress({ email, name }) {
  const clean = (name ?? "").trim();
  if (clean === "") return `<${email}>`;
  if (needsEncoding(clean)) return `${encodeWord(clean)} <${email}>`;
  const quoted = `"${clean.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  return `${quoted} <${email}>`;
}

/** La fecha de una cabecera, en la forma que pide RFC 5322. */
export function mailDate(date) {
  return date.toUTCString().replace("GMT", "+0000");
}

/** Base64 en líneas de 76, como manda MIME. */
function base64Lines(value) {
  return (
    Buffer.from(value, "utf8")
      .toString("base64")
      .match(/.{1,76}/g) ?? []
  ).join("\r\n");
}

/** Un punto al principio de una línea se duplica en DATA (SMTP lo deshace). */
export function dotStuff(message) {
  return message.replace(/(^|\r\n)\./g, "$1..");
}

/**
 * Compone el mensaje MIME: multipart/alternative con el texto y el HTML.
 *
 * La copia oculta no aparece en ninguna cabecera —es lo que la hace oculta—, y
 * los cuerpos van en base64 para que acentos y saltos de línea lleguen intactos
 * pase lo que pase por el camino.
 */
export function composeMessage(envelope, options = {}) {
  const date = options.date ?? new Date();
  const domain = envelope.from.email.split("@")[1] ?? "localhost";
  const messageId = options.messageId ?? `<${randomUUID()}@${domain}>`;
  const boundary = `=_pulso_${randomBytes(12).toString("hex")}`;
  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(envelope.text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(envelope.html),
    `--${boundary}--`,
    "",
  ].join("\r\n");

  const headers = [
    `From: ${formatAddress(envelope.from)}`,
    `To: ${envelope.to.map((email) => `<${email}>`).join(", ")}`,
    ...(envelope.replyTo ? [`Reply-To: <${envelope.replyTo}>`] : []),
    `Subject: ${headerText(envelope.subject)}`,
    `Date: ${mailDate(date)}`,
    `Message-ID: ${messageId}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}

/* ------------------------------------------------------------------ */
/* SMTP                                                                */
/* ------------------------------------------------------------------ */

/**
 * El motivo de un fallo de red, en una línea y sin la contraseña dentro.
 *
 * Un servidor que no existe, un puerto cerrado o un certificado que no valida
 * son errores del sistema, no del protocolo: sin envolverlos, el relevo solo
 * podría decir «falló por dentro» y quien mira el histórico no sabría si el
 * problema es su red mixta o la dirección que escribió. Y desde que un sobre
 * puede traer su servidor, ese caso es el más probable de todos.
 */
function networkError(error, config, what) {
  if (error instanceof RelaySmtpError) return error;
  const detail = error instanceof Error ? error.message : String(error);
  return new RelaySmtpError(
    `No se pudo ${what} ${config.host}:${config.port}: ${short(detail, 160)}`,
  );
}

/** Abre el socket del servidor de correo, cifrado de entrada o en claro. */
function connectSocket(config) {
  return new Promise((resolve, reject) => {
    const host = config.host;
    const port = config.port;
    const socket =
      config.tls === "ssl"
        ? tlsConnect({
            host,
            port,
            servername: host,
            rejectUnauthorized: config.rejectUnauthorized,
          })
        : netConnect({ host, port });
    const ready = config.tls === "ssl" ? "secureConnect" : "connect";
    socket.once(ready, () => resolve(socket));
    socket.once("error", (error) =>
      reject(networkError(error, config, "conectar con")),
    );
  });
}

/** Asciende una conexión en claro a TLS con STARTTLS. */
function upgradeSocket(socket, config) {
  return new Promise((resolve, reject) => {
    const secure = tlsConnect({
      socket,
      servername: config.host,
      rejectUnauthorized: config.rejectUnauthorized,
    });
    secure.once("secureConnect", () => resolve(secure));
    secure.once("error", (error) =>
      reject(networkError(error, config, "cifrar la conexión con")),
    );
  });
}

/**
 * La conversación SMTP, línea a línea.
 *
 * Junta lo que llega en respuestas completas —`250-...` seguidas de `250 ...`— y
 * las entrega de una en una. Un temporizador cubre la conversación entera: un
 * servidor que se queda callado no puede dejar el relevo colgado.
 */
function createSession(socket, config) {
  const timeoutMs = config.timeoutMs;
  let buffer = "";
  const waiters = [];
  let failure = null;

  const next = () => {
    const lines = buffer.split("\r\n");
    let end = -1;
    for (let index = 0; index < lines.length - 1; index += 1) {
      if (/^\d{3} /.test(lines[index])) {
        end = index;
        break;
      }
    }
    if (end === -1) return null;
    const block = lines.slice(0, end + 1);
    buffer = lines.slice(end + 1).join("\r\n");
    return {
      code: Number(block[end].slice(0, 3)),
      text: block.map((line) => line.slice(4)).join("\n"),
    };
  };

  const settle = () => {
    while (waiters.length > 0) {
      if (failure !== null) {
        waiters.shift().reject(failure);
        continue;
      }
      const response = next();
      if (response === null) return;
      waiters.shift().resolve(response);
    }
  };

  const onData = (chunk) => {
    buffer += chunk;
    settle();
  };
  const onError = (error) => {
    failure ??= networkError(error, config, "hablar con");
    settle();
  };
  const onClose = () => {
    failure ??= new RelaySmtpError(
      "La conexión SMTP se cerró antes de tiempo.",
    );
    settle();
  };

  socket.setEncoding("utf8");
  socket.on("data", onData);
  socket.on("error", onError);
  socket.on("close", onClose);

  const timer = setTimeout(() => {
    failure ??= new RelaySmtpError(
      `El servidor SMTP no contestó en ${Math.round(timeoutMs / 1000)} s.`,
    );
    socket.destroy();
    settle();
  }, timeoutMs);
  timer.unref?.();

  return {
    /** Quita los oídos del socket sin cerrarlo (al ascender a TLS). */
    detach() {
      clearTimeout(timer);
      socket.removeListener("data", onData);
      socket.removeListener("error", onError);
      socket.removeListener("close", onClose);
    },
    read() {
      return new Promise((resolve, reject) => {
        waiters.push({ resolve, reject });
        settle();
      });
    },
    write(text) {
      socket.write(text);
    },
    close() {
      clearTimeout(timer);
      socket.destroy();
    },
  };
}

/** Escribe una orden y espera su respuesta, con el motivo si no es la esperada. */
async function command(session, line, expected, label) {
  session.write(`${line}\r\n`);
  const response = await session.read();
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(response.code)) {
    throw new RelaySmtpError(
      `SMTP ${response.code} en ${label}: ${short(response.text, 160)}`,
    );
  }
  return response;
}

/**
 * Deja la conversación lista para entregar: conecta, saluda, cifra si toca y se
 * autentica. Devuelve la sesión abierta y lo que se ha negociado.
 *
 * Está aparte porque hay dos caminos que empiezan igual —mandar el correo y
 * comprobar que se puede mandar— y la comprobación no debe ser una copia del
 * saludo y la autenticación: un cambio en el cifrado o en el AUTH tiene que valer
 * para los dos, y lo que se comprueba tiene que ser exactamente lo que se usa al
 * mandar.
 */
async function openSmtpSession(config) {
  let socket = await connectSocket(config);
  let session = createSession(socket, config);
  const close = () => {
    session?.close();
    if (socket !== null && !socket.destroyed) socket.destroy();
  };

  try {
    const greeting = await session.read();
    if (greeting.code !== 220) {
      throw new RelaySmtpError(
        `SMTP ${greeting.code} al conectar: ${short(greeting.text, 160)}`,
      );
    }

    let capabilities = "";
    session.write(`EHLO ${config.helo}\r\n`);
    let hello = await session.read();
    if (hello.code !== 250) {
      // Servidores antiguos: sin extensiones, pero se puede entregar igual.
      session.write(`HELO ${config.helo}\r\n`);
      hello = await session.read();
      if (hello.code !== 250) {
        throw new RelaySmtpError(
          `SMTP ${hello.code} al saludar: ${short(hello.text, 160)}`,
        );
      }
    } else {
      capabilities = hello.text;
    }

    let secure = config.secure;
    if (!config.secure && config.tls !== "none") {
      if (/STARTTLS/i.test(capabilities)) {
        await command(session, "STARTTLS", 220, "STARTTLS");
        // El socket en claro deja de interesar: el cifrado toma el relevo.
        session.detach();
        socket = await upgradeSocket(socket, config);
        session = createSession(socket, config);
        session.write(`EHLO ${config.helo}\r\n`);
        hello = await session.read();
        if (hello.code !== 250) {
          throw new RelaySmtpError(
            `SMTP ${hello.code} al saludar tras STARTTLS: ${short(hello.text, 160)}`,
          );
        }
        capabilities = hello.text;
        secure = true;
      } else if (config.tls === "starttls") {
        throw new RelaySmtpError(
          "El servidor SMTP no ofrece STARTTLS y SMTP_TLS=starttls: no se manda el correo sin cifrar.",
        );
      }
    }

    let auth = null;
    if (config.user) {
      const offersPlain = /AUTH[^\n]*PLAIN/i.test(capabilities);
      const offersLogin = /AUTH[^\n]*LOGIN/i.test(capabilities);
      if (offersPlain || !offersLogin) {
        const token = Buffer.from(
          `\0${config.user}\0${config.pass}`,
          "utf8",
        ).toString("base64");
        await command(session, `AUTH PLAIN ${token}`, 235, "AUTH PLAIN");
        auth = "PLAIN";
      } else {
        await command(session, "AUTH LOGIN", 334, "AUTH LOGIN");
        await command(
          session,
          Buffer.from(config.user, "utf8").toString("base64"),
          334,
          "AUTH LOGIN (usuario)",
        );
        await command(
          session,
          Buffer.from(config.pass, "utf8").toString("base64"),
          235,
          "AUTH LOGIN (clave)",
        );
        auth = "LOGIN";
      }
    }

    return {
      session,
      greeting,
      capabilities,
      auth,
      /** Cómo quedó la conexión al terminar de negociar. */
      tls: secure ? (config.tls === "ssl" ? "ssl" : "starttls") : "none",
      close,
    };
  } catch (error) {
    close();
    throw error;
  }
}

/**
 * Comprueba que se puede mandar correo, **sin mandar ninguno**: conecta, saluda,
 * cifra si toca y se autentica con las mismas credenciales que usaría la entrega.
 *
 * Es la comprobación previa del relevo: sirve para saber si la contraseña de
 * aplicación de Gmail es la buena, si el puerto está abierto o si el certificado
 * valida, antes de que haya una incidencia esperando su aviso. No manda `MAIL
 * FROM`, ni `RCPT TO`, ni `DATA`: no sale correo, no se toca ninguna cuota y
 * ningún buzón recibe nada. Después corta con `QUIT`.
 *
 * Lo que devuelve es lo que se ha negociado —servidor, puerto, cifrado y qué
 * método de autenticación aceptó—, sin credenciales y sin el contenido de ningún
 * mensaje.
 */
export async function verifySmtp(config) {
  let opened = null;
  try {
    opened = await openSmtpSession(config);
    opened.session.write("QUIT\r\n");
    await opened.session.read().catch(() => {});
    return {
      host: config.host,
      port: config.port,
      tls: opened.tls,
      auth: opened.auth,
      greeting: short(opened.greeting.text, 120),
    };
  } finally {
    opened?.close();
  }
}

/**
 * Entrega el sobre por SMTP: conexión, saludo, cifrado si toca, autenticación,
 * remitente, destinatarios (la copia oculta incluida) y el mensaje.
 *
 * El testigo y la contraseña no se escriben nunca en un error, y el motivo de un
 * fallo se devuelve tal cual lo dijo el servidor: es lo que acaba en el histórico
 * del correo del taller, que es donde se mira por qué no salió.
 */
export async function sendSmtp(config, envelope, options = {}) {
  const message = options.message ?? composeMessage(envelope, options);
  const recipients = [...envelope.to, ...envelope.bcc];
  if (recipients.length === 0) {
    throw new RelayRequestError("El correo no tiene destinatarios.");
  }
  const sender = (config.from || envelope.from.email).toLowerCase();

  let opened = null;
  try {
    opened = await openSmtpSession(config);
    const { session } = opened;

    await command(session, `MAIL FROM:<${sender}>`, 250, "MAIL FROM");
    for (const email of recipients) {
      await command(session, `RCPT TO:<${email}>`, [250, 251], "RCPT TO");
    }
    await command(session, "DATA", 354, "DATA");
    session.write(`${dotStuff(message)}\r\n.\r\n`);
    const accepted = await session.read();
    if (accepted.code !== 250) {
      throw new RelaySmtpError(
        `SMTP ${accepted.code} al entregar el mensaje: ${short(accepted.text, 160)}`,
      );
    }
    session.write("QUIT\r\n");
    await session.read().catch(() => {});
    return { recipients };
  } finally {
    opened?.close();
  }
}

/* ------------------------------------------------------------------ */
/* Configuración                                                       */
/* ------------------------------------------------------------------ */

/**
 * Lee la configuración del entorno.
 *
 * Falla al arrancar, y no en el primer correo, cuando falta lo imprescindible:
 * un relevo que arranca y descubre que no sabe a qué servidor entregar solo
 * consigue que el aviso se pierda con un motivo peor.
 */
export function readRelayConfig(env = process.env) {
  const port = readNumber(
    env.MAIL_RELAY_PORT,
    DEFAULT_RELAY_PORT,
    "MAIL_RELAY_PORT",
    {
      min: 1,
      max: 65535,
    },
  );
  const host = (env.MAIL_RELAY_HOST ?? "0.0.0.0").trim() || "0.0.0.0";
  const token = (env.MAIL_RELAY_TOKEN ?? "").trim();
  const rawPath =
    (env.MAIL_RELAY_PATH ?? DEFAULT_RELAY_PATH).trim() || DEFAULT_RELAY_PATH;
  const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const maxBodyBytes = readNumber(
    env.MAIL_RELAY_MAX_BODY_BYTES,
    DEFAULT_MAX_BODY_BYTES,
    "MAIL_RELAY_MAX_BODY_BYTES",
    { min: 1024, max: 20 * 1024 * 1024 },
  );

  const smtpHost = (env.SMTP_HOST ?? "").trim();
  if (smtpHost === "") {
    // Sin servidor de siempre también se puede arrancar: Gmail y los buzones de
    // pruebas mandan el suyo, con sus credenciales, dentro de cada sobre. Lo que
    // no vale es dejar credenciales sueltas sin servidor al que entregar: se
    // ignorarían en silencio y el fallo se buscaría en el sitio equivocado.
    const stray = ["SMTP_USER", "SMTP_PASS", "SMTP_FROM"].filter(
      (name) => (env[name] ?? "").trim() !== "",
    );
    if (stray.length > 0) {
      throw new RelayConfigError(
        `Falta SMTP_HOST: hay ${stray.join(", ")} pero el relevo no sabe a qué servidor de correo entregar.`,
      );
    }
  }

  return {
    port,
    host,
    path,
    token,
    maxBodyBytes,
    smtp: smtpHost === "" ? null : readDefaultSmtp(env, smtpHost),
  };
}

/**
 * El servidor de correo del relevo, tal como se configura en el entorno. Es el de
 * siempre: se usa cuando el sobre no trae el suyo, y sus tiempos, su saludo y su
 * validación de certificado también acompañan a los servidores que sí trae.
 */
function readDefaultSmtp(env, smtpHost) {
  const smtpPort = readNumber(env.SMTP_PORT, 587, "SMTP_PORT", {
    min: 1,
    max: 65535,
  });
  const rawTls = (env.SMTP_TLS ?? "").trim().toLowerCase();
  const tls = rawTls === "" ? (smtpPort === 465 ? "ssl" : "auto") : rawTls;
  if (!TLS_MODES.includes(tls)) {
    throw new RelayConfigError(
      `SMTP_TLS tiene que ser uno de: ${TLS_MODES.join(", ")}.`,
    );
  }
  const user = (env.SMTP_USER ?? "").trim();
  const pass = env.SMTP_PASS ?? "";
  if (user !== "" && pass === "") {
    throw new RelayConfigError("SMTP_USER está puesto pero falta SMTP_PASS.");
  }
  if (user === "" && pass !== "") {
    throw new RelayConfigError("SMTP_PASS está puesta pero falta SMTP_USER.");
  }
  const from = (env.SMTP_FROM ?? "").trim().toLowerCase();
  if (from !== "" && !looksLikeEmail(from)) {
    throw new RelayConfigError("SMTP_FROM no parece una dirección de correo.");
  }
  const helo =
    (env.SMTP_HELO ?? "pulso-taller.local").trim() || "pulso-taller.local";
  if (/[\r\n]/.test(helo)) {
    throw new RelayConfigError("SMTP_HELO no puede llevar saltos de línea.");
  }

  return {
    host: smtpHost,
    port: smtpPort,
    tls,
    secure: tls === "ssl",
    user,
    pass,
    from,
    helo,
    rejectUnauthorized: readBoolean(
      env.SMTP_REJECT_UNAUTHORIZED,
      true,
      "SMTP_REJECT_UNAUTHORIZED",
    ),
    timeoutMs: readNumber(env.SMTP_TIMEOUT_MS, 20000, "SMTP_TIMEOUT_MS", {
      min: 1000,
      max: 120000,
    }),
  };
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

/** Compara el testigo sin filtraciones por el tiempo que tarda en fallar. */
function authorized(header, token) {
  if (token === "") return true;
  const value = (header ?? "").trim();
  const match = /^Bearer\s+(.+)$/i.exec(value);
  if (match === null) return false;
  const given = Buffer.from(match[1], "utf8");
  const want = Buffer.from(token, "utf8");
  return given.length === want.length && timingSafeEqual(given, want);
}

/**
 * Lee el cuerpo entero sin comerse la memoria si alguien manda un camión.
 *
 * Al pasarse del tope no se corta la conexión: se deja de guardar y se rechaza
 * una sola vez. Así el cliente recibe su 413 en vez de un corte a mitad, que
 * desde el backend se lee como «el relevo no está» y no como «el sobre es
 * demasiado grande».
 */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooBig = false;
    req.on("data", (chunk) => {
      if (tooBig) return;
      size += chunk.length;
      if (size > limit) {
        tooBig = true;
        reject(
          new RelayRequestError(
            `El sobre pasa de ${Math.round(limit / 1024)} KB.`,
            413,
          ),
        );
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!tooBig) resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", (error) => reject(error));
  });
}

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(body);
}

/**
 * Una línea de registro por envío: quién y qué, nunca el cuerpo, el testigo ni la
 * contraseña. Del servidor del sobre solo se apunta su nombre: es lo que hace
 * falta para entender un envío que salió por donde no se esperaba. La
 * comprobación previa también deja su línea, para saber que se hizo y cómo fue.
 */
function logLine({ status, envelope, smtp, ms, error, check = false }) {
  const at = new Date().toISOString();
  const via = smtp ? ` vía ${short(smtp.host, 80)}:${smtp.port}` : "";
  const detail = error ? ` · ${short(error, 160)}` : "";
  if (check) return `${at} ${status} comprobación${via} ${ms} ms${detail}`;
  const recipients = envelope ? envelope.to.length + envelope.bcc.length : 0;
  const subject = envelope ? ` «${short(envelope.subject, 80)}»` : "";
  return `${at} ${status} ${recipients} destinatario(s)${subject}${via} ${ms} ms${detail}`;
}

/** El código HTTP que le toca a un fallo, y lo que se puede contar de él. */
function failureResponse(error) {
  const status =
    error instanceof RelayRequestError
      ? error.status
      : error instanceof RelaySmtpError
        ? 502
        : 500;
  return {
    status,
    message:
      status === 500
        ? "El relevo falló por dentro; mira su registro."
        : error.message,
  };
}

/**
 * ¿Es esta la ruta de la comprobación previa? Vale la de siempre con
 * `/comprobar` detrás —que es la que compone la app a partir de la dirección del
 * relevo— y `/comprobar` a secas, para poder probarlo a mano con una línea.
 */
function isCheckPath(pathname, config) {
  return (
    pathname === `${config.path.replace(/\/+$/, "")}/comprobar` ||
    pathname === "/comprobar"
  );
}

/**
 * El servidor del relevo.
 *
 * Se le pasa el `send` para que las pruebas puedan mirar el sobre sin abrir un
 * puerto SMTP —recibe el sobre y, si el sobre lo trae, el servidor SMTP de esa
 * entrega—, el `verify` para que la comprobación previa use lo mismo que la
 * entrega —recibe el servidor del sobre, si lo trae, y devuelve lo que se ha
 * negociado— y el `log` para que el arranque decida dónde escribir. Todo lo demás
 * —testigo, tamaño, JSON, códigos— es lo mismo en producción y en pruebas.
 */
export function createRelayServer({
  config,
  send,
  verify,
  log = () => {},
  now = () => Date.now(),
}) {
  const server = createServer((req, res) => {
    const handle = async () => {
      const url = new URL(req.url ?? "/", "http://relevo.local");
      if (req.method === "GET" && url.pathname === "/salud") {
        sendJson(res, 200, { ok: true });
        return;
      }
      const check = isCheckPath(url.pathname, config);
      if (!check && url.pathname !== config.path) {
        sendJson(res, 404, { ok: false, error: "Ruta desconocida." });
        return;
      }
      if (req.method !== "POST") {
        sendJson(
          res,
          405,
          { ok: false, error: "Solo se acepta POST." },
          { Allow: "POST" },
        );
        return;
      }
      if (!authorized(req.headers.authorization, config.token)) {
        log(logLine({ status: 401, ms: 0, check }));
        sendJson(res, 401, {
          ok: false,
          error: "Falta el testigo del relevo o no coincide.",
        });
        return;
      }
      // Un relevo al que no le han montado la comprobación lo dice, en vez de
      // fingir que ha comprobado algo.
      if (check && typeof verify !== "function") {
        sendJson(res, 501, {
          ok: false,
          error: "Este relevo no tiene la comprobación montada.",
        });
        return;
      }

      const started = now();
      let envelope = null;
      let smtp = null;
      try {
        const raw = await readBody(req, config.maxBodyBytes);
        let payload = {};
        if (raw.trim() !== "") {
          try {
            payload = JSON.parse(raw);
          } catch {
            throw new RelayRequestError("El cuerpo no es JSON válido.");
          }
        }
        // El servidor de esta entrega, si el sobre trae uno: Gmail y los buzones
        // de pruebas no están en el entorno del relevo, vienen con el correo. La
        // comprobación admite lo mismo, así que se comprueba el servidor con el
        // que de verdad se va a entregar.
        smtp = parseSmtpOverride(payload.smtp);

        if (check) {
          const result = await verify(smtp);
          const ms = now() - started;
          log(logLine({ status: 200, smtp, ms, check: true }));
          sendJson(res, 200, { ok: true, check: result ?? null });
          return;
        }

        envelope = parseEnvelope(payload);
        const result = await send(envelope, smtp);
        const ms = now() - started;
        log(logLine({ status: 200, envelope, smtp, ms }));
        sendJson(res, 200, {
          ok: true,
          recipients: result?.recipients ?? [...envelope.to, ...envelope.bcc],
        });
      } catch (error) {
        const { status, message } = failureResponse(error);
        const ms = now() - started;
        log(logLine({ status, envelope, smtp, ms, error: message, check }));
        if (!res.headersSent)
          sendJson(res, status, { ok: false, error: message });
      }
    };
    void handle().catch(() => {
      if (!res.headersSent) {
        sendJson(res, 500, { ok: false, error: "El relevo falló por dentro." });
      }
    });
  });

  // Una petición mal formada no puede tumbar el proceso ni dejar el socket abierto.
  server.on("clientError", (_error, socket) => {
    if (socket.writable) {
      socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
    }
  });

  return server;
}
