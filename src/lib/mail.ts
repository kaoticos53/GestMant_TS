/**
 * El correo saliente del taller: por dónde sale y qué se le pide a cada servicio.
 *
 * Hasta ahora el correo tenía un solo camino —la pasarela de la plataforma—, y
 * eso obligaba a que el deployment tuviera su clave y a que el remitente lo
 * decidiera otro. Aquí vive la otra mitad: el catálogo de servicios a los que un
 * taller puede apuntar su correo, lo que hay que rellenar de cada uno y cómo se
 * le pide el envío a cada uno.
 *
 * Lo que sale de aquí es la **petición**, no el envío: el `fetch` lo hace quien
 * tiene la base delante (`convex/_mail`), y por eso todo esto se puede probar sin
 * servidor. Las claves no se leen aquí —las resuelve el backend entre lo guardado
 * y el entorno—, pero sí se comprueba que estén: un ajuste sin clave es un ajuste
 * que no manda nada, y es mejor decirlo antes de intentarlo.
 *
 * Ningún servicio comparte la forma de pedir el envío, y ninguno avisa de que la
 * petición está mal antes de mandarla: si el cuerpo tiene otro nombre de campo, la
 * respuesta es un 422 sin más. De ahí que cada uno tenga su construcción escrita
 * a mano y su prueba, en vez de una llamada común con un mapa de campos en medio.
 */

/** Los servicios que el taller puede configurar. */
export const MAIL_PROVIDERS = [
  "vly",
  "resend",
  "sendgrid",
  "mailgun",
  "brevo",
  "relay",
  "gmail",
  "ethereal",
] as const;

export type MailProvider = (typeof MAIL_PROVIDERS)[number];

/**
 * Un servidor SMTP al que apuntar: los que no tienen API propia. El backend no
 * puede hablar SMTP, así que estos salen por el relevo —el mismo puente que el
 * taller monta para su servidor de correo— y el destino viaja en el sobre.
 */
export interface MailSmtpPreset {
  host: string;
  port: number;
  tls: "auto" | "starttls" | "ssl" | "none";
}

/** Campos que pide cada servicio, además del remitente de siempre. */
export type MailProviderField =
  "apiKey" | "domain" | "relayUrl" | "relayToken" | "smtpUser";

export interface MailProviderMeta {
  id: MailProvider;
  label: string;
  /** Qué es y para qué sirve, en una línea para la pantalla de ajustes. */
  summary: string;
  /**
   * Variable del servidor de la que se toma la clave cuando no hay una guardada.
   * Nula si el servicio no usa clave (o solo la del deployment, como la pasarela).
   */
  apiKeyEnv: string | null;
  /** Lo que hay que rellenar para este servicio, en el orden en que se enseña. */
  fields: MailProviderField[];
  /**
   * Servidor SMTP del servicio, cuando lo tiene: un Gmail o un buzón de pruebas
   * no se configuran por API. Nulo en los que se piden por HTTP.
   */
  smtp: MailSmtpPreset | null;
  /** Cómo se llama la cuenta del servicio en la pantalla (`smtpUser`). */
  userLabel: string | null;
  /** Cómo se llama su secreto: no siempre es una clave de API. */
  secretLabel: string | null;
}

/**
 * El catálogo. El orden es el de la pantalla: primero la pasarela —lo que ya
 * funciona sin configurar nada— y después los servicios propios, del más común al
 * más artesanal.
 */
