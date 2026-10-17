/**
 * Las cifras públicas del taller: cómo se cuentan y cómo se leen.
 *
 * La portada enseña cuatro números del taller, y aquí está lo único que decide
 * qué significan. Son funciones puras —sin React ni Convex, como todo `lib/`—
 * porque las usan los dos lados: el backend cuenta la foto y la portada la
 * formatea. Así la regla de la media y la del redondeo no se pueden separar.
 */

/** La ventana en la que se cuenta lo cerrado, en días. */
export const MEAN_WINDOW_DAYS = 30;

/**
 * Cuántos casos cerrados hacen falta para publicar una media.
 *
 * Con uno o dos casos, una media deja de ser una media y pasa a ser la duración
 * exacta de un trabajo concreto, que es un dato del expediente. A partir de
 * cinco el número habla del taller, no de un caso, y por eso por debajo no se
 * publica: se enseña un guion y se dice por qué.
 */
export const MIN_CLOSED_FOR_MEAN = 5;

/** La media se redondea a este paso, en minutos: diez, que es lo que se lee. */
export const MEAN_ROUNDING_MINUTES = 10;

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/**
 * Lo que deja una incidencia cerrada para la media: cuántos minutos estuvo
 * abierta, de la notificación al cierre.
 *
 * Devuelve `null` cuando no hay nada que contar —sin cierre, o con un cierre
 * anterior a su propia notificación, que sería un dato corrupto— y así no entra
 * en la media ni la arrastra hacia abajo.
 */
export function resolutionMinutes(incident: {
  reportedAt: number;
  closedAt?: number;
}): number | null {
  if (incident.closedAt === undefined) return null;
  const minutes = Math.round(
    (incident.closedAt - incident.reportedAt) / MINUTE,
  );
  return minutes >= 0 ? minutes : null;
}

/**
 * La media que se puede publicar, o `null` si la muestra es demasiado pequeña
 * como para no señalar a un caso concreto.
 */
export function publishedMeanMinutes(values: readonly number[]): number | null {
  if (values.length < MIN_CLOSED_FOR_MEAN) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return (
    Math.round(total / values.length / MEAN_ROUNDING_MINUTES) *
    MEAN_ROUNDING_MINUTES
  );
}

/** Desde cuándo cuenta la ventana de la media, en milisegundos. */
export function meanWindowStart(now: number): number {
  return now - MEAN_WINDOW_DAYS * DAY;
}

/** Un número de taller, con separador de miles y sin decimales. */
export function formatCount(value: number): string {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(
    value,
  );
}

/** Una duración en minutos como se lee en la portada: «45 min», «4 h 20». */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0
    ? `${hours} h`
    : `${hours} h ${String(rest).padStart(2, "0")}`;
}
