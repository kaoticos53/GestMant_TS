import { COORDINATION_ROLES, type RoleKey } from "../roles";
import { formatDate, type IncidentStatus, type RequestStatus } from "../workshop";

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

/** Cuántas semanas enseña el histórico del panel, de la más nueva a la más vieja. */
export const WEEKLY_REPORT_HISTORY_LIMIT = 6;

/** Cuántas líneas de detalle lleva cada sección antes de resumir el resto. */
export const MAX_DETAIL_LINES = 8;

/** Cuántos nombres entran en «quién movió el taller». */
export const MAX_WORKERS = 3;

export interface WeeklyWindow {
  /** Primer instante que entra en el resumen (incluido). */
  from: number;
  /** Momento del envío (incluido). */
  to: number;
  /** «29 sept 2026 – 5 oct 2026», para el asunto y la cabecera. */
  label: string;
}

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

export interface WeeklyEmail {
  subject: string;
  text: string;
  html: string;
}

export interface WeeklyRecipientSource {
  name?: string;
  email?: string;
  role?: string;
  active?: boolean;
  isAnonymous?: boolean;
}

export interface WeeklyReportSource {
  incidents: readonly WeeklyIncident[];
  requests: readonly WeeklyRequest[];
  recipients: readonly string[];
  marginDays?: number;
}

export interface WeeklyReport {
  /** Una fila por semana: reenviar el mismo día actualiza esa misma. */
  key: string;
  from: number;
  to: number;
  /** «01 oct 2026 – 08 oct 2026», para el asunto y la cabecera. */
  windowLabel: string;
  marginDays: number;
  subject: string;
  text: string;
  html: string;
  recipients: string[];
  /** Los tres números de la cabecera: trabajo, sin constancia y archivo. */
  summary: {
    touched: number;
    withoutTrace: number;
    archived: number;
  };
}

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

/**
 * El día del resumen tal y como se guarda: el número redondeado, o `null` si no
 * es un día de la semana.
 */
export function weeklyReportWeekday(value: number): number | null {
  const day = Math.round(value);
  if (!Number.isFinite(day) || day < MIN_WEEKDAY || day > MAX_WEEKDAY) {
    return null;
  }
  return day;
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

/**
 * ¿Entra esta ficha en el resumen? Lo retirado no: se retiró por duplicado o por
 * equivocado, así que no es trabajo del taller ni caso abierto.
 */
export function countsInWeeklyReport(row: { deletedAt?: number }): boolean {
  return row.deletedAt === undefined;
}

/**
 * Correos que reciben el resumen: la gente en activo con alguno de los roles
 * elegidos. Sin repetidos (la misma dirección una sola vez), sin invitados y sin
 * cuentas dadas de baja o sin correo.
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

/**
 * ¿Por qué no se puede mandar el resumen? Sin destinatarios no hay a quién.
 */
export function weeklyDeliveryBlocker(
  recipients: readonly string[],
): string | null {
  return recipients.length === 0
    ? "Ningún rol de la lista tiene personas en activo con correo: añade destinatarios antes de enviar el resumen."
    : null;
}

/**
 * La decisión de la pasada diaria del cron: si hoy toca enviar y, si no, por qué
 * no.
 */
export function weeklyScheduleDecision(
  schedule: { enabled: boolean; weekday: number },
  now: number = Date.now(),
): { send: boolean; reason: string } {
  if (!schedule.enabled) {
    return { send: false, reason: "El resumen está apagado." };
  }
  if (utcWeekday(now) !== schedule.weekday) {
    return { send: false, reason: "Hoy no es el día configurado." };
  }
  return { send: true, reason: "Enviado." };
}
