/**
 * El aviso por correo a quien notificó una incidencia.
 *
 * Quien avisa de una avería no tiene cuenta en el taller: se le da un código
 * —«Tu código: A7K2-QX9M»— y con él sigue el caso. Este correo es el otro extremo
 * de ese código: cuando el caso cambia de estado, se le cuenta lo que ha pasado,
 * sin que tenga que volver a mirar.
 *
 * Aquí vive solo el texto, para poder probarlo sin servidor. El envío, que
 * necesita la pasarela de la plataforma, está en `convex/incidentMail`.
 *
 * Dos reglas que no son de estilo:
 *
 * - **Lo que sale es lo que se le enseña al invitado.** Ni notas internas, ni
 *   quién dio cada paso, ni el cuaderno del taller: lo mismo que ve al consultar
 *   su código (`incidents.byCode`). Un correo no puede ser la puerta de atrás
 *   del expediente.
 * - **Solo se avisa de lo que le importa:** el código con el que sigue el caso
 *   —para que no se quede solo en la pantalla que va a cerrar—, que alguien se
 *   haya hecho cargo, que el equipo haya entrado en taller y que el caso se haya
 *   cerrado. Ni los pasos intermedios ni las correcciones de una nota son cosas
 *   de quien notificó.
 */

import { formatPublicCode } from "./publicCode";
import { INCIDENT_STATUS_META, formatDate } from "./workshop";

/**
 * El aviso del alta, que no cuenta un cambio de estado: cuenta el código.
 *
 * Es el estado con el que nace una incidencia (`INTAKE_STATUS`, en
 * `lib/incidentIntake`), y por eso se decide igual que los demás —una incidencia
 * recién notificada tiene este aviso y ninguno más— sin que nadie tenga que
 * acordarse de escribir a quien avisó por un camino aparte.
 */
export const INCIDENT_INTAKE_NOTICE = "reported";

/** Los avisos que se le cuentan a quien notificó, empezando por el alta. */
export const INCIDENT_MAIL_STATUSES = [
  "reported",
  "assigned",
  "workshop",
  "waitingParts",
  "repairing",
  "resolved",
  "unresolved",
] as const;

export type IncidentMailStatus = (typeof INCIDENT_MAIL_STATUSES)[number];

/** ¿Es este el primer aviso de un cambio que merece un correo? */
export function mailableStatus(status: string): IncidentMailStatus | null {
  return (INCIDENT_MAIL_STATUSES as readonly string[]).includes(status)
    ? (status as IncidentMailStatus)
    : null;
}

/**
 * La retirada a la papelera no es un estado —la incidencia sigue en el que
 * estaba— pero sí es algo que quien la notificó tiene que saber: su referencia
 * deja de seguir el caso, y eso no se descubre mirando. Sin este aviso, la
 * referencia que se le dio deja de funcionar sin explicación.
 */
export const INCIDENT_WITHDRAWN_NOTICE = "withdrawn";

/** Lo que se le puede contar a quien notificó: un estado nuevo o la retirada. */
export const INCIDENT_MAIL_NOTICES = [
  ...INCIDENT_MAIL_STATUSES,
  INCIDENT_WITHDRAWN_NOTICE,
] as const;

export type IncidentMailNotice = (typeof INCIDENT_MAIL_NOTICES)[number];

/** ¿Es el aviso de la retirada? Es el único que no cuenta un cambio de estado. */
export function isWithdrawnNotice(
  notice: string,
): notice is typeof INCIDENT_WITHDRAWN_NOTICE {
  return notice === INCIDENT_WITHDRAWN_NOTICE;
}

/**
 * El aviso que toca contar con esto, o null si no es de los que se cuentan (el
 * alta, la verificación y los demás pasos intermedios se quedan dentro). Es la
 * única puerta: decide a la vez qué correo se compone y qué se le apunta a la
 * ficha.
 */
export function mailNotice(value: string): IncidentMailNotice | null {
  if (isWithdrawnNotice(value)) return INCIDENT_WITHDRAWN_NOTICE;
  return mailableStatus(value);
}

/** El correo de quien notifica, tal y como se guarda: sin espacios y en minúsculas. */
export function normalizeReporterEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * ¿Tiene forma de correo? Vive en `lib/mail`, que es donde se comprueban todas
 * las direcciones del taller; se reexporta aquí para que quien avisa de una
 * incidencia no tenga que saber dónde se guarda la regla.
 */
