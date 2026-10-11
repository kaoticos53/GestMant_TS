/**
 * Resumen semanal del taller: el correo que recoge lo que se trabajó durante la
 * semana, lo que quedó sin constancia y lo que se archivó.
 *
 * Se compone aquí, fuera de Convex y del navegador, para poder probarlo sin
 * servidor. El backend solo le pasa los documentos de la semana (incidencias y
 * peticiones) y quien decide es este módulo: qué cuenta como trabajo hecho, qué
 * sigue sin constancia —con la misma regla y el mismo margen que el aviso del
 * panel— y qué se fue al archivo, separando lo automático de lo que movió
 * alguien a mano.
 */

import { AUTO_ARCHIVE_BY } from "./archive";
import { COORDINATION_ROLES, type RoleKey } from "./roles";
import {
  DEFAULT_WORK_WITHOUT_TRACE_DAYS,
  INCIDENT_STATUS_META,
  STATUS_META,
  formatDate,
  formatDateTime,
  liveNotes,
  workWithoutTraceDays,
  type IncidentStatus,
  type RequestStatus,
} from "./workshop";

/** Días que cubre el resumen: la semana que acaba de terminar. */
export const WEEK_DAYS = 7;
export const WEEK_MS = WEEK_DAYS * 24 * 60 * 60 * 1000;

/** Días de la semana admitidos para el envío (1 = lunes … 7 = domingo). */
export const DEFAULT_WEEKLY_REPORT_WEEKDAY = 1;
export const MIN_WEEKDAY = 1;
export const MAX_WEEKDAY = 7;

/**
 * A quién le llega el resumen mientras no se configure otra cosa: a quien
 * coordina el taller, que es quien necesita ver la semana entera. Un rol
 * personalizado entra solo si se añade a mano.
 */
export const DEFAULT_WEEKLY_REPORT_ROLES: readonly RoleKey[] =
  COORDINATION_ROLES;

/** Nombres de los días, en el orden en que los enseña el selector. */
export const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
];

/**
 * Día de la semana en UTC con la numeración del selector (1 = lunes … 7 =
 * domingo). El cron va en UTC, así que el día se decide también ahí.
 */
