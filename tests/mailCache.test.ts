import { describe, expect, test } from "vitest";
import {
  CACHE_TARGET_RATIO,
  DEFAULT_CACHE_LIMIT_BYTES,
  DEFAULT_CACHE_RETENTION_DAYS,
  MAX_CACHE_LIMIT_BYTES,
  MIN_CACHE_LIMIT_BYTES,
  cacheTargetBytes,
  clampCacheLimit,
  clampRetentionDays,
  estimateCacheUsage,
  isCacheableMessage,
  planCacheEviction,
  selectExpiredMessages,
  type CachedMessage,
} from "../src/lib/mailClient/cache";

const MIB = 1024 * 1024;
const DAY = 24 * 60 * 60 * 1000;

describe("presupuesto de caché — cuerpo + adjuntos, nunca cabeceras", () => {
  test("los valores por defecto son los de 0017", () => {
    expect(DEFAULT_CACHE_LIMIT_BYTES).toBe(512 * MIB);
    expect(DEFAULT_CACHE_RETENTION_DAYS).toBe(30);
    expect(CACHE_TARGET_RATIO).toBe(0.9);
  });

  test("suma el cuerpo y los adjuntos decodificados", () => {
    expect(estimateCacheUsage(1000, 2000)).toEqual({
      bodyBytes: 1000,
      attachmentBytes: 2000,
      totalBytes: 3000,
    });
  });

  test("el objetivo de expulsión es el 90 % del límite", () => {
    expect(cacheTargetBytes(1000)).toBe(900);
    expect(cacheTargetBytes(512 * MIB)).toBe(Math.floor(512 * MIB * 0.9));
  });

  test("un mensaje mayor que el límite no se cachea", () => {
    expect(isCacheableMessage(50 * MIB)).toBe(true);
    expect(isCacheableMessage(50 * MIB + 1)).toBe(false);
    expect(isCacheableMessage(1000, 500)).toBe(false);
  });

  test("limita el límite y la retención configurables", () => {
    expect(clampCacheLimit(1)).toBe(MIN_CACHE_LIMIT_BYTES);
    expect(clampCacheLimit(3 * 1024 * MIB)).toBe(MAX_CACHE_LIMIT_BYTES);
    expect(clampCacheLimit(Number.NaN)).toBe(DEFAULT_CACHE_LIMIT_BYTES);
    expect(clampRetentionDays(1)).toBe(7);
    expect(clampRetentionDays(999)).toBe(365);
    expect(clampRetentionDays(Number.NaN)).toBe(DEFAULT_CACHE_RETENTION_DAYS);
  });
});

describe("LRU — se expulsa el mensaje completo más antiguo", () => {
  const messages: CachedMessage[] = [
    {
      messageId: "m1",
      cachedBytes: 100,
      lastOpenedAt: 1,
      cachedAt: 1,
    },
    {
      messageId: "m2",
      cachedBytes: 200,
      lastOpenedAt: 2,
      cachedAt: 2,
    },
    {
      messageId: "m3",
      cachedBytes: 300,
      lastOpenedAt: 3,
      cachedAt: 3,
    },
  ];

  test("no expulsa si el mensaje nuevo cabe bajo el objetivo", () => {
    const plan = planCacheEviction({
      currentBytes: 600,
      incomingBytes: 200,
      limitBytes: 1000,
      messages,
    });

    expect(plan.evictedIds).toEqual([]);
    expect(plan.nextBytes).toBe(600);
    expect(plan.cacheable).toBe(true);
  });

  test("expulsa los menos usados hasta llegar al 90 %", () => {
    const plan = planCacheEviction({
      currentBytes: 800,
      incomingBytes: 200,
      limitBytes: 1000,
      messages,
    });

    expect(plan.evictedIds).toEqual(["m1"]);
    expect(plan.nextBytes).toBe(700);
    expect(plan.cacheable).toBe(true);
  });

  test("expulsa varios si hace falta y no parte un mensaje", () => {
    const plan = planCacheEviction({
      currentBytes: 900,
      incomingBytes: 500,
      limitBytes: 1000,
      messages,
    });

    // Para dejar 900 + 500 bajo el 90 % hay que sacar los tres mensajes;
    // cada expulsión se lleva la fila completa, nunca media.
    expect(plan.evictedIds).toEqual(["m1", "m2", "m3"]);
    expect(plan.nextBytes).toBe(300);
    expect(plan.cacheable).toBe(true);
  });

  test("no expulsa nada si el mensaje entrante ya supera el límite", () => {
    const plan = planCacheEviction({
      currentBytes: 800,
      incomingBytes: 1001,
      limitBytes: 1000,
      messages,
    });

    expect(plan.evictedIds).toEqual([]);
    expect(plan.cacheable).toBe(false);
  });
});

describe("caducidad — 30 días desde la última apertura", () => {
  test("usa lastOpenedAt y cae a cachedAt si falta", () => {
    const now = 100 * DAY;
    const messages: CachedMessage[] = [
      {
        messageId: "viejo",
        cachedBytes: 10,
        lastOpenedAt: now - 31 * DAY,
        cachedAt: now - 40 * DAY,
      },
      {
        messageId: "reciente",
        cachedBytes: 10,
        lastOpenedAt: now - 10 * DAY,
        cachedAt: now - 40 * DAY,
      },
      {
        messageId: "sin-apertura",
        cachedBytes: 10,
        lastOpenedAt: 0,
        cachedAt: now - 31 * DAY,
      },
    ];

    expect(selectExpiredMessages({ messages, now, retentionDays: 30 })).toEqual(
      ["viejo", "sin-apertura"],
    );
  });

  test("respeta la retención configurada", () => {
    const now = 100 * DAY;
    const messages: CachedMessage[] = [
      {
        messageId: "m1",
        cachedBytes: 10,
        lastOpenedAt: now - 8 * DAY,
        cachedAt: now - 8 * DAY,
      },
    ];

    expect(selectExpiredMessages({ messages, now, retentionDays: 7 })).toEqual([
      "m1",
    ]);
    expect(selectExpiredMessages({ messages, now, retentionDays: 30 })).toEqual(
      [],
    );
  });
});