export const MAIL_PROVIDER_META: Record<MailProvider, MailProviderMeta> = {
  vly: {
    id: "vly",
    label: "Pasarela de la plataforma",
    summary:
      "El envío de siempre: lo manda la plataforma con la clave del deployment y firma ella. No hay nada que rellenar.",
    apiKeyEnv: "VLY_INTEGRATION_KEY",
    fields: [],
    smtp: null,
    userLabel: null,
    secretLabel: null,
  },
  resend: {
    id: "resend",
    label: "Resend",
    summary:
      "API propia, con clave por dominio verificado. Sencillo de configurar y con registro de entregas.",
    apiKeyEnv: "RESEND_API_KEY",
    fields: ["apiKey"],
    smtp: null,
    userLabel: null,
    secretLabel: null,
  },
  sendgrid: {
    id: "sendgrid",
    label: "SendGrid",
    summary:
      "API de Twilio. La clave se crea con permiso de envío y el remitente tiene que estar verificado.",
    apiKeyEnv: "SENDGRID_API_KEY",
    fields: ["apiKey"],
    smtp: null,
    userLabel: null,
    secretLabel: null,
  },
  mailgun: {
    id: "mailgun",
    label: "Mailgun",
    summary:
      "Necesita la clave y el dominio verificado: el dominio es parte de la dirección de envío.",
    apiKeyEnv: "MAILGUN_API_KEY",
    fields: ["apiKey", "domain"],
    smtp: null,
    userLabel: null,
    secretLabel: null,
  },
  brevo: {
    id: "brevo",
    label: "Brevo",
    summary:
      "API de Brevo (antes Sendinblue). La clave está en el panel de SMTP y API.",
    apiKeyEnv: "BREVO_API_KEY",
    fields: ["apiKey"],
    smtp: null,
    userLabel: null,
    secretLabel: null,
  },
  relay: {
    id: "relay",
    label: "Relevo propio",
    summary:
      "Un puente HTTP propio que reciba el correo y lo entregue por SMTP. Es el camino cuando el taller ya tiene su servidor de correo; el repositorio incluye uno listo para usar con `npm run mail:relay`.",
    apiKeyEnv: "MAIL_RELAY_TOKEN",
    fields: ["relayUrl", "relayToken"],
    smtp: null,
    userLabel: null,
    secretLabel: null,
  },
  gmail: {
    id: "gmail",
    label: "Gmail (Google)",
    summary:
      "La cuenta de Google del taller, con su contraseña de aplicación. Sale por smtp.gmail.com a través del relevo.",
    apiKeyEnv: "GMAIL_APP_PASSWORD",
    fields: ["relayUrl", "relayToken", "smtpUser", "apiKey"],
    smtp: { host: "smtp.gmail.com", port: 465, tls: "ssl" },
    userLabel: "Cuenta de Gmail",
    secretLabel: "Contraseña de aplicación",
  },
  ethereal: {
    id: "ethereal",
    label: "Ethereal (pruebas)",
    summary:
      "Un buzón falso para probar el correo sin mandar nada de verdad: los mensajes se quedan en ethereal.email para mirarlos.",
    apiKeyEnv: null,
    fields: ["relayUrl", "relayToken", "smtpUser", "apiKey"],
    smtp: { host: "smtp.ethereal.email", port: 587, tls: "starttls" },
    userLabel: "Buzón de pruebas",
    secretLabel: "Contraseña del buzón",
  },
};

/** El catálogo como lista, en el orden en que se enseña. */
export const MAIL_PROVIDER_OPTIONS: MailProviderMeta[] = MAIL_PROVIDERS.map(
  (id) => MAIL_PROVIDER_META[id],
);

export function isMailProvider(value: string): value is MailProvider {
  return (MAIL_PROVIDERS as readonly string[]).includes(value);
}

/**
 * ¿Este servicio sale por el relevo? Los que no tienen API propia —el servidor
 * de correo del taller, Gmail y el buzón de pruebas— necesitan el puente HTTP,
 * porque el backend de Convex no abre conexiones TCP.
 */
export function usesMailRelay(provider: MailProvider): boolean {
  return provider === "relay" || MAIL_PROVIDER_META[provider].smtp !== null;
}

/**
 * El servidor SMTP de un servicio, si lo tiene. Gmail y Ethereal no se eligen:
 * vienen puestos (`smtp.gmail.com`, `smtp.ethereal.email`), que es justo lo que
 * hace útil el preset —nadie tiene que acordarse del puerto ni del cifrado—.
 */
export function mailSmtpPreset(provider: MailProvider): MailSmtpPreset | null {
  return MAIL_PROVIDER_META[provider].smtp;
}

/** ¿Es un servicio con API HTTP? La pasarela va por su SDK, no por esta tabla. */
export function isHttpMailProvider(
  provider: MailProvider,
): provider is Exclude<MailProvider, "vly"> {
  return provider !== "vly";
}

/** Lo que se guarda en los ajustes del taller (`mailSettings`). */
export interface MailSettings {
  provider: MailProvider;
  /** Apagado: no se manda nada, y el motivo queda escrito donde se intente. */
  enabled: boolean;
  fromName: string;
  fromEmail: string;
  /** Sin valor, el correo no lleva «responder a». */
  replyTo: string;
  /**
   * Copia oculta fija del taller: todos los correos salen también a esta
   * dirección, y los destinatarios de verdad no la ven. Vacía, no se copia a
   * nadie. Es una sola dirección, no una lista: la copia es para el archivo del
   * taller, no para repartir el correo otra vez.
   */
  bcc: string;
  /** Dominio verificado: solo Mailgun lo necesita. */
  domain: string;
  /** Dirección del puente: el relevo propio, Gmail y el buzón de pruebas. */
  relayUrl: string;
  /** Cuenta con la que se autentica el SMTP: Gmail y el buzón de pruebas. */
  smtpUser: string;
}