export function utcWeekday(now: number = Date.now()): number {
  const day = new Date(now).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Etiqueta de un día de la semana; los valores raros se enseñan tal cual. */
export function weekdayLabel(weekday: number): string {
  return WEEKDAY_OPTIONS.find((item) => item.value === weekday)?.label ?? `Día ${weekday}`;
}

/** Cuántas líneas de detalle lleva cada sección antes de resumir el resto. */
export const MAX_DETAIL_LINES = 8;

/** Cuántos nombres entran en «quién movió el taller». */
export const MAX_WORKERS = 3;

/* ------------------------------------------------------------------ */
/* La semana que se resume                                             */
/* ------------------------------------------------------------------ */

export interface WeeklyWindow {
  /** Primer instante que entra en el resumen (incluido). */
  from: number;
  /** Momento del envío (incluido). */
  to: number;
  /** «29 sept 2026 – 5 oct 2026», para el asunto y la cabecera. */
  label: string;
}

/** La semana que termina ahora mismo: los últimos siete días, sin cortes raros. */
export function weeklyReportWindow(now: number = Date.now()): WeeklyWindow {
  const from = now - WEEK_MS;
  return { from, to: now, label: `${formatDate(from)} – ${formatDate(now)}` };
}

/**
 * Clave de la semana (una fila por semana): el día en que arranca la ventana.
 * Volver a enviar el mismo día actualiza esa misma fila en vez de acumular
 * resúmenes repetidos.
 */
export function weeklyReportKey(now: number = Date.now()): string {
  return `week-${new Date(now - WEEK_MS).toISOString().slice(0, 10)}`;
}

/* ------------------------------------------------------------------ */
/* Lo que entra en el resumen                                          */
/* ------------------------------------------------------------------ */

/** Lo que el resumen necesita de una incidencia. */
export interface WeeklyIncident {
  reference: string;
  status: IncidentStatus;
  equipmentKind?: string;
  model?: string;
  location?: string;
  reportedAt: number;
  assigneeId?: string;
  assigneeName?: string;
  workshopAssigneeId?: string;
  workshopAssigneeName?: string;
  closedAt?: number;
  archivedAt?: number;
  archivedBy?: string;
  history: { status: IncidentStatus; at: number; by?: string }[];
  lifecycleNotes?: {
    note: string;
    author: string;
    authorId?: string;
    at: number;
    deletedAt?: number;
  }[];
  documents?: { name: string; author?: string; createdAt: number }[];
}

/** Lo que el resumen necesita de una petición de repuestos. */
export interface WeeklyRequest {
  reference: string;
  status: RequestStatus;
  requesterName: string;
  createdAt: number;
  decidedAt?: number;
  issuedAt?: number;
  returnedAt?: number;
  archivedAt?: number;
  archivedBy?: string;
}

export interface WeeklyClosedLine {
  reference: string;
  equipment: string;
  status: IncidentStatus;
  at: number;
  by?: string;
}

export interface WeeklyArchivedLine {
  kind: "incident" | "request";
  reference: string;
  at: number;
  by?: string;
  automatic: boolean;
}

export interface WeeklyTraceLine {
  reference: string;
  status: IncidentStatus;
  assignee?: string;
  days: number;
}

export interface WeeklyDigest {
  window: WeeklyWindow;
  /** Margen con el que se decide qué sigue sin constancia (días). */
  marginDays: number;
  worked: {
    /** Incidencias con algún movimiento dentro de la semana. */
    incidentsTouched: number;
    statusChanges: number;
    notes: number;
    documents: number;
    resolved: number;
    unresolved: number;
    requestsDecided: number;
    requestsIssued: number;
    /** Peticiones que se movieron esta semana, por estado en que quedaron. */
    requestsByStatus: { status: RequestStatus; label: string; count: number }[];
    /** Cerradas de la semana, con su equipo, para poder enseñarlas en detalle. */
    closed: WeeklyClosedLine[];
    /** Quién movió el taller: cambios de estado y notas firmadas. */
    workers: { name: string; movements: number }[];
  };
  /** Trabajo en curso sin dejar rastro, con el margen configurado. */
  withoutTrace: WeeklyTraceLine[];
  archived: {
    incidents: number;
    requests: number;
    total: number;
    /** Cuántas fichas mandó al archivo la pasada automática. */
    automatic: number;
    /** Cuántas movió alguien a mano. */
    byHand: number;
    items: WeeklyArchivedLine[];
  };
}

/** ¿La marca cae dentro de la semana que se resume? */
function within(at: number | undefined | null, window: WeeklyWindow): boolean {
  return at !== undefined && at !== null && at >= window.from && at <= window.to;
}

/** Cuándo quedó en su estado actual (el último paso del historial con ese estado). */
function lastStatusAt(incident: WeeklyIncident): number | undefined {
  for (let index = incident.history.length - 1; index >= 0; index -= 1) {
    if (incident.history[index].status === incident.status) {
      return incident.history[index].at;
    }
  }
  return incident.closedAt;
}

/** «Cámara de estudio · HDC-3500», o cadena vacía si no se sabe el equipo. */
function equipmentLabelOf(incident: WeeklyIncident): string {
  return [incident.equipmentKind, incident.model]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" · ");
}

/**
 * Digest de la semana: se calcula sobre los documentos ya cargados (el backend
 * le pasa las colas vivas y el archivo, que son las que traen las marcas de
 * tiempo que hacen falta).
 */