export { looksLikeEmail } from "./mail";

/**
 * Lo que pasa, contado para quien no es del taller: la frase que encabeza el
 * correo y la que explica el cambio. Ni «verificada» ni «derivada»: el vocabulario
 * del taller se queda en el taller.
 */
const NOTICE_MAIL_TEXT: Record<
  IncidentMailNotice,
  { headline: string; what: string }
> = {
  reported: {
    headline: "Tu aviso ya está en el taller",
    what: "Guarda este código: con él sigues el caso sin cuenta del taller, y es lo que hay que decir si llamas para preguntar. El taller lo revisará y te avisará cuando cambie de estado.",
  },
  assigned: {
    headline: "Ya hay un técnico a cargo",
    what: "El taller ha puesto tu aviso en manos de un técnico, que se encargará de revisarlo.",
  },
  workshop: {
    headline: "El equipo ha entrado en el taller",
    what: "El equipo no se puede reparar en el sitio: se ha trasladado al taller para trabajar en él.",
  },
  waitingParts: {
    headline: "El taller está esperando repuestos",
    what: "Para arreglarlo hace falta una pieza que el taller no tiene y ha pedido. El caso sigue abierto: el trabajo continúa en cuanto llegue el material.",
  },
  repairing: {
    headline: "Ya está el material: el equipo está en reparación",
    what: "Ha llegado lo que faltaba y el técnico lo tiene en sus manos: el trabajo del equipo continúa con la pieza puesta.",
  },
  resolved: {
    headline: "Tu incidencia se ha resuelto",
    what: "El taller ha dado el caso por resuelto y lo ha cerrado.",
  },
  unresolved: {
    headline: "Tu incidencia se ha cerrado sin resolución",
    what: "El taller ha cerrado el caso sin poder resolverlo. Si el problema sigue ahí, avisa otra vez.",
  },
  withdrawn: {
    headline: "Tu incidencia se ha retirado de la lista",
    what: "El taller la ha retirado: es lo que se hace con los avisos equivocados o con los que se notificaron dos veces. No se ha borrado nada, pero mientras esté retirada tu código ya no cuenta el caso.",
  },
};

/** El nombre de pila, que es como se saluda a alguien en un correo. */
export function reporterFirstName(name: string): string {
  const first = name.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : "hola";
}

/** Escapa lo que va dentro del HTML del correo. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** La dirección pública de la app, sin barra final, o null si no se conoce. */
function appBase(appUrl: string | null | undefined): string | null {
  const url = appUrl?.trim();
  return url ? url.replace(/\/+$/, "") : null;
}

/**
 * El enlace para seguir el caso: la consulta del código con el código ya puesto
 * —`/seguimiento?codigo=A7K2QX9M`—, para que al invitado no le toque teclearlo
 * mirando el correo. Va sin los guiones: en una dirección sobran, y la consulta
 * los quita igualmente si alguien pega el que se lee.
 *
 * Y va a la página pública de seguimiento, no al panel: quien recibe el correo no
 * tiene cuenta, y llevarlo a una pantalla de acceso para enseñarle el estado de su
 * propio aviso sería pedirle un paso de más.
 */
export function incidentTrackingLink(
  code: string,
  appUrl?: string | null,
): string | null {
  const base = appBase(appUrl);
  if (base === null) return null;
  return `${base}/seguimiento?codigo=${encodeURIComponent(code)}`;
}

/**
 * Cómo va el aviso a quien notificó, contado para la ficha del taller. El
 * envío se anota en la incidencia (`convex/incidentMail`) y esto es lo que el
 * panel enseña: que el correo salió, que no había a quién avisar o por qué no
 * se pudo mandar —que es lo que hay que saber para arreglarlo—, en vez de
 * dejar el motivo perdido en un registro que nadie mira.
 */
export function reporterNoticeText(input: {
  reporterEmail?: string | null;
  emailedAt?: number | null;
  emailError?: string | null;
}): string {
  const email = input.reporterEmail?.trim();
  if (!email) {
    return "Sin correo: al notificar no lo dejó, así que no hay a quién avisar.";
  }
  if (input.emailError) return `No se pudo enviar: ${input.emailError}`;
  if (input.emailedAt) {
    return `Enviado a ${email} el ${formatDate(input.emailedAt)}.`;
  }
  return `Se le enviará su código a ${email}.`;
}

