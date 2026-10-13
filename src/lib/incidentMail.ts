/**
 * El aviso por correo a quien notificó una incidencia.
 *
 * Quien avisa de una avería no tiene cuenta en el taller: se le da una
 * referencia —«Incidencia INC-0004 registrada»— y con ella sigue el caso. Este
 * correo es el otro extremo de esa referencia: cuando el caso cambia de estado,
 * se le cuenta lo que ha pasado, sin que tenga que volver a mirar.
 *
 * Aquí vive solo el texto, para poder probarlo sin servidor. El envío, que
 * necesita la pasarela de la plataforma, está en `convex/incidentMail`.
 *
 * Dos reglas que no son de estilo:
 *
 * - **Lo que sale es lo que se le enseña al invitado.** Ni notas internas, ni
 *   quién dio cada paso, ni el cuaderno del taller: lo mismo que ve al consultar
 *   su referencia (`incidents.byReference`). Un correo no puede ser la puerta de
 *   atrás del expediente.
 * - **Solo se avisa de lo que le importa:** que alguien se haya hecho cargo, que
 *   el equipo haya entrado en taller y que el caso se haya cerrado. Ni los pasos
 *   intermedios ni las correcciones de una nota son cosas de quien notificó.
 */

import { INCIDENT_STATUS_META, formatDate } from "./workshop";

/** Los cambios de estado que se le cuentan a quien notificó. */
export const INCIDENT_MAIL_STATUSES = [
  "assigned",
  "workshop",
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
 * ¿Tiene forma de correo? Solo comprueba que se pueda escribir a esa dirección:
 * que exista lo dice el envío, no una expresión regular. Lo que deja fuera son
 * los erratas de dedo —un correo sin arroba o sin dominio—, que es lo que de
 * verdad se cuela cuando alguien rellena un formulario con prisa.
 */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Lo que pasa, contado para quien no es del taller: la frase que encabeza el
 * correo y la que explica el cambio. Ni «verificada» ni «derivada»: el vocabulario
 * del taller se queda en el taller.
 */
const NOTICE_MAIL_TEXT: Record<
  IncidentMailNotice,
  { headline: string; what: string }
> = {
  assigned: {
    headline: "Ya hay un técnico a cargo",
    what: "El taller ha puesto tu aviso en manos de un técnico, que se encargará de revisarlo.",
  },
  workshop: {
    headline: "El equipo ha entrado en el taller",
    what: "El equipo no se puede reparar en el sitio: se ha trasladado al taller para trabajar en él.",
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
    what: "El taller la ha retirado: es lo que se hace con los avisos equivocados o con los que se notificaron dos veces. No se ha borrado nada, pero mientras esté retirada tu referencia ya no cuenta el caso.",
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
 * El enlace para seguir el caso: la consulta de la referencia con el número ya
 * puesto —`/dashboard?referencia=INC-0004`—, para que al invitado no le toque
 * teclearlo mirando el correo.
 */
export function incidentTrackingLink(
  reference: string,
  appUrl?: string | null,
): string | null {
  const base = appBase(appUrl);
  if (base === null) return null;
  return `${base}/dashboard?referencia=${encodeURIComponent(reference)}`;
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
  return `Se avisará a ${email} en cuanto el caso cambie de estado.`;
}

/** Lo que hace falta saber de la incidencia para escribirle a quien la notificó. */
export interface IncidentMailInput {
  reference: string;
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
  // La retirada no es un estado: la incidencia sigue en el que estaba, así que
  // no hay etiqueta de estado que enseñar ni caso que seguir con la referencia.
  const meta = withdrawn ? null : INCIDENT_STATUS_META[notice];
  const copy = NOTICE_MAIL_TEXT[notice];
  const subject = `${input.reference} · ${copy.headline}`;
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
    : incidentTrackingLink(input.reference, input.appUrl);

  const lines = [
    `Hola, ${reporterFirstName(input.reporterName)}:`,
    "",
    withdrawn
      ? `Tu incidencia ${input.reference} ya no se sigue desde el taller.`
      : `Tu incidencia ${input.reference} ha cambiado de estado.`,
    "",
    ...(meta ? [`ESTADO: ${meta.label}`] : []),
    copy.what,
    "",
    ...(equipment ? [`Equipo: ${equipment}`] : []),
    ...(input.location ? [`Dónde: ${input.location}`] : []),
    ...(onIt ? [`Lo lleva: ${onIt}`] : []),
    `La notificaste el ${formatDate(input.reportedAt)}.`,
    "",
    // Con la incidencia retirada no hay seguimiento que ofrecer —la referencia
    // ya no contesta—, así que se le dice lo que puede hacer: volver a avisar.
    ...(withdrawn
      ? [
          "Si el problema sigue ahí, vuelve a notificarlo: se te dará una referencia nueva.",
        ]
      : [
          "Con tu referencia puedes ver en qué punto va el caso, sin cuenta del taller:",
          ...(link
            ? [link]
            : [`Entra en la aplicación y consulta ${input.reference}.`]),
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
        ? `Tu incidencia ${escapeHtml(input.reference)} ya no se sigue desde el taller`
        : `Tu incidencia ${escapeHtml(input.reference)} ha cambiado de estado`
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
      ? `<p style="margin:0 0 16px">Si el problema sigue ahí, vuelve a notificarlo: se te dará una referencia nueva.</p>`
      : link
        ? `<p style="margin:0 0 8px">Puedes ver en qué punto va el caso con tu referencia, sin cuenta del taller:</p><p style="margin:0 0 16px"><a href="${escapeHtml(
            link,
          )}">Seguir la incidencia ${escapeHtml(input.reference)}</a></p>`
        : `<p style="margin:0 0 16px">Entra en la aplicación y consulta ${escapeHtml(
            input.reference,
          )}.</p>`,
    `<p style="margin:0;color:#555;font-size:12px">Pulso Taller · Repuestos de equipo audiovisual<br>Este aviso es automático: no hace falta responder a este correo.</p>`,
  ].join("\n");

  return { subject, text, html };
}
