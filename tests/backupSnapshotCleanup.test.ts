import { describe, expect, test } from "vitest";
import { internal } from "../src/convex/_generated/api";
import { backend } from "./backend";

async function setup() {
  const t = backend();
  const adminId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Administradora",
      email: "admin@taller.es",
      role: "admin",
      active: true,
    }),
  );
  return { t, adminId };
}

async function insertHead(
  t: ReturnType<typeof backend>,
  adminId: Awaited<ReturnType<typeof setup>>["adminId"],
  batch: string,
  savedAt: number,
  extra: {
    appliedAt?: number;
    appliedRecords?: number;
    undoUntil?: number;
  } = {},
) {
  return await t.run((ctx) =>
    ctx.db.insert("workshopRestoreSnapshots", {
      batch,
      seq: 0,
      payload: '{"tables":{}}',
      savedBy: adminId,
      savedAt,
      aliveAt: savedAt,
      complete: true,
      chunkCount: 1,
      checksum: "0".repeat(64),
      ...extra,
    }),
  );
}

describe("limpieza de fotos huérfanas de restauración", () => {
  test("retira todos los lotes anteriores y los trozos sin cabecera", async () => {
    const { t, adminId } = await setup();
    const now = Date.now();

    // La foto actual sigue en su ventana de deshacer: es la única que se
    // conserva. Las anteriores ya no pueden aplicarse ni deshacerse.
    await insertHead(t, adminId, "foto-actual", now - 120_000, {
      appliedAt: now - 60_000,
      appliedRecords: 0,
      undoUntil: now + 60_000,
    });
    await insertHead(t, adminId, "foto-anterior", now - 240_000);
    await t.run((ctx) =>
      ctx.db.insert("workshopRestoreSnapshots", {
        batch: "resto-sin-cabecera",
        seq: 1,
        payload: '{"tables":{}}',
        savedBy: adminId,
        savedAt: now - 30_000,
        aliveAt: now - 30_000,
      }),
    );

    const result = await t.action(
      internal.workshopBackup.recoverInterruptedRestore,
      {},
    );
    expect(result).toEqual({ recovered: false });

    const rows = await t.run((ctx) =>
      ctx.db.query("workshopRestoreSnapshots").collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.batch).toBe("foto-actual");

    const audit = await t.run((ctx) =>
      ctx.db.query("securityAuditLog").collect(),
    );
    const prune = audit.find((row) => row.action === "workshop_backup_prune");
    expect(JSON.parse(prune?.metadata ?? "{}")).toMatchObject({
      keptBatch: "foto-actual",
      photos: ["foto-anterior", "resto-sin-cabecera"],
      chunks: 2,
    });

    const notifications = await t.run((ctx) =>
      ctx.db.query("notifications").collect(),
    );
    expect(
      notifications.some(
        (row) =>
          row.text.includes("La pasada de recuperación") &&
          row.text.includes("2 fotos huérfanas"),
      ),
    ).toBe(true);
  });

  test("cuenta una foto partida en varios trozos como una sola foto huérfana", async () => {
    const { t, adminId } = await setup();
    const now = Date.now();

    await insertHead(t, adminId, "foto-actual", now - 120_000, {
      appliedAt: now - 60_000,
      appliedRecords: 0,
      undoUntil: now + 60_000,
    });
    // Una sola foto anterior repartida en tres documentos. El aviso debe
    // contar el lote, no los tres trozos.
    await t.run(async (ctx) => {
      for (const seq of [0, 1, 2]) {
        await ctx.db.insert("workshopRestoreSnapshots", {
          batch: "foto-en-trozos",
          seq,
          payload: '{"tables":{}}',
          savedBy: adminId,
          savedAt: now - 240_000,
          aliveAt: now - 240_000,
          ...(seq === 0
            ? {
                complete: true,
                chunkCount: 3,
                checksum: "0".repeat(64),
              }
            : {}),
        });
      }
    });

    expect(
      await t.action(internal.workshopBackup.recoverInterruptedRestore, {}),
    ).toEqual({ recovered: false });

    const audit = await t.run((ctx) =>
      ctx.db.query("securityAuditLog").collect(),
    );
    const prune = audit.find((row) => row.action === "workshop_backup_prune");
    expect(JSON.parse(prune?.metadata ?? "{}")).toMatchObject({
      photos: ["foto-en-trozos"],
      chunks: 3,
    });

    const notifications = await t.run((ctx) =>
      ctx.db.query("notifications").collect(),
    );
    const notice = notifications.find((row) =>
      row.text.includes("La pasada de recuperación"),
    );
    expect(notice?.text).toBe(
      "La pasada de recuperación ha retirado 1 foto huérfana de restauraciones anteriores.",
    );
  });

  test("una cabecera antigua no queda escondida por un trozo nuevo sin cabecera", async () => {
    const { t, adminId } = await setup();
    const now = Date.now();

    await insertHead(t, adminId, "foto-completa", now - 120_000, {
      appliedAt: now - 60_000,
      appliedRecords: 0,
      undoUntil: now + 60_000,
    });
    // Escritura muerta de un intento posterior: solo llegó el trozo 1. El
    // `by_savedAt` anterior la tomaba por la última foto y devolvía null.
    await t.run((ctx) =>
      ctx.db.insert("workshopRestoreSnapshots", {
        batch: "escritura-muerta",
        seq: 1,
        payload: '{"tables":{}}',
        savedBy: adminId,
        savedAt: now - 10_000,
        aliveAt: now - 10_000,
      }),
    );

    const result = await t.action(
      internal.workshopBackup.recoverInterruptedRestore,
      {},
    );
    expect(result).toEqual({ recovered: false });

    const rows = await t.run((ctx) =>
      ctx.db.query("workshopRestoreSnapshots").collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.batch).toBe("foto-completa");
  });

  test("si la foto más reciente no está sellada, la anterior tampoco se aplica", async () => {
    const { t, adminId } = await setup();
    const now = Date.now();

    await insertHead(t, adminId, "foto-anterior", now - 240_000);
    await t.run((ctx) =>
      ctx.db.insert("workshopRestoreSnapshots", {
        batch: "foto-sin-sellar",
        seq: 0,
        payload: '{"tables":{}}',
        savedBy: adminId,
        savedAt: now - 60_000,
        aliveAt: now - 60_000,
      }),
    );

    expect(
      await t.action(internal.workshopBackup.recoverInterruptedRestore, {}),
    ).toEqual({ recovered: false });
    expect(
      await t.run((ctx) => ctx.db.query("workshopRestoreSnapshots").collect()),
    ).toHaveLength(0);
  });

  test("retira las fotos huérfanas por páginas acotadas sin tocar la actual", async () => {
    const { t, adminId } = await setup();
    const now = Date.now();

    await insertHead(t, adminId, "foto-actual", now, {
      appliedAt: now - 60_000,
      appliedRecords: 0,
      undoUntil: now + 60_000,
    });
    for (let index = 0; index < 5; index += 1) {
      for (const seq of [0, 1]) {
        await t.run((ctx) =>
          ctx.db.insert("workshopRestoreSnapshots", {
            batch: `foto-antigua-${index}`,
            seq,
            payload: '{"tables":{}}',
            savedBy: adminId,
            savedAt: now - 10_000 - index * 100,
            aliveAt: now - 10_000 - index * 100,
          }),
        );
      }
    }

    let pages = 0;
    let removed = 0;
    let hasMore = true;
    while (hasMore && pages < 20) {
      const page = await t.mutation(
        internal.workshopBackup.pruneOrphanSnapshots,
        { keepBatch: "foto-actual", limit: 2 },
      );
      removed += page.chunks;
      hasMore = page.hasMore;
      pages += 1;
    }

    expect(pages).toBeGreaterThan(1);
    expect(removed).toBe(10);
    const rows = await t.run((ctx) =>
      ctx.db.query("workshopRestoreSnapshots").collect(),
    );
    expect(rows.map((row) => row.batch)).toEqual(["foto-actual"]);
  });

  test("avisa una sola vez aunque el fallo de recuperación se repita", async () => {
    const { t } = await setup();

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await t.mutation(internal.workshopBackup.recordRecoveryFailure, {
        message: "fallo de prueba",
      });
    }

    const audit = await t.run((ctx) =>
      ctx.db
        .query("securityAuditLog")
        .withIndex("by_action", (q) =>
          q.eq("action", "workshop_backup_recovery_failure"),
        )
        .collect(),
    );
    expect(audit).toHaveLength(2);
    expect(JSON.parse(audit[0]?.metadata ?? "{}")).toMatchObject({
      metadataVersion: 1,
      error: "fallo de prueba",
    });

    const notifications = await t.run((ctx) =>
      ctx.db.query("notifications").collect(),
    );
    expect(
      notifications.filter((row) =>
        row.text.includes("La pasada de recuperación ha fallado"),
      ),
    ).toHaveLength(1);
  });

  test("un error de la pasada deja traza de recuperación fallida", async () => {
    const { t, adminId } = await setup();
    const now = Date.now();
    await t.run((ctx) => ctx.db.patch(adminId, { active: false }));
    await insertHead(t, adminId, "foto-sin-admin", now - 120_000, {
      appliedAt: now - 60_000,
      appliedRecords: 0,
      undoUntil: now + 60_000,
    });

    await expect(
      t.action(internal.workshopBackup.recoverInterruptedRestore, {}),
    ).rejects.toThrow(/administrador activo/);

    const audit = await t.run((ctx) =>
      ctx.db
        .query("securityAuditLog")
        .withIndex("by_action", (q) =>
          q.eq("action", "workshop_backup_recovery_failure"),
        )
        .first(),
    );
    expect(audit).not.toBeNull();
    expect(JSON.parse(audit?.metadata ?? "{}")).toMatchObject({
      error: expect.stringContaining("administrador activo"),
      pendingBatch: "foto-sin-admin",
    });
  });
});