/** Lo que hace falta saber de la incidencia para escribirle a quien la notificó. */
export interface IncidentMailInput {
  /** El código de seguimiento de la incidencia, en su forma canónica. */
  code: string;
  reporterName: string;
  /**
   * Lo que se le cuenta: el estado nuevo que acaba de quedar en la ficha, o la
   * retirada a la papelera.
   */
  notice: string;
  equipmentKind?: string | null;
  model?: string | null;
  location?: string | null;
  /** Cuándo lo notificó, para situarlo en el correo. */
  reportedAt: number;
  /** Quién lo lleva ahora: el técnico y, si ha pasado por taller, su responsable. */
  assigneeName?: string | null;
  workshopAssigneeName?: string | null;
  /** La dirección pública de la app (`SITE_URL`), para el enlace de seguimiento. */
  appUrl?: string | null;
}

export interface IncidentEmail {
  subject: string;
  text: string;
  html: string;
}

/**
 * El correo tal y como sale: asunto, texto plano y HTML. El texto es el cuerpo de
 * verdad —se lee en cualquier cliente— y el HTML solo lo maqueta, con el mismo
 * contenido.
 */
export function renderIncidentMail(input: IncidentMailInput): IncidentEmail {
  const notice = mailNotice(input.notice);
  // Un aviso que no se cuenta (una corrección, un paso intermedio) no tiene
  // correo que componer: quien llama decide con `mailNotice` antes.
  if (notice === null) {
    throw new Error(`El aviso «${input.notice}» no se cuenta por correo.`);
  }
  const withdrawn = isWithdrawnNotice(notice);
  // El alta tampoco cuenta un estado nuevo: la incidencia nace con el que tiene,
  // y «Nueva» no es una noticia que darle a quien acaba de avisar.
  const receipt = notice === INCIDENT_INTAKE_NOTICE;
  // La retirada no es un estado: la incidencia sigue en el que estaba, así que
  // no hay etiqueta de estado que enseñar ni caso que seguir con la referencia.
  const meta = withdrawn || receipt ? null : INCIDENT_STATUS_META[notice];
  const copy = NOTICE_MAIL_TEXT[notice];
  // El código se enseña en dos grupos porque es lo que se dicta y se teclea:
  // quien lee el correo lo copia tal cual en la consulta.
  const code = formatPublicCode(input.code);
  const subject = `${code} · ${copy.headline}`;
  const equipment = [input.equipmentKind, input.model]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
  // En una retirada no se dice quién la lleva: ya no la lleva nadie del taller.
  const onIt = withdrawn
    ? null
    : (input.workshopAssigneeName ?? input.assigneeName ?? null);
  const link = withdrawn
    ? null
    : incidentTrackingLink(input.code, input.appUrl);

  const lines = [
    `Hola, ${reporterFirstName(input.reporterName)}:`,
    "",
    withdrawn
      ? `Tu incidencia ${code} ya no se sigue desde el taller.`
      : receipt
        ? `Hemos recibido tu aviso. Este es tu código: ${code}.`
        : `Tu incidencia ${code} ha cambiado de estado.`,
    "",
    ...(meta ? [`ESTADO: ${meta.label}`] : []),
    copy.what,
    "",
    ...(equipment ? [`Equipo: ${equipment}`] : []),
    ...(input.location ? [`Dónde: ${input.location}`] : []),
    ...(onIt ? [`Lo lleva: ${onIt}`] : []),
    `La notificaste el ${formatDate(input.reportedAt)}.`,
    "",
    // Con la incidencia retirada no hay seguimiento que ofrecer —el código ya no
    // contesta—, así que se le dice lo que puede hacer: volver a avisar.
    ...(withdrawn
      ? [
          "Si el problema sigue ahí, vuelve a notificarlo: se te dará un código nuevo.",
        ]
      : [
          "Con tu código puedes ver en qué punto va el caso, sin cuenta del taller:",
          ...(link ? [link] : [`Entra en la aplicación y consulta ${code}.`]),
        ]),
    "",
    "Pulso Taller · Repuestos de equipo audiovisual",
    "Este aviso es automático: no hace falta responder a este correo.",
  ];
  const text = lines.join("\n");

  const facts = [
    ...(equipment ? [["Equipo", equipment]] : []),
    ...(input.location ? [["Dónde", input.location]] : []),
    ...(onIt ? [["Lo lleva", onIt]] : []),
    ["Notificada", formatDate(input.reportedAt)],
  ];
  const html = [
    `<h1 style="font-size:18px;margin:0 0 4px">${
      withdrawn
        ? `Tu incidencia ${escapeHtml(code)} ya no se sigue desde el taller`
        : receipt
          ? `Hemos recibido tu aviso: ${escapeHtml(code)}`
          : `Tu incidencia ${escapeHtml(code)} ha cambiado de estado`
    }</h1>`,
    `<p style="margin:0 0 16px;color:#555">${escapeHtml(copy.headline)}</p>`,
    ...(meta
      ? [
          `<p style="margin:0 0 8px"><strong>Estado:</strong> ${escapeHtml(meta.label)}</p>`,
        ]
      : []),
    `<p style="margin:0 0 16px">${escapeHtml(copy.what)}</p>`,
    `<ul style="margin:0 0 16px;padding-left:18px">`,
    ...facts.map(
      ([label, value]) =>
        `<li style="margin:2px 0">${escapeHtml(label)}: ${escapeHtml(value)}</li>`,
    ),
    `</ul>`,
    withdrawn
      ? `<p style="margin:0 0 16px">Si el problema sigue ahí, vuelve a notificarlo: se te dará un código nuevo.</p>`
      : link
        ? `<p style="margin:0 0 8px">Puedes ver en qué punto va el caso con tu código, sin cuenta del taller:</p><p style="margin:0 0 16px"><a href="${escapeHtml(
            link,
          )}">Seguir la incidencia ${escapeHtml(code)}</a></p>`
        : `<p style="margin:0 0 16px">Entra en la aplicación y consulta ${escapeHtml(
            code,
          )}.</p>`,
    `<p style="margin:0;color:#555;font-size:12px">Pulso Taller · Repuestos de equipo audiovisual<br>Este aviso es automático: no hace falta responder a este correo.</p>`,
  ].join("\n");

  return { subject, text, html };
}

