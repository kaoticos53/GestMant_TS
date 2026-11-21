/**
 * Reglas puras de la cuenta de correo: el servidor no lo elige el cliente, el
 * buzón es una dirección completa y la caché tiene un suelo y un techo. No
 * conoce Convex ni la red; el backend aplica estas mismas reglas antes de
 * escribir.
 */

/** Servidor fijo del buzón. No se acepta un host del cliente (SSRF). */
export const MAIL_SERVER_URL = "https://hermes.rtva.es";

const MIB = 1024 * 1024;

export const MAIL_CACHE_DEFAULT_LIMIT_BYTES = 512 * MIB;
export const MAIL_CACHE_MIN_LIMIT_BYTES = 128 * MIB;
export const MAIL_CACHE_MAX_LIMIT_BYTES = 2 * 1024 * MIB;

export const MAIL_CACHE_DEFAULT_RETENTION_DAYS = 30;
export const MAIL_CACHE_MIN_RETENTION_DAYS = 7;
export const MAIL_CACHE_MAX_RETENTION_DAYS = 365;

export type MailAccountStatus =
  "disconnected" | "connected" | "reauthRequired" | "error";

/** El estado que puede venir de la base de datos. */
export function isMailAccountStatus(
  value: unknown,
): value is MailAccountStatus {
  return (
    value === "disconnected" ||
    value === "connected" ||
    value === "reauthRequired" ||
    value === "error"
  );
}

/**
 * Un buzón de Zimbra es una dirección completa; el servidor rechaza el usuario
 * suelto. Se normaliza a minúsculas porque el resto del taller ya lo hace así.
 */
export function normalizeMailAddress(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (value.length === 0 || value.length > 320) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
  return value;
}

/** Un entero dentro de [min, max]; un valor inválido cae al valor de partida. */
function clampInteger(
  value: number,
  min: number,
  max: number,
  fallback: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

/** Límite de caché en bytes, entre 128 MiB y 2 GiB. */
export function clampCacheLimit(value: number): number {
  return clampInteger(
    value,
    MAIL_CACHE_MIN_LIMIT_BYTES,
    MAIL_CACHE_MAX_LIMIT_BYTES,
    MAIL_CACHE_DEFAULT_LIMIT_BYTES,
  );
}

/** Retención en días, entre 7 y 365. */
export function clampCacheRetention(value: number): number {
  return clampInteger(
    value,
    MAIL_CACHE_MIN_RETENTION_DAYS,
    MAIL_CACHE_MAX_RETENTION_DAYS,
    MAIL_CACHE_DEFAULT_RETENTION_DAYS,
  );
}