/**
 * Los ajustes con los que nace un taller: la pasarela encendida, como hasta hoy.
 * Sin remitente porque la pasarela pone el suyo; al elegir un servicio propio,
 * la pantalla pide el remitente antes de dejar guardar.
 */
export const DEFAULT_MAIL_SETTINGS: MailSettings = {
  provider: "vly",
  enabled: true,
  fromName: "Pulso Taller",
  fromEmail: "",
  replyTo: "",
  bcc: "",
  domain: "",
  relayUrl: "",
  smtpUser: "",
};

/** Lo que se le pide al servicio para un envío concreto. */
export interface MailMessage {
  to: string[];
  subject: string;
  text: string;
  html: string;
}

/** Una petición HTTP ya compuesta: lo único que falta es lanzarla. */
export interface MailRequest {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: string;
}

/**
 * Lo que hace falta para mandar: los ajustes más los secretos ya resueltos. Los
 * secretos no salen nunca del servidor; esto es lo que se quedan la acción y su
 * prueba.
 */
export interface MailTransport {
  provider: MailProvider;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  bcc: string;
  domain: string;
  relayUrl: string;
  smtpUser: string;
  apiKey: string;
  relayToken: string;
}

/** Límites de los campos, para no guardar ni media firma ni media URL. */
export const MAX_MAIL_NAME = 80;
export const MAX_MAIL_ADDRESS = 200;
export const MAX_MAIL_SECRET = 500;
export const MAX_MAIL_URL = 300;
export const MAX_MAIL_DOMAIN = 200;

/**
 * ¿Tiene forma de correo? Solo comprueba que se pueda escribir a esa dirección:
 * que exista lo dice el envío, no una expresión regular. Lo que deja fuera son
 * las erratas de dedo —un correo sin arroba o sin dominio—, que es lo que de
 * verdad se cuela cuando alguien rellena un formulario con prisa.
 */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Un dominio verificado de Mailgun: host con al menos un punto. */
export function looksLikeMailDomain(value: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(
    value,
  );
}

/** Una dirección de relevo: HTTP o HTTPS, sin más requisitos. */
export function looksLikeRelayUrl(value: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(value);
}

/**
 * El remitente tal y como lo leen los servicios: «Nombre <correo>». Sin nombre se
 * manda solo la dirección, que es lo que esperan todos.
 *
 * Las comillas y los ángulos se quitan del nombre: un nombre con esos caracteres
 * dentro del encabezado deja de ser un nombre y pasa a ser otra cabecera.
 */