/**
 * Los avisos que el taller recibe de sus propias incidencias: cuando entra, cuando
 * se asigna y cuando se cierra. Son los mismos cuatro momentos que se le cuentan
 * a quien notificó —menos la retirada, que es cosa de la papelera— vistos desde
 * dentro.
 */
export const INCIDENT_STAFF_NOTICES = [
  "reported",
  "assigned",
  "resolved",
  "unresolved",
] as const;

export type IncidentStaffNotice = (typeof INCIDENT_STAFF_NOTICES)[number];

/**
 * ¿Merece este estado un aviso interno? Ni la verificación ni los pasos de taller
 * se reparten al equipo: el aviso es de las tres cosas que cambian el caso de
 * manos —entra, se asigna, se cierra—, y de las demás ya se entera quien trabaja
 * en él.
 */
export function staffMailNotice(value: string): IncidentStaffNotice | null {
  return (INCIDENT_STAFF_NOTICES as readonly string[]).includes(value)
    ? (value as IncidentStaffNotice)
    : null;
}

/** Lo que se dice en cada momento, en una frase. */
const STAFF_NOTICE_COPY: Record<
  IncidentStaffNotice,
  { title: string; intro: string; action: string }
> = {
  reported: {
    title: "Nueva incidencia",
    intro: "Ha entrado un aviso que el taller todavía no ha asignado.",
    action: "Ábrela en el panel para asignarla.",
  },
  assigned: {
    title: "Incidencia asignada",
    intro: "El caso ya tiene técnico: sale de la cola de asignación.",
    action: "Ábrela en el panel para ver el parte.",
  },
  resolved: {
    title: "Incidencia resuelta",
    intro: "El caso se ha cerrado como resuelto.",
    action: "Ábrela en el panel para ver lo que se hizo.",
  },
  unresolved: {
    title: "Incidencia cerrada sin resolución",
    intro: "El caso se ha cerrado sin resolución.",
    action: "Ábrela en el panel para ver por qué.",
  },
};

/**
 * Lo que hace falta para el aviso interno: la incidencia contada al taller y no a
 * quien la notificó.
 */
export interface IncidentStaffMailInput {
  /** Qué ha pasado: el alta, la asignación o el cierre. */
  notice: IncidentStaffNotice;
  /** La referencia interna: la que el taller se cita («la INC-0004»). */
  reference: string;
  reporterName: string;
  equipmentKind?: string | null;
  model?: string | null;
  location?: string | null;
  description: string;
  reportedAt: number;
  /** Quién la lleva: el técnico de la calle o, en taller, el de la orden. */
  assigneeName?: string | null;
  workshopAssigneeName?: string | null;
  /** La dirección pública de la app (`SITE_URL`), para el enlace al panel. */
  appUrl?: string | null;
}

