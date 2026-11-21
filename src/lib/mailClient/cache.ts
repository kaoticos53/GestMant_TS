/**
 * Política de caché del buzón. Solo cuenta el contenido descargado —cuerpo y
 * adjuntos—; las cabeceras no son caché y las copias compartidas de 0018 no
 * entran en este presupuesto.
 */

export const MIB = 1024 * 1024;
export const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_CACHE_LIMIT_BYTES = 512 * MIB;
export const MIN_CACHE_LIMIT_BYTES = 128 * MIB;
export const MAX_CACHE_LIMIT_BYTES = 2 * 1024 * MIB;
export const DEFAULT_CACHE_RETENTION_DAYS = 30;
export const MIN_CACHE_RETENTION_DAYS = 7;
export const MAX_CACHE_RETENTION_DAYS = 365;
export const MAX_MESSAGE_BYTES = 50 * MIB;
export const CACHE_TARGET_RATIO = 0.9;

export interface CachedMessage {
  messageId: string;
  cachedBytes: number;
  lastOpenedAt: number;
  cachedAt: number;
}

export interface CacheUsage {
  bodyBytes: number;
  attachmentBytes: number;
  totalBytes: number;
}

export interface CacheEvictionPlan {
  evictedIds: string[];
  nextBytes: number;
  cacheable: boolean;
}

function bytes(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

/** Suma el cuerpo y los adjuntos decodificados de un mensaje. */
export function estimateCacheUsage(
  bodyBytes: number,
  attachmentBytes: number,
): CacheUsage {
  const body = bytes(bodyBytes);
  const attachments = bytes(attachmentBytes);
  return {
    bodyBytes: body,
    attachmentBytes: attachments,
    totalBytes: body + attachments,
  };
}

/** Límite configurable, acotado a 128 MB–2 GB. */
export function clampCacheLimit(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CACHE_LIMIT_BYTES;
  return Math.min(
    MAX_CACHE_LIMIT_BYTES,
    Math.max(MIN_CACHE_LIMIT_BYTES, Math.trunc(value)),
  );
}

/** Retención configurable, acotada a 7–365 días. */
export function clampRetentionDays(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CACHE_RETENTION_DAYS;
  return Math.min(
    MAX_CACHE_RETENTION_DAYS,
    Math.max(MIN_CACHE_RETENTION_DAYS, Math.trunc(value)),
  );
}

/** El 90 % del límite que debe quedar libre al cachear un mensaje nuevo. */
export function cacheTargetBytes(limitBytes: number): number {
  return Math.floor(bytes(limitBytes) * CACHE_TARGET_RATIO);
}

/** Un mensaje no se cachea si supera 50 MB o el límite de la cuenta. */
export function isCacheableMessage(
  messageBytes: number,
  limitBytes = DEFAULT_CACHE_LIMIT_BYTES,
): boolean {
  const size = bytes(messageBytes);
  const limit = bytes(limitBytes);
  return size <= MAX_MESSAGE_BYTES && size <= limit && limit > 0;
}

/**
 * Planifica la expulsión LRU. Se lleva mensajes completos, del menos usado al
 * más usado, hasta que el nuevo quepa bajo el objetivo del 90 %. Si el mensaje
 * no cabe ni con la caché vacía, no se cachea.
 */
export function planCacheEviction({
  currentBytes,
  incomingBytes,
  limitBytes,
  messages,
}: {
  currentBytes: number;
  incomingBytes: number;
  limitBytes: number;
  messages: readonly CachedMessage[];
}): CacheEvictionPlan {
  const limit = bytes(limitBytes);
  const current = bytes(currentBytes);
  const incoming = bytes(incomingBytes);

  if (limit === 0 || incoming > limit || incoming > MAX_MESSAGE_BYTES) {
    return { evictedIds: [], nextBytes: current, cacheable: false };
  }

  const target = cacheTargetBytes(limit);
  let nextBytes = current;
  const evictedIds: string[] = [];
  const ordered = [...messages].sort(
    (a, b) =>
      a.lastOpenedAt - b.lastOpenedAt ||
      a.cachedAt - b.cachedAt ||
      a.messageId.localeCompare(b.messageId),
  );

  for (const message of ordered) {
    if (nextBytes + incoming <= target) break;
    const size = bytes(message.cachedBytes);
    if (size === 0) continue;
    nextBytes = Math.max(0, nextBytes - size);
    evictedIds.push(message.messageId);
  }

  return {
    evictedIds,
    nextBytes,
    cacheable: nextBytes + incoming <= limit,
  };
}

/** Ids cuya caché supera la retención desde la última apertura o cacheo. */
export function selectExpiredMessages({
  messages,
  now,
  retentionDays,
}: {
  messages: readonly CachedMessage[];
  now: number;
  retentionDays: number;
}): string[] {
  const safeNow = Number.isFinite(now) ? now : 0;
  const retentionMs = clampRetentionDays(retentionDays) * DAY_MS;
  return messages
    .filter((message) => {
      const reference =
        message.lastOpenedAt > 0 ? message.lastOpenedAt : message.cachedAt;
      return safeNow - reference > retentionMs;
    })
    .map((message) => message.messageId);
}