export function formatSender(transport: {
  fromName: string;
  fromEmail: string;
}): string {
  const email = transport.fromEmail.trim();
  const name = transport.fromName
    .replace(/["<>]/g, "")
    .replace(/[\r\n]+/g, " ")
    .trim();
  return name === "" ? email : `${name} <${email}>`;
}

/** Los destinatarios, sin repetidos y sin espacios, para no mandar dos veces. */
export function normalizeRecipients(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const email = value.trim().toLowerCase();
    if (email === "" || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

/** Lo que devuelve la validación de los ajustes. */
export type MailSettingsValidation =
  { ok: true; value: MailSettings } | { ok: false; error: string };

/**
 * Comprueba los ajustes antes de guardarlos. No mira claves —esas se guardan
 * aparte y pueden venir del entorno—: solo lo que la pantalla escribe.
 *
 * El remitente se exige a los servicios propios y no a la pasarela, que firma con
 * el suyo. Lo demás depende del servicio: Mailgun no sabe a qué dominio mandar sin
 * su dominio, y el relevo no sabe a dónde llamar sin su dirección.
 */
export function validateMailSettings(input: {
  provider: string;
  enabled: boolean;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  bcc: string;
  domain: string;
  relayUrl: string;
  smtpUser?: string;
}): MailSettingsValidation {
  if (!isMailProvider(input.provider)) {
    return {
      ok: false,
      error:
        "Ese servicio de correo no está entre los que se pueden configurar.",
    };
  }
  const provider = input.provider;
  const fromName = input.fromName.trim();
  const fromEmail = input.fromEmail.trim().toLowerCase();
  const replyTo = input.replyTo.trim().toLowerCase();
  const bcc = input.bcc.trim().toLowerCase();
  const domain = input.domain.trim().toLowerCase();
  const relayUrl = input.relayUrl.trim();
  const smtpUser = (input.smtpUser ?? "").trim().toLowerCase();
  const meta = MAIL_PROVIDER_META[provider];

  if (fromName.length > MAX_MAIL_NAME) {
    return {
      ok: false,
      error: `El nombre del remitente no puede pasar de ${MAX_MAIL_NAME} caracteres.`,
    };
  }
  if (/[\r\n]/.test(fromName)) {
    return {
      ok: false,
      error: "El nombre del remitente no puede llevar saltos de línea.",
    };
  }
  // El remitente es obligatorio en los servicios propios: sin él, el correo sale
  // sin quién lo firma y la mitad de los buzones lo tiran.
  if (provider !== "vly" && fromEmail === "") {
    return {
      ok: false,
      error:
        "Escribe el correo del remitente: sin él no se puede firmar el envío.",
    };
  }
  if (fromEmail !== "" && !looksLikeEmail(fromEmail)) {
    return {
      ok: false,
      error: "El correo del remitente no parece una dirección válida.",
    };
  }
  if (fromEmail.length > MAX_MAIL_ADDRESS) {
    return {
      ok: false,
      error: "El correo del remitente es demasiado largo.",
    };
  }
  if (replyTo !== "" && !looksLikeEmail(replyTo)) {
    return {
      ok: false,
      error: "La dirección de respuesta no parece un correo válido.",
    };
  }
  if (replyTo.length > MAX_MAIL_ADDRESS) {
    return {
      ok: false,
      error: "La dirección de respuesta es demasiado larga.",
    };
  }
  // La copia oculta es una sola dirección: dos buzones separados por coma se
  // guardarían como un texto que ningún servicio sabría leer, y el envío
  // fallaría en el momento menos pensado.
  if (bcc !== "" && !looksLikeEmail(bcc)) {
    return {
      ok: false,
      error:
        "La copia oculta tiene que ser una única dirección de correo válida.",
    };
  }
  if (bcc.length > MAX_MAIL_ADDRESS) {
    return {
      ok: false,
      error: "La copia oculta es demasiado larga.",
    };
  }
  if (provider === "mailgun") {
    if (domain === "") {
      return {
        ok: false,
        error: "Mailgun necesita el dominio verificado desde el que se envía.",
      };
    }
    if (!looksLikeMailDomain(domain) || domain.length > MAX_MAIL_DOMAIN) {
      return {
        ok: false,
        error: "Ese dominio no tiene forma de dominio: por ejemplo, taller.es.",
      };
    }
  }
  // La cuenta con la que se autentica el SMTP: sin ella, el relevo no sabe en
  // nombre de quién hablar con Gmail ni con el buzón de pruebas.
  if (meta.smtp !== null && smtpUser === "") {
    return {
      ok: false,
      error: `${meta.label} necesita ${meta.userLabel ?? "su cuenta"} con la que autenticarse.`,
    };
  }
  if (smtpUser !== "" && !looksLikeEmail(smtpUser)) {
    return {
      ok: false,
      error: "La cuenta del servidor de correo no parece una dirección válida.",
    };
  }
  if (smtpUser.length > MAX_MAIL_ADDRESS) {
    return {
      ok: false,
      error: "La cuenta del servidor de correo es demasiado larga.",
    };
  }

  if (usesMailRelay(provider)) {
    if (relayUrl === "") {
      return {
        ok: false,
        error:
          meta.smtp === null
            ? "El relevo propio necesita la dirección a la que se le manda el correo."
            : `${meta.label} no tiene API propia: sale por el relevo, así que hace falta su dirección.`,
      };
    }
    if (!looksLikeRelayUrl(relayUrl) || relayUrl.length > MAX_MAIL_URL) {
      return {
        ok: false,
        error:
          "La dirección del relevo tiene que empezar por http:// o https://.",
      };
    }
  }

  return {
    ok: true,
    value: {
      provider,
      enabled: input.enabled,
      fromName,
      fromEmail,
      replyTo,
      bcc,
      // Lo que no usa el servicio elegido se guarda vacío: así, al cambiar de
      // servicio, no queda dentro el dominio del anterior.
      domain: provider === "mailgun" ? domain : "",
      relayUrl: usesMailRelay(provider) ? relayUrl : "",
      smtpUser: meta.smtp === null ? "" : smtpUser,
    },
  };
}

/**
 * Lo que impide mandar con esta configuración, o `null` si se puede.
 *
 * Los secretos llegan ya resueltos, así que aquí solo se comprueba que estén: un
 * servicio configurado sin clave es un servicio que no manda nada, y vale más
 * decirlo con su nombre —y con la variable que falta— que devolver el 401 del
 * proveedor, que no dice dónde se arregla.
 */
export function mailConfigBlocker(transport: {
  provider: MailProvider;
  fromEmail: string;
  domain: string;
  relayUrl: string;
  smtpUser?: string;
  apiKey: string;
  relayToken: string;
}): string | null {
  const meta = MAIL_PROVIDER_META[transport.provider];
  if (transport.provider === "vly") {
    return transport.apiKey.trim() === ""
      ? `El deployment no tiene ${meta.apiKeyEnv}: el correo del taller no se puede enviar todavía.`
      : null;
  }
  if (transport.fromEmail.trim() === "") {
    return "No hay correo de remitente configurado: ponlo en los ajustes del correo.";
  }
  // El relevo tiene su propia puerta: se le manda a una dirección, y su testigo
  // es opcional. No hay clave de API que exigirle. Gmail y el buzón de pruebas
  // salen por ahí mismo, así que también necesitan la dirección del puente.
  if (usesMailRelay(transport.provider)) {
    if (transport.relayUrl.trim() === "") {
      return meta.smtp === null
        ? "Falta la dirección del relevo propio en los ajustes del correo."
        : `${meta.label} no tiene API propia: falta la dirección del relevo en los ajustes del correo.`;
    }
    if (meta.smtp !== null && (transport.smtpUser ?? "").trim() === "") {
      return `Falta ${meta.userLabel ?? "la cuenta"} de ${meta.label} en los ajustes del correo.`;
    }
    if (transport.provider === "relay") return null;
  }
  if (transport.apiKey.trim() === "") {
    const secret = meta.secretLabel ?? "la clave";
    return meta.apiKeyEnv === null
      ? `Falta ${secret.toLowerCase()} de ${meta.label}: guárdala en los ajustes del correo.`
      : `Falta ${secret.toLowerCase()} de ${meta.label}: guárdala en los ajustes del correo o define ${meta.apiKeyEnv} en el servidor.`;
  }
  if (transport.provider === "mailgun" && transport.domain.trim() === "") {
    return "Falta el dominio verificado de Mailgun en los ajustes del correo.";
  }
  return null;
}

/**
 * Aviso de seguridad de la configuración, o `null` si no hay nada que decir.
 *
 * Un Gmail o un buzón de pruebas se autentican con su contraseña en el sobre, y
 * esa contraseña viaja al relevo como el testigo: en claro si el puente está en
 * `http://`. No se bloquea —un taller con el relevo dentro de su red lo tiene
 * así a propósito—, pero se dice, porque es lo que nadie mira hasta que alguien
 * mira el tráfico.
 */
export function mailCredentialsWarning(settings: {
  provider: MailProvider;
  relayUrl: string;
}): string | null {
  if (!usesMailRelay(settings.provider)) return null;
  if (MAIL_PROVIDER_META[settings.provider].smtp === null) return null;
  return /^http:\/\//i.test(settings.relayUrl.trim())
    ? "La dirección del relevo no va cifrada (empieza por http://): la contraseña del correo viaja sin cifrar por la red. Usa https:// o déjalo dentro de la red del taller."
    : null;
}

/** El puerto donde escucha el relevo del repositorio (`scripts/mail-relay.mjs`). */
export const MAIL_RELAY_DEFAULT_PORT = 8788;

/** ¿La dirección apunta al propio ordenador, tal como la ve quien la escribe? */
function isLoopbackHost(hostname: string): boolean {
  const host = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".localhost")
  );
}

/**
 * Qué tiene de raro la dirección del relevo, o `null` si no hay nada que decir.
 *
 * Tres confusiones se llevan casi todos los intentos que fallan: poner la
 * dirección del visor de mensajes de Ethereal —el 8025, que solo enseña correos y
 * no entrega ninguno—, poner `https://` a un puente que habla HTTP sin cifrar, y
 * poner `localhost` cuando el backend va en su propio contenedor, donde
 * `localhost` es el contenedor y no el ordenador. Se dice al escribir la
 * dirección, no cuando ya se ha perdido un envío.
 *
 * No bloquea el guardado: un taller puede tener su relevo detrás de un proxy en
 * el 8788 con certificado, o escuchando en la misma máquina del backend. Es un
 * aviso, y por eso devuelve texto y no un error.
 */
export function mailRelayAddressHint(relayUrl: string): string | null {
  const value = relayUrl.trim();
  if (value === "") return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "La dirección del relevo no se entiende: escribe la URL completa, con http:// o https:// delante.";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "La dirección del relevo tiene que empezar por http:// o https://.";
  }
  const port =
    url.port === "" ? (url.protocol === "https:" ? "443" : "80") : url.port;
  if (port === "8025") {
    return "El puerto 8025 es el visor de mensajes de Ethereal, no el relevo: ahí no se entrega ningún correo. Deja la cuenta del buzón en los ajustes y pon la dirección del relevo, que escucha en el 8788 —por ejemplo http://host.docker.internal:8788/enviar—.";
  }
  if (url.protocol === "https:" && port === String(MAIL_RELAY_DEFAULT_PORT)) {
    return "El relevo del repositorio habla HTTP sin cifrar: con https:// en el 8788 no habrá conexión. Usa http://, o ponlo detrás de un proxy con certificado y entonces sí https://.";
  }
  if (isLoopbackHost(url.hostname)) {
    return "Si el backend va en su propio contenedor —como en la instalación de este repositorio—, localhost es el contenedor y no tu ordenador: usa host.docker.internal para llegar al relevo que corre en tu equipo, o el nombre del servicio si está en la misma red de Docker.";
  }
  return null;
}

/**
 * Lo que hay que mirar cuando un envío no llega ni a hablar con el relevo.
 *
 * «Connection refused» no dice dónde se arregla: aquí se añade que el relevo
 * tiene que estar arrancado y cuál es su dirección de siempre, con las dos
 * instalaciones que hay —el ordenador, donde lo arranca `npm run mail:relay`, y
 * el NAS, donde es un contenedor más del proyecto—, porque mandar a un taller a
 * un comando que allí no existe deja el problema donde estaba. `null` cuando el
 * fallo no es de conexión —un 401 del servicio, un rechazo del buzón— o cuando el
 * servicio ni siquiera pasa por el relevo.
 */
export function mailRelayFailureHint(
  provider: MailProvider,
  error: string,
): string | null {
  if (!usesMailRelay(provider)) return null;
  const unreachable =
    /connection refused|econnrefused|tcp connect|failed to fetch|network ?error|timed? ?out|etimedout|getaddrinfo|no such host|enotfound/i.test(
      error,
    );
  if (!unreachable) return null;
  return "El relevo no está escuchando en esa dirección: en el ordenador se arranca con `npm run mail:relay`; en el NAS es el contenedor `relevo`, que va con el resto (`docker compose up -d relevo`). Comprueba también que la URL guardada es la suya: http://host.docker.internal:8788/enviar si el relevo corre en tu equipo, y http://relevo:8788/enviar si va en el mismo Docker que el backend.";
}

/**
 * Cuántos envíos guarda el histórico del correo. Es un registro para auditar
 * «qué salió y a quién», no un archivo: crece con cada aviso y cada semana, así
 * que se poda solo al apuntar y se queda con los últimos.
 */
export const MAIL_LOG_LIMIT = 200;

/** De dónde sale un envío, para leer el histórico de un vistazo. */
export const MAIL_ORIGINS = [
  "incidencia",
  "equipo",
  "resumen",
  "prueba",
] as const;

export type MailOrigin = (typeof MAIL_ORIGINS)[number];

/**
 * Cómo se llama cada origen en la pantalla. Los dos avisos de una incidencia se
 * distinguen a propósito: uno va a quien la notificó —fuera del taller— y el otro
 * es el aviso interno para los roles que lo piden.
 */
export const MAIL_ORIGIN_LABELS: Record<MailOrigin, string> = {
  incidencia: "Aviso a quien notificó",
  equipo: "Aviso interno de incidencia",
  resumen: "Resumen semanal",
  prueba: "Prueba de envío",
};

/** Base64 sin depender de `Buffer`: el runtime del backend no lo tiene. */
function base64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Lo que se espera de un envío. */
export type MailRequestResult =
  { ok: true; request: MailRequest } | { ok: false; error: string };

/**
 * La petición de cada servicio, con el sobre ya puesto.
 *
 * No toca la red: devuelve la dirección, las cabeceras y el cuerpo. La pasarela
 * de la plataforma no está aquí —va por su SDK, que firma con la clave del
 * deployment—, y pedirla por esta puerta es un error de quien llama.
 */
export function buildMailRequest(
  transport: MailTransport,
  message: MailMessage,
): MailRequestResult {
  const provider = transport.provider;
  if (provider === "vly") {
    return {
      ok: false,
      error: "La pasarela de la plataforma no se usa por esta puerta.",
    };
  }
  const blocker = mailConfigBlocker(transport);
  if (blocker !== null) return { ok: false, error: blocker };
  const to = normalizeRecipients(message.to);
  if (to.length === 0) {
    return { ok: false, error: "El correo no tiene destinatarios." };
  }

  const from = formatSender(transport);
  const replyTo = transport.replyTo.trim();
  const bcc = transport.bcc.trim().toLowerCase();
  const key = transport.apiKey.trim();

  if (provider === "resend") {
    return {
      ok: true,
      request: {
        url: "https://api.resend.com/emails",
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to,
          subject: message.subject,
          text: message.text,
          html: message.html,
          ...(replyTo === "" ? {} : { reply_to: replyTo }),
          ...(bcc === "" ? {} : { bcc: [bcc] }),
        }),
      },
    };
  }

  if (provider === "sendgrid") {
    return {
      ok: true,
      request: {
        url: "https://api.sendgrid.com/v3/mail/send",
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: to.map((email) => ({ email })),
              ...(bcc === "" ? {} : { bcc: [{ email: bcc }] }),
            },
          ],
          from: {
            email: transport.fromEmail.trim().toLowerCase(),
            ...(transport.fromName.trim() === ""
              ? {}
              : { name: transport.fromName.trim() }),
          },
          subject: message.subject,
          content: [
            { type: "text/plain", value: message.text },
            { type: "text/html", value: message.html },
          ],
          ...(replyTo === "" ? {} : { reply_to: { email: replyTo } }),
        }),
      },
    };
  }

  if (provider === "mailgun") {
    // Mailgun espera el formulario, no JSON: los destinatarios van repetidos y
    // «responder a» se manda como cabecera propia (`h:Reply-To`).
    const form = new URLSearchParams();
    form.set("from", from);
    for (const email of to) form.append("to", email);
    form.set("subject", message.subject);
    form.set("text", message.text);
    form.set("html", message.html);
    if (replyTo !== "") form.set("h:Reply-To", replyTo);
    if (bcc !== "") form.set("bcc", bcc);
    return {
      ok: true,
      request: {
        url: `https://api.mailgun.net/v3/${encodeURIComponent(
          transport.domain.trim().toLowerCase(),
        )}/messages`,
        method: "POST",
        headers: {
          Authorization: `Basic ${base64(`api:${key}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      },
    };
  }

  if (provider === "brevo") {
    return {
      ok: true,
      request: {
        url: "https://api.brevo.com/v3/smtp/email",
        method: "POST",
        headers: {
          "api-key": key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: {
            email: transport.fromEmail.trim().toLowerCase(),
            ...(transport.fromName.trim() === ""
              ? {}
              : { name: transport.fromName.trim() }),
          },
          to: to.map((email) => ({ email })),
          subject: message.subject,
          htmlContent: message.html,
          textContent: message.text,
          ...(replyTo === "" ? {} : { replyTo: { email: replyTo } }),
          ...(bcc === "" ? {} : { bcc: [{ email: bcc }] }),
        }),
      },
    };
  }

  // El relevo propio: el sobre tal cual, para que el puente no tenga que adivinar
  // de qué servicio viene. El testigo es opcional —hay puentes dentro de la red
  // del taller que no lo piden—.
  //
  // Gmail y el buzón de pruebas van por el mismo puente, y añaden a dónde tiene
  // que entregar: el backend no puede hablar SMTP, así que el destino y las
  // credenciales del servidor viajan en el sobre. El relevo no necesita saber si
  // es Gmail: solo si el sobre trae servidor propio o el suyo de siempre.
  const token = transport.relayToken.trim();
  const preset = MAIL_PROVIDER_META[provider].smtp;
  return {
    ok: true,
    request: {
      url: transport.relayUrl.trim(),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token === "" ? {} : { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({
        from: {
          email: transport.fromEmail.trim().toLowerCase(),
          ...(transport.fromName.trim() === ""
            ? {}
            : { name: transport.fromName.trim() }),
        },
        to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        ...(replyTo === "" ? {} : { replyTo }),
        ...(bcc === "" ? {} : { bcc: [bcc] }),
        ...(preset === null
          ? {}
          : {
              smtp: {
                host: preset.host,
                port: preset.port,
                tls: preset.tls,
                user: transport.smtpUser.trim().toLowerCase(),
                pass: key,
              },
            }),
      }),
    },
  };
}