/** Lo que se enseña de la descripción: un correo no es la ficha entera. */
export const MAX_STAFF_MAIL_DESCRIPTION = 600;

/**
 * El aviso interno de una incidencia, para los roles que lo piden.
 *
 * No es el correo de quien notificó: aquel lleva su código y le habla de tú a tú
 * a alguien de fuera. Este es para el taller —referencia interna, equipo, dónde,
 * quién la lleva y el enlace al panel—, y no lleva el código a propósito: el
 * código es la llave de seguimiento del invitado y no pinta nada repartiéndolo
 * por correo entre las cuentas del taller.
 *
 * La descripción solo viaja en el alta, y recortada: es cuando de verdad hace
 * falta decidir si hay que entrar ahora. En la asignación y el cierre, lo que se
 * quiere saber es quién la lleva y cómo acabó, y eso cabe en dos líneas.
 */
export function renderIncidentStaffMail(
  input: IncidentStaffMailInput,
): IncidentEmail {
  const copy = STAFF_NOTICE_COPY[input.notice];
  const equipment = [input.equipmentKind, input.model]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
  const description = input.description.replace(/\s+/g, " ").trim();
  const what =
    description.length > MAX_STAFF_MAIL_DESCRIPTION
      ? `${description.slice(0, MAX_STAFF_MAIL_DESCRIPTION).trimEnd()}…`
      : description;
  const onIt = input.workshopAssigneeName ?? input.assigneeName ?? null;
  const base = appBase(input.appUrl);
  const panel = base === null ? null : `${base}/dashboard`;
  const subject = `${copy.title} · ${input.reference}${
    equipment ? ` · ${equipment}` : ""
  }`;

  const facts: [string, string][] = [
    ...(equipment ? [["Equipo", equipment] as [string, string]] : []),
    ...(input.location
      ? [["Dónde", input.location.trim()] as [string, string]]
      : []),
    ...(onIt ? [["Lo lleva", onIt.trim()] as [string, string]] : []),
    ["La notificó", input.reporterName.trim()],
    // La fecha es la del aviso, no la del correo: en la asignación y el cierre
    // sigue siendo la misma, y «notificada el» no se confunde con el cierre.
    ["Notificada el", formatDate(input.reportedAt)],
  ];

  const text = [
    copy.intro,
    "",
    `REFERENCIA: ${input.reference}`,
    ...facts.map(([label, value]) => `${label}: ${value}`),
    ...(input.notice === "reported" && what !== ""
      ? ["", "Lo que cuenta:", what]
      : []),
    "",
    panel ? `${copy.action} ${panel}` : copy.action,
    "",
    "Pulso Taller · Repuestos de equipo audiovisual",
    "Este aviso es automático: no hace falta responder a este correo.",
  ].join("\n");

  const html = [
    `<h1 style="font-size:18px;margin:0 0 4px">${escapeHtml(
      copy.title,
    )} ${escapeHtml(input.reference)}</h1>`,
    `<p style="margin:0 0 16px;color:#555">${escapeHtml(copy.intro)}</p>`,
    `<ul style="margin:0 0 16px;padding-left:18px">`,
    ...facts.map(
      ([label, value]) =>
        `<li style="margin:2px 0">${escapeHtml(label)}: ${escapeHtml(value)}</li>`,
    ),
    `</ul>`,
    ...(input.notice === "reported" && what !== ""
      ? [
          `<p style="margin:0 0 4px"><strong>Lo que cuenta</strong></p>`,
          `<p style="margin:0 0 16px">${escapeHtml(what)}</p>`,
        ]
      : []),
    panel
      ? `<p style="margin:0 0 16px"><a href="${escapeHtml(
          panel,
        )}">Abrir el panel del taller</a></p>`
      : `<p style="margin:0 0 16px">${escapeHtml(copy.action)}</p>`,
    `<p style="margin:0;color:#555;font-size:12px">Pulso Taller · Repuestos de equipo audiovisual<br>Este aviso es automático: no hace falta responder a este correo.</p>`,
  ].join("\n");

  return { subject, text, html };
}