export function weeklyDigest(input: {
  incidents: readonly WeeklyIncident[];
  requests: readonly WeeklyRequest[];
  now?: number;
  marginDays?: number;
}): WeeklyDigest {
  const now = input.now ?? Date.now();
  const window = weeklyReportWindow(now);
  // El mismo margen que el aviso del panel: lo que el resumen llama «sin
  // constancia» es exactamente lo que el aviso señala en la pantalla.
  const marginDays = input.marginDays ?? DEFAULT_WORK_WITHOUT_TRACE_DAYS;

  let statusChanges = 0;
  let notes = 0;
  let documents = 0;
  let incidentsTouched = 0;
  let resolved = 0;
  let unresolved = 0;
  const closed: WeeklyClosedLine[] = [];
  const movements = new Map<string, number>();

  const tally = (name: string | undefined) => {
    const clean = name?.trim();
    if (!clean) return;
    movements.set(clean, (movements.get(clean) ?? 0) + 1);
  };

  for (const incident of input.incidents) {
    const changes = incident.history.filter((entry) => within(entry.at, window));
    const written = liveNotes(incident.lifecycleNotes).filter((note) =>
      within(note.at, window),
    );
    const attached = (incident.documents ?? []).filter((document) =>
      within(document.createdAt, window),
    );

    statusChanges += changes.length;
    notes += written.length;
    documents += attached.length;
    for (const entry of changes) tally(entry.by);
    for (const note of written) tally(note.author);

    const closedInWindow = within(lastStatusAt(incident), window);
    if (closedInWindow && incident.status === "resolved") resolved += 1;
    if (closedInWindow && incident.status === "unresolved") unresolved += 1;
    if (closedInWindow) {
      closed.push({
        reference: incident.reference,
        equipment: equipmentLabelOf(incident),
        status: incident.status,
        at: lastStatusAt(incident) ?? incident.closedAt ?? now,
        by: incident.assigneeName,
      });
    }

    const touched =
      within(incident.reportedAt, window) ||
      changes.length > 0 ||
      written.length > 0 ||
      attached.length > 0;
    if (touched) incidentsTouched += 1;
  }

  const withoutTrace: WeeklyTraceLine[] = input.incidents
    .flatMap((incident) => {
      const days = workWithoutTraceDays(
        {
          status: incident.status,
          history: incident.history,
          assigneeId: incident.assigneeId,
          workshopAssigneeId: incident.workshopAssigneeId,
          lifecycleNotes: incident.lifecycleNotes,
        },
        now,
        marginDays,
      );
      if (days === null) return [];
      return [
        {
          reference: incident.reference,
          status: incident.status,
          assignee: incident.assigneeName ?? incident.workshopAssigneeName,
          days,
        },
      ];
    })
    .sort((a, b) => b.days - a.days);

  let requestsDecided = 0;
  let requestsIssued = 0;
  const movedRequests = new Map<RequestStatus, number>();
  for (const request of input.requests) {
    if (within(request.decidedAt, window)) requestsDecided += 1;
    if (within(request.issuedAt, window)) requestsIssued += 1;
    const moved =
      within(request.decidedAt, window) ||
      within(request.issuedAt, window) ||
      within(request.returnedAt, window);
    if (moved) {
      movedRequests.set(request.status, (movedRequests.get(request.status) ?? 0) + 1);
    }
  }
  // El estado con el que se quedaron, con el nombre que usa la cola de
  // peticiones: «entregadas», «en espera», «rechazadas»...
  const requestsByStatus = [...movedRequests.entries()]
    .map(([status, count]) => ({
      status,
      label: STATUS_META[status]?.label ?? status,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));

  const archivedItems: WeeklyArchivedLine[] = [
    ...input.incidents.flatMap((incident) =>
      within(incident.archivedAt, window)
        ? [
            {
              kind: "incident" as const,
              reference: incident.reference,
              at: incident.archivedAt ?? now,
              by: incident.archivedBy,
              automatic: incident.archivedBy === AUTO_ARCHIVE_BY,
            },
          ]
        : [],
    ),
    ...input.requests.flatMap((request) =>
      within(request.archivedAt, window)
        ? [
            {
              kind: "request" as const,
              reference: request.reference,
              at: request.archivedAt ?? now,
              by: request.archivedBy,
              automatic: request.archivedBy === AUTO_ARCHIVE_BY,
            },
          ]
        : [],
    ),
  ].sort((a, b) => b.at - a.at);

  const workers = [...movements.entries()]
    .map(([name, count]) => ({ name, movements: count }))
    .sort((a, b) => b.movements - a.movements || a.name.localeCompare(b.name, "es"))
    .slice(0, MAX_WORKERS);

  return {
    window,
    marginDays,
    worked: {
      incidentsTouched,
      statusChanges,
      notes,
      documents,
      resolved,
      unresolved,
      requestsDecided,
      requestsIssued,
      requestsByStatus,
      closed: closed.sort((a, b) => b.at - a.at),
      workers,
    },
    withoutTrace,
    archived: {
      incidents: archivedItems.filter((item) => item.kind === "incident").length,
      requests: archivedItems.filter((item) => item.kind === "request").length,
      total: archivedItems.length,
      automatic: archivedItems.filter((item) => item.automatic).length,
      byHand: archivedItems.filter((item) => !item.automatic).length,
      items: archivedItems,
    },
  };
}

/* ------------------------------------------------------------------ */
/* A quién le llega                                                    */
/* ------------------------------------------------------------------ */

/** Lo que hace falta saber de una persona para decidir si recibe el correo. */
export interface WeeklyRecipientSource {
  name?: string;
  email?: string;
  role?: string;
  active?: boolean;
  isAnonymous?: boolean;
}

/**
 * Correos que reciben el resumen: la gente en activo con alguno de los roles
 * elegidos. Sin repetidos (la misma dirección una sola vez), sin invitados y sin
 * cuentas dadas de baja o sin correo, que no pueden recibir nada.
 */
export function weeklyRecipients(
  users: readonly WeeklyRecipientSource[],
  roleKeys: readonly string[],
): string[] {
  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const user of users) {
    if (user.active === false || user.isAnonymous === true) continue;
    if (user.role === undefined || !roleKeys.includes(user.role)) continue;
    const email = user.email?.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push(email);
  }
  return recipients;
}

