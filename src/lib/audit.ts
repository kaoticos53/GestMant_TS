/**
 * Herramientas del módulo de auditoría: con qué filtros el administrador
 * recorre el rastro de documentos de todas las incidencias (persona, fechas y
 * tipo de movimiento) y cómo se resume lo que está viendo.
 *
 * Viven aquí, fuera del componente y del backend, para poder probarlas sin
 * navegador. El filtrado real lo hace la consulta `incidents.documentAudit`
 * sobre los índices de la tabla; esto solo traduce lo que se elige en pantalla
 * a argumentos de consulta y a frases legibles.
 */

import type { Id } from "../convex/_generated/dataModel";
import { startOfDay } from "./browse";
import type { CsvCell } from "./export";
import type { RoleKey } from "./roles";
import {
  INCIDENT_STATUS_META,
  formatDateTime,
  type DocumentTrailAction,
  type IncidentStatus,
} from "./workshop";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AuditFilters {
  /** Persona que hizo el movimiento (`null` = todas). */
  userId: Id<"users"> | null;
  /** Primer día incluido, como valor de <input type="date"> ("" = sin tope). */
  from: string;
  /** Último día incluido ("" = sin tope). */
  to: string;
  /** Tipo de movimiento ("" = todos). */
  action: DocumentTrailAction | "";
}

export const EMPTY_AUDIT_FILTERS: AuditFilters = {
  userId: null,
  from: "",
  to: "",
  action: "",
};

/** Tipos de movimiento, en el orden en que se ofrecen como filtro. */
export const AUDIT_ACTIONS: { id: DocumentTrailAction; label: string }[] = [
  { id: "attached", label: "Altas" },
  { id: "edited", label: "Ediciones" },
  { id: "replaced", label: "Reemplazos" },
  { id: "removed", label: "Retiradas" },
];

/** Singular y plural de cada movimiento («1 alta», «3 altas»). */
const ACTION_NOUNS: Record<DocumentTrailAction, [string, string]> = {
  attached: ["alta", "altas"],
  edited: ["edición", "ediciones"],
  replaced: ["reemplazo", "reemplazos"],
  removed: ["retirada", "retiradas"],
};

/** «3 altas» / «1 edición», para el desglose del resumen. */
export function auditActionCount(
  action: DocumentTrailAction,
  count: number,
): string {
  const [one, many] = ACTION_NOUNS[action];
  return `${count} ${count === 1 ? one : many}`;
}

/** Atajos de periodo; «custom» es lo que se deduce, no un botón. */
export type AuditPresetId = "today" | "week" | "month" | "all" | "custom";

export const AUDIT_PRESETS: {
  id: Exclude<AuditPresetId, "custom">;
  label: string;
}[] = [
  { id: "today", label: "Hoy" },
  { id: "week", label: "Últimos 7 días" },
  { id: "month", label: "Últimos 30 días" },
  { id: "all", label: "Todo" },
];

/** Rango de fechas ya resuelto: `null` en un extremo = sin tope. */
export interface AuditRange {
  from: number | null;
  to: number | null;
}

/** Valor de <input type="date"> → medianoche local (o `null` si no vale). */
export function dayFromInput(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  // `Date` recoloca los días imposibles (31 de febrero → 3 de marzo): una fecha
  // así no es «ese día», así que se descarta en vez de ampliar el rango.
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date.getTime();
}