/** Cómo se llama el servicio en la pantalla, para los mensajes de error. */
export function mailProviderLabel(provider: MailProvider): string {
  return MAIL_PROVIDER_META[provider].label;
}

/**
 * Lo que contesta el relevo cuando se le pide la comprobación previa: con quién
 * habló, cómo quedó cifrada la conexión y con qué se autenticó. Sin credenciales
 * y sin mensaje: ni se ha mandado nada.
 */
export interface MailCheckResult {
  host: string;
  port: number;
  tls: string;
  auth: string | null;
}

/**
 * La dirección de la comprobación: la del relevo con `/comprobar` detrás. El
 * puente atiende las dos formas —con el camino configurado delante y sin él—,
 * así que la app no tiene que adivinar cómo está montado.
 */
export function mailCheckUrl(relayUrl: string): string {
  return `${relayUrl.trim().replace(/\/+$/, "")}/comprobar`;
}

/**
 * La comprobación previa de un correo que sale por el relevo: conectarse y
 * autenticarse contra el servidor SMTP, **sin mandar ningún correo**. Es para
 * saber si la contraseña de aplicación es la buena o si el puerto está abierto
 * antes de que haya una incidencia esperando su aviso.
 *
 * Solo la entiende el relevo. Un servicio con API propia no tiene por dónde: su
 * comprobación es el correo de prueba, que cuesta un mensaje pero dice más.
 */