/* ------------------------------------------------------------------ */
/* El correo                                                           */
/* ------------------------------------------------------------------ */

export interface WeeklyEmail {
  subject: string;
  text: string;
  html: string;
}

/** Escapa lo que va dentro del HTML del correo. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** «5 incidencias», con el singular bien puesto. */
function count(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

/** «3 días», «1 día». */
function daysPhrase(days: number): string {
  return `${days} ${days === 1 ? "día" : "días"}`;
}

function workedLines(digest: WeeklyDigest): string[] {
  const { worked } = digest;
  if (
    worked.incidentsTouched === 0 &&
    worked.requestsDecided === 0 &&
    worked.requestsIssued === 0
  ) {
    return ["Semana sin movimientos registrados: ni incidencias tocadas ni peticiones decididas."];
  }
  const lines = [
    `- Incidencias con movimiento: ${worked.incidentsTouched} ` +
      `(${count(worked.statusChanges, "cambio de estado", "cambios de estado")}, ` +
      `${count(worked.notes, "nota", "notas")}, ${count(worked.documents, "documento", "documentos")})`,
    `- Cerradas: ${worked.resolved} con resolución · ${worked.unresolved} sin resolución`,
    `- Peticiones decididas: ${worked.requestsDecided} · entregadas: ${worked.requestsIssued}`,
  ];
  if (worked.requestsByStatus.length > 0) {
    lines.push(
      `- Peticiones que se movieron: ${worked.requestsByStatus
        .map((item) => `${item.count} ${item.label.toLowerCase()}`)
        .join(" · ")}`,
    );
  }
  if (worked.workers.length > 0) {
    lines.push(
      `- Quién movió el taller: ${worked.workers
        .map((worker) => `${worker.name} (${worker.movements})`)
        .join(", ")}`,
    );
  }
  for (const item of worked.closed.slice(0, MAX_DETAIL_LINES)) {
    lines.push(
      `  · ${item.reference}${item.equipment ? ` (${item.equipment})` : ""} · ${
        INCIDENT_STATUS_META[item.status].label
      }${item.by ? ` — ${item.by}` : ""}`,
    );
  }
  if (worked.closed.length > MAX_DETAIL_LINES) {
    lines.push(`  · y ${worked.closed.length - MAX_DETAIL_LINES} más cerradas.`);
  }
  return lines;
}

function traceLines(digest: WeeklyDigest): string[] {
  if (digest.withoutTrace.length === 0) {
    return [
      `Nada: no hay trabajo que lleve ${daysPhrase(
        digest.marginDays,
      )} o más en curso sin constancia.`,
    ];
  }
  const lines = [
    `${count(
      digest.withoutTrace.length,
      "incidencia lleva",
      "incidencias llevan",
    )} ${daysPhrase(digest.marginDays)} o más en curso sin que su técnico anote nada:`,
  ];
  for (const item of digest.withoutTrace.slice(0, MAX_DETAIL_LINES)) {
    lines.push(
      `  · ${item.reference} · ${INCIDENT_STATUS_META[item.status].label}${
        item.assignee ? ` · ${item.assignee}` : ""
      } · ${count(item.days, "día", "días")} en curso`,
    );
  }
  if (digest.withoutTrace.length > MAX_DETAIL_LINES) {
    lines.push(
      `  · y ${digest.withoutTrace.length - MAX_DETAIL_LINES} más esperando en la cola.`,
    );
  }
  return lines;
}

function archivedLines(digest: WeeklyDigest): string[] {
  const { archived } = digest;
  if (archived.total === 0) {
    return ["Sin fichas nuevas en el archivo esta semana."];
  }
  const lines = [
    `- ${count(archived.total, "ficha", "fichas")} al archivo: ` +
      `${count(archived.incidents, "incidencia", "incidencias")} y ` +
      `${count(archived.requests, "petición", "peticiones")}` +
      ` (${archived.automatic} automáticas, ${archived.byHand} a mano)`,
  ];
  for (const item of archived.items.slice(0, MAX_DETAIL_LINES)) {
    lines.push(
      `  · ${item.reference} · ${formatDateTime(item.at)} · ${item.automatic ? AUTO_ARCHIVE_BY : item.by || "a mano"}`,
    );
  }
  if (archived.items.length > MAX_DETAIL_LINES) {
    lines.push(`  · y ${archived.items.length - MAX_DETAIL_LINES} más.`);
  }
  return lines;
}

/** Enlace sencillo a la app, si se conoce su dirección pública. */
function appLink(appUrl?: string | null): string | null {
  const url = appUrl?.trim();
  if (!url) return null;
  return url.replace(/\/+$/, "");
}

/**
 * El correo tal y como sale: asunto, texto plano y HTML. El texto es el cuerpo
 * de verdad (se lee en cualquier cliente) y el HTML solo lo maqueta.
 */
export function renderWeeklyReport(
  digest: WeeklyDigest,
  options: { appUrl?: string | null; recipients?: readonly string[] } = {},
): WeeklyEmail {
  const subject = `Resumen semanal del taller · ${digest.window.label}`;
  const sections: { title: string; lines: string[] }[] = [
    { title: "Lo que se trabajó", lines: workedLines(digest) },
    { title: "Sin constancia", lines: traceLines(digest) },
    { title: "Archivado", lines: archivedLines(digest) },
  ];

  const link = appLink(options.appUrl);
  const footer = [
    "Pulso Taller · Repuestos de equipo audiovisual",
    "Resumen generado automáticamente; recoge solo lo registrado en la aplicación.",
    link ? `Panel del taller: ${link}` : null,
  ].filter((line): line is string => line !== null);

  const text = [
    "RESUMEN SEMANAL DEL TALLER",
    digest.window.label,
    "",
    ...sections.flatMap((section) => [
      section.title.toUpperCase(),
      ...section.lines,
      "",
    ]),
    ...footer,
    "",
  ].join("\n");

  const html = [
    `<h1 style="font-size:18px;margin:0 0 4px">Resumen semanal del taller</h1>`,
    `<p style="margin:0 0 16px;color:#555">${escapeHtml(digest.window.label)}</p>`,
    ...sections.map(
      (section) =>
        `<h2 style="font-size:15px;margin:16px 0 6px">${escapeHtml(
          section.title,
        )}</h2>\n<ul style="margin:0;padding-left:18px">\n${section.lines
          .map((line) => {
            const bullet = line.startsWith("- ");
            const text2 = bullet ? line.slice(2) : line;
            return `<li style="margin:2px 0">${escapeHtml(text2)}</li>`;
          })
          .join("\n")}\n</ul>`,
    ),
    `<p style="margin:16px 0 0;color:#555;font-size:12px">${footer
      .map(escapeHtml)
      .join("<br>")}</p>`,
  ].join("\n");

  return { subject, text, html };
}
