/**
 * Reglas y ajustes del archivo, compartidos por el backend (el archivado a mano
 * y la pasada automática de cada noche) y la interfaz (las pantallas que
 * ajustan el archivo y cuentan lo que entraría). Tenerlo en un solo sitio evita
 * que la antigüedad que enseña la pantalla, lo que cuenta y lo que archiva de
 * verdad se vayan separando.
 */

import { isClosedIncident } from "./incidentFlow";
import { isRequestInMotion } from "./requestFlow";

/** Antigüedad con la que nace el archivado automático (meses). */
export const DEFAULT_AFTER_MONTHS = 12;

/** Límites razonables del ajuste. */
export const MIN_AFTER_MONTHS = 1;
export const MAX_AFTER_MONTHS = 120;

/** Antigüedades que ofrece la interfaz, en meses. */
export const AFTER_MONTHS_OPTIONS: { months: number; label: string }[] = [
  { months: 6, label: "Más de 6 meses" },
  { months: 12, label: "Más de 1 año" },
  { months: 24, label: "Más de 2 años" },
  { months: 36, label: "Más de 3 años" },
];

/**
 * Firma de quien archiva cuando lo hace la pasada automática de cada noche.
 * Vive aquí (y no en la lógica) porque la comparten el archivado del backend, la
 * carga de datos de ejemplo y el resumen semanal, que necesita distinguir lo
 * que se archivó solo de lo que movió alguien a mano.
 */
export const AUTO_ARCHIVE_BY = "Archivado automático";

/** Etiqueta de antigüedad, también para valores guardados a mano. */
export function afterMonthsLabel(months: number): string {
  const option = AFTER_MONTHS_OPTIONS.find((item) => item.months === months);
  if (option) return option.label;
  return months === 1 ? "Más de 1 mes" : `Más de ${months} meses`;
}

/* ------------------------------------------------------------------ */
/* Qué se archiva y qué no                                             */
/* ------------------------------------------------------------------ */

/* Las dos preguntas que decide este módulo —si una incidencia está cerrada y si
 * una petición sigue en movimiento— son de la máquina de cada flujo, no del
 * archivo: aquí solo se dan por sabidas. Vivían aquí, y una de ellas tenía además
 * una copia dentro de `convex/incidents.ts`; ahora hay una sola de cada. */

/** Lo mínimo que necesita la regla de archivo de una petición. */
export interface ArchivableRequest {
  status: string;
  issuedAt?: number;
  decidedAt?: number;
  quoteRequestedAt?: number;
  returnedAt?: number;
  holdSinceAt?: number;
  createdAt: number;
  archivedAt?: number;
}

/** Lo mínimo que necesita la regla de archivo de una incidencia. */
export interface ArchivableIncident {
  status: string;
  closedAt?: number;
  updatedAt: number;
  archivedAt?: number;
}

/**
 * Qué fecha decide la antigüedad de una petición: lo último que le pasó
 * (entrega, decisión, presupuesto pedido, devolución o entrada a espera) y, si
 * todavía no le pasó nada de eso, su alta. Una petición con movimiento reciente
 * no es una petición antigua, aunque se creara hace mucho.
 */
export function requestArchiveDate(request: ArchivableRequest): number {
  return (
    request.issuedAt ??
    request.decidedAt ??
    request.quoteRequestedAt ??
    request.returnedAt ??
    request.holdSinceAt ??
    request.createdAt
  );
}

/** Cuántas fichas entrarían en un archivado con ese corte, por tipo. */
export interface ArchivableCounts {
  incidents: number;
  requests: number;
  total: number;
}

/**
 * Cuántas fichas ya terminadas son anteriores al corte `before`. Es la cuenta
 * que enseñan las pantallas antes de archivar (y antes de la pasada de la
 * noche), con la misma regla que aplican el archivado a mano y el automático:
 * solo lo terminado y sin movimiento reciente. Lo ya archivado no cuenta.
 */
export function archivableBefore(input: {
  incidents: readonly ArchivableIncident[];
  requests: readonly ArchivableRequest[];
  before: number;
}): ArchivableCounts {
  const incidents = input.incidents.filter(
    (incident) =>
      incident.archivedAt === undefined &&
      isClosedIncident(incident.status) &&
      (incident.closedAt ?? incident.updatedAt) < input.before,
  ).length;
  const requests = input.requests.filter(
    (request) =>
      request.archivedAt === undefined &&
      !isRequestInMotion(request.status) &&
      requestArchiveDate(request) < input.before,
  ).length;
  return { incidents, requests, total: incidents + requests };
}