export function buildMailCheckRequest(
  transport: MailTransport,
): MailRequestResult {
  if (!usesMailRelay(transport.provider)) {
    return {
      ok: false,
      error: `${MAIL_PROVIDER_META[transport.provider].label} no tiene comprobación previa: los servicios con API se prueban mandando un correo.`,
    };
  }
  const meta = MAIL_PROVIDER_META[transport.provider];
  const relayUrl = transport.relayUrl.trim();
  if (relayUrl === "") {
    return {
      ok: false,
      error: "Falta la dirección del relevo en los ajustes del correo.",
    };
  }
  const user = transport.smtpUser.trim().toLowerCase();
  const pass = transport.apiKey.trim();
  // La contraseña se exige solo a los que se autentican: el relevo propio puede
  // estar dentro de la red de un servidor que no pide credenciales.
  if (meta.smtp !== null && user === "") {
    return {
      ok: false,
      error: `Falta ${meta.userLabel ?? "la cuenta"} de ${meta.label} en los ajustes del correo.`,
    };
  }
  if (meta.smtp !== null && pass === "") {
    const secret = (meta.secretLabel ?? "La contraseña").toLowerCase();
    return {
      ok: false,
      error: `Falta ${secret} de ${meta.label}: guárdala en los ajustes del correo${
        meta.apiKeyEnv === null
          ? "."
          : ` o define ${meta.apiKeyEnv} en el servidor.`
      }`,
    };
  }

  const token = transport.relayToken.trim();
  const preset = meta.smtp;
  return {
    ok: true,
    request: {
      url: mailCheckUrl(relayUrl),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token === "" ? {} : { Authorization: `Bearer ${token}` }),
      },
      // Sin servidor en el cuerpo, el relevo comprueba el suyo del entorno; con
      // él, comprueba exactamente el que usará el envío.
      body: JSON.stringify(
        preset === null
          ? {}
          : {
              smtp: {
                host: preset.host,
                port: preset.port,
                tls: preset.tls,
                user,
                pass,
              },
            },
      ),
    },
  };
}

/** Lo que contestó el relevo, en una frase para la pantalla. */
export function mailCheckSummary(result: MailCheckResult): string {
  const tls =
    result.tls === "ssl"
      ? "TLS directo"
      : result.tls === "starttls"
        ? "STARTTLS"
        : "sin cifrar";
  const auth =
    result.auth === null ? "sin autenticación" : `AUTH ${result.auth}`;
  return `${result.host}:${result.port} · ${tls} · ${auth}`;
}