/** Timestamp → valor de <input type="date"> (AAAA-MM-DD en hora local). */
export function dayInputValue(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Último instante del día: el tope «hasta» incluye el día entero. */
export function endOfDay(timestamp: number): number {
  return startOfDay(timestamp) + DAY_MS - 1;
}

/** Rango de un atajo de periodo. */
export function auditPresetRange(
  preset: Exclude<AuditPresetId, "custom">,
  now: number = Date.now(),
): AuditRange {
  const day = startOfDay(now);
  if (preset === "today") return { from: day, to: endOfDay(now) };
  if (preset === "week") return { from: day - 6 * DAY_MS, to: endOfDay(now) };
  if (preset === "month") return { from: day - 29 * DAY_MS, to: endOfDay(now) };
  return { from: null, to: null };
}

/**
 * Rango efectivo de dos fechas escritas a mano. Si vienen cruzadas se ordenan
 * —lo pedido es el tramo que va de una a otra, no uno vacío— y el día final se
 * extiende hasta su último instante. Es genérico a propósito: lo usan tanto los
 * filtros de la auditoría como el lote de informes de un periodo.
 */
export function dayRange(from: string, to: string): AuditRange {
  const start = dayFromInput(from);
  const end = dayFromInput(to);
  if (start === null && end === null) return { from: null, to: null };
  if (start === null) return { from: null, to: endOfDay(end as number) };
  if (end === null) return { from: start, to: null };
  const [lo, hi] = start <= end ? [start, end] : [end, start];
  return { from: lo, to: endOfDay(hi) };
}

/** Rango efectivo de los filtros de auditoría escritos a mano. */
export function auditRange(filters: AuditFilters): AuditRange {
  return dayRange(filters.from, filters.to);
}

/** Qué atajo corresponde a un rango (o «custom» si no es ninguno). */
export function auditPresetOf(
  range: AuditRange,
  now: number = Date.now(),
): AuditPresetId {
  for (const preset of AUDIT_PRESETS) {
    const expected = auditPresetRange(preset.id, now);
    if (expected.from === range.from && expected.to === range.to) {
      return preset.id;
    }
  }
  return "custom";
}

/** Aplica un atajo de periodo a los filtros (escribe sus dos fechas). */
export function applyAuditPreset(
  filters: AuditFilters,
  preset: Exclude<AuditPresetId, "custom">,
  now: number = Date.now(),
): AuditFilters {
  const range = auditPresetRange(preset, now);
  return {
    ...filters,
    from: range.from === null ? "" : dayInputValue(range.from),
    to: range.to === null ? "" : dayInputValue(range.to),
  };
}

/** Argumentos de `incidents.documentAudit`; lo vacío se omite. */
export interface AuditQueryArgs {
  userId?: Id<"users">;
  from?: number;
  to?: number;
  action?: DocumentTrailAction;
}

export function auditQueryArgs(filters: AuditFilters): AuditQueryArgs {
  const range = auditRange(filters);
  return {
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(range.from === null ? {} : { from: range.from }),
    ...(range.to === null ? {} : { to: range.to }),
    ...(filters.action ? { action: filters.action } : {}),
  };
}

/** Cuántos filtros hay puestos (para el botón de reiniciar). */
export function auditFilterCount(filters: AuditFilters): number {
  const range = auditRange(filters);
  let count = 0;
  if (filters.userId) count += 1;
  if (range.from !== null || range.to !== null) count += 1;
  if (filters.action) count += 1;
  return count;
}

export interface AuditSummary {
  /** Movimientos que pasan el filtro. */
  total: number;
  /** Personas distintas que los firmaron. */
  people: number;
  /** Incidencias distintas afectadas. */
  incidents: number;
  byAction: Record<DocumentTrailAction, number>;
}

/** Recuento de lo que se está viendo: total, personas, incidencias y desglose. */
export function summarizeAudit(
  entries: readonly {
    action: DocumentTrailAction;
    byId: string;
    incidentId: string;
  }[],
): AuditSummary {
  const byAction: Record<DocumentTrailAction, number> = {
    attached: 0,
    edited: 0,
    replaced: 0,
    removed: 0,
  };
  const people = new Set<string>();
  const incidents = new Set<string>();
  for (const entry of entries) {
    byAction[entry.action] += 1;
    people.add(entry.byId);
    incidents.add(entry.incidentId);
  }
  return {
    total: entries.length,
    people: people.size,
    incidents: incidents.size,
    byAction,
  };
}

/* ------------------------------------------------------------------ */
/* Aviso por un movimiento del expediente                              */
/* ------------------------------------------------------------------ */

/**
 * Roles que reciben los avisos del expediente mientras no se configure otra
 * cosa: quien lo audita. Hoy la capacidad `viewAudit` está bloqueada y solo la
 * tiene el administrador, así que el reparto de partida es ese; desde «Ajustes
 * del taller» se puede añadir cualquier rol (la coordinación, por ejemplo) o
 * quitarlo. Sin nadie en la lista no avisa a nadie: el rastro completo sigue
 * leyéndose en el módulo de Auditoría.
 */
export const DEFAULT_AUDIT_ALERT_ROLES: readonly RoleKey[] = ["admin"];

/**
 * ¿Le toca a este rol recibir los avisos del expediente? Manda la lista
 * guardada, igual que en el aviso de trabajo sin constancia: es el reparto de
 * un aviso, no un permiso.
 */
export function auditAlertReachesRole(
  role: RoleKey | null | undefined,
  roleKeys: readonly RoleKey[],
): boolean {
  return role !== null && role !== undefined && roleKeys.includes(role);
}

/** Cómo se lee cada movimiento en el aviso: en pasado y sin sujeto. */
function moveWording(input: {
  action: DocumentTrailAction;
  name: string;
  previousName?: string;
}): string {
  if (input.action === "attached") return `se adjuntó «${input.name}»`;
  if (input.action === "removed") return `se retiró «${input.name}»`;
  if (input.action === "replaced") {
    return input.previousName
      ? `se reemplazó el archivo de «${input.previousName}» y se renombró a «${input.name}»`
      : `se reemplazó el archivo de «${input.name}»`;
  }
  return input.previousName
    ? `se renombró «${input.previousName}» a «${input.name}»`
    : `se editó «${input.name}»`;
}

/**
 * Aviso por un movimiento del expediente, o null si el movimiento es rutina y
 * no hay nada que contar. Lo reciben los roles configurados como destinatarios
 * (por defecto, quien audita). Se avisa de dos cosas:
 *
 * - Un movimiento que destruye el archivo de un documento —retirarlo o
 *   reemplazarlo—, en cualquier incidencia: el archivo anterior ya no está y su
 *   movimiento es la única constancia de quién lo quitó.
 * - Cualquier movimiento del expediente de una incidencia ya cerrada: el caso
 *   está terminado y su expediente no debería seguir cambiando.
 *
 * Una alta o una edición al día en una incidencia en curso no avisa a nadie.
 */
export function documentMoveAlert(input: {
  action: DocumentTrailAction;
  /** Referencia de la incidencia («INC-0007»). */
  reference: string;
  /** Nombre del documento después del movimiento. */
  name: string;
  /** Nombre anterior, cuando el movimiento fue un renombrado. */
  previousName?: string;
  /** La incidencia ya está cerrada (resuelta o sin resolución). */
  closed: boolean;
}): string | null {
  const destructive = input.action === "removed" || input.action === "replaced";
  if (!destructive && !input.closed) return null;
  return `Expediente de ${input.reference}${
    input.closed ? " (incidencia cerrada)" : ""
  } · ${moveWording(input)}`;
}

/* ------------------------------------------------------------------ */
/* Descarga del tramo filtrado en CSV                                   */
/* ------------------------------------------------------------------ */

/** El movimiento de una fila, en singular: «Alta», «Edición», «Retirada». */
export function auditActionLabel(action: DocumentTrailAction): string {
  const [one] = ACTION_NOUNS[action];
  return one.charAt(0).toUpperCase() + one.slice(1);
}

/** Campos del rastro que bastan para armar el CSV del tramo filtrado. */
export interface AuditCsvEntry {
  /** Referencia de la incidencia afectada (o «—» si ya no existe). */
  reference: string;
  /** Equipo de esa incidencia (tipo y modelo, como en la ficha). */
  title: string;
  /** Estado de la incidencia, si todavía se puede leer. */
  status?: IncidentStatus;
  /** Si la incidencia ya está en el archivo. */
  archived: boolean;
  action: DocumentTrailAction;
  /** Nombre del documento después del movimiento. */
  name: string;
  /** Nombre anterior, cuando el movimiento fue una edición. */
  previousName?: string;
  by: string;
  at: number;
}

/**
 * Cabecera y filas del CSV de auditoría: una fila por movimiento, en el mismo
 * orden en que se está leyendo la lista. Van juntas para que los títulos de las
 * columnas y lo que se escribe en cada una no se separen.
 */
export function auditCsvTable(entries: readonly AuditCsvEntry[]): {
  header: string[];
  rows: CsvCell[][];
} {
  const header = [
    "Fecha y hora",
    "Movimiento",
    "Persona",
    "Incidencia",
    "Equipo",
    "Estado",
    "Archivada",
    "Documento",
    "Documento anterior",
  ];
  const rows = entries.map((entry) => [
    formatDateTime(entry.at),
    auditActionLabel(entry.action),
    entry.by,
    entry.reference,
    entry.title,
    entry.status ? INCIDENT_STATUS_META[entry.status].label : "",
    entry.archived ? "Sí" : "No",
    entry.name,
    entry.previousName ?? "",
  ]);
  return { header, rows };
}

/** «3 de septiembre de 2026». */
function longDay(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** ¿Las dos fechas caen en el mismo mes y año? (para abreviar la frase). */
function sameMonth(from: number, to: number): boolean {
  const start = new Date(from);
  const end = new Date(to);
  return (
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear()
  );
}

/** Frase del periodo filtrado: usa el nombre del atajo cuando lo es. */
export function describeAuditRange(
  range: AuditRange,
  now: number = Date.now(),
): string {
  const preset = AUDIT_PRESETS.find(
    (item) => item.id === auditPresetOf(range, now),
  );
  if (preset) return preset.label;
  if (range.from === null && range.to === null) return "Todo el historial";
  if (range.from === null) return `Hasta el ${longDay(range.to as number)}`;
  if (range.to === null) return `Desde el ${longDay(range.from)}`;
  if (startOfDay(range.from) === startOfDay(range.to)) {
    return `El ${longDay(range.from)}`;
  }
  // Dentro del mismo mes no hace falta repetir el mes: «Del 3 al 9 de
  // septiembre de 2026».
  if (sameMonth(range.from, range.to)) {
    return `Del ${new Date(range.from).getDate()} al ${longDay(range.to)}`;
  }
  return `Del ${longDay(range.from)} al ${longDay(range.to as number)}`;
}
