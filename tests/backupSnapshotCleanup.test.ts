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

  test("una foto partida entre páginas se cuenta y se avisa una sola vez", async () => {
    const { t, adminId } = await setup();
    const now = Date.now();

    // Sin cabecera (`seq` 0) la foto es huérfana; 101 documentos hacen que el
    // corte de página de 100 la parta en dos pasadas de la limpieza.
    await t.run(async (ctx) => {
      for (let seq = 1; seq <= 101; seq += 1) {
        await ctx.db.insert("workshopRestoreSnapshots", {
          batch: "foto-cruzada",
          seq,
          payload: '{"tables":{}}',
          savedBy: adminId,
          savedAt: now - 60_000,
          aliveAt: now - 60_000,
        });
      }
    });

    // Primera página: retira 100 documentos, pero la foto sigue viva. No hay
    // aviso todavía.
    expect(
      await t.action(internal.workshopBackup.recoverInterruptedRestore, {}),
    ).toEqual({ recovered: false });
    expect(
      await t.run((ctx) => ctx.db.query("notifications").collect()),
    ).toHaveLength(0);

    // Segunda página: retira el último documento y cierra la foto. El aviso
    // aparece una sola vez y con el recuento de fotos, no de páginas.
    expect(
      await t.action(internal.workshopBackup.recoverInterruptedRestore, {}),
    ).toEqual({ recovered: false });

    const audit = await t.run((ctx) =>
      ctx.db
        .query("securityAuditLog")
        .withIndex("by_action", (q) => q.eq("action", "workshop_backup_prune"))
        .collect(),
    );
    expect(audit).toHaveLength(2);
    const pages = audit.map(
      (row) =>
        JSON.parse(row.metadata ?? "{}") as {
          photos: string[];
          chunks: number;
        },
    );
    expect(pages.map((page) => page.chunks).sort((a, b) => a - b)).toEqual([
      1, 100,
    ]);
    expect(pages.flatMap((page) => page.photos)).toEqual(["foto-cruzada"]);

    const notifications = await t.run((ctx) =>
      ctx.db.query("notifications").collect(),
    );
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.text).toContain("1 foto huérfana");
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
