import { describe, expect, test } from "vitest";
import { api, internal } from "../src/convex/_generated/api";
import { BACKUP_FORMAT, BACKUP_VERSION } from "../src/lib/backup";
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
  return {
    t,
    adminId,
    admin: t.withIdentity({ subject: `${adminId}|s-admin` }),
  };
}

/** Una copia `original` completa, con cuerpo, adjunto y `.eml`. */
async function seedShare(
  t: ReturnType<typeof backend>,
  adminId: Awaited<ReturnType<typeof setup>>["adminId"],
) {
  return t.run(async (ctx) => {
    const equipmentId = await ctx.db.insert("equipment", {
      name: "Cámara de estudio",
      model: "HDC-3500",
      code: "EQ-0001",
      createdAt: 1,
      updatedAt: 1,
    });
    const incidentId = await ctx.db.insert("incidents", {
      reference: "INC-0001",
      reporterName: "Proveedor",
      description: "Presupuesto del SAT",
      reportedAt: 1_795_179_963_000,
      status: "reported",
      history: [{ status: "reported", at: 1_795_179_963_000 }],
      createdAt: 1_795_179_963_000,
      updatedAt: 1_795_179_963_000,
    });
    const attachment = await ctx.storage.store(
      new Blob(["presupuesto"], { type: "application/pdf" }),
    );
    const eml = await ctx.storage.store(
      new Blob(["Subject: Presupuesto del SAT"], { type: "message/rfc822" }),
    );
    const shareId = await ctx.db.insert("mailShares", {
      sourceMessageId: "m-1",
      sourceEmail: "sat@rtva.es",
      destinationType: "incident",
      destinationId: incidentId,
      destinationReference: "INC-0001",
      mode: "original",
      subject: "Presupuesto del SAT",
      fromName: "Proveedor",
      fromAddress: "sat@proveedor.es",
      sentAt: 1_795_179_963_000,
      summary: "Extracto del cuerpo",
      bodyText: "Cuerpo del correo",
      bodyHtml: "<p>Cuerpo del correo</p>",
      attachments: [
        {
          storageId: attachment,
          name: "presupuesto.pdf",
          contentType: "application/pdf",
          size: 11,
        },
      ],
      emlStorageId: eml,
      emlFileName: "correo.eml",
      emlSize: 29,
      sharedBy: adminId,
      sharedByName: "Administradora",
      sharedAt: 1_795_179_963_000,
    });
    return { equipmentId, incidentId, shareId, attachment, eml };
  });
}

/** ¿Sigue el archivo en el almacén del taller? La papelera no lo borra aún. */
async function stillStored(
  t: ReturnType<typeof backend>,
  storageId: Awaited<ReturnType<typeof seedShare>>["attachment"],
): Promise<boolean> {
  return (await t.run((ctx) => ctx.storage.getUrl(storageId))) !== null;
}

/** La limpieza, dándolo todo por viejo: la prueba no depende del reloj. */
async function sweepEverything(t: ReturnType<typeof backend>) {
  return await t.mutation(internal.storageCleanup.sweepOrphanFiles, {
    before: Date.now() + 1000,
  });
}

type BackupPayload = {
  tables: { mailShares?: Array<Record<string, unknown>> };
};

describe("mailShares en el backup", () => {
  test("se exporta solo como metadatos, sin extracto, cuerpo, adjuntos ni .eml", async () => {
    const { t, admin, adminId } = await setup();
    await seedShare(t, adminId);

    const exported = await admin.action(api.workshopBackup.exportBackup, {});
    expect(exported.summary.tableCounts.mailShares).toBe(1);

    const payload = JSON.parse(exported.rawJson) as BackupPayload;
    const row = payload.tables.mailShares?.[0];
    expect(row).toMatchObject({
      destinationType: "incident",
      destinationReference: "INC-0001",
      subject: "Presupuesto del SAT",
      fromAddress: "sat@proveedor.es",
      sharedByName: "Administradora",
      // Una copia original viaja ya como resumen restaurado.
      mode: "summary",
      backupRestored: true,
    });

    for (const leaked of [
      "summary",
      "bodyText",
      "bodyHtml",
      "attachments",
      "emlStorageId",
      "emlFileName",
      "emlSize",
      "sourceMessageId",
      "sourceEmail",
    ]) {
      expect(row?.[leaked], `no debe exportarse ${leaked}`).toBeUndefined();
    }
  });

  test("al restaurar vuelve como resumen, con su ficha remapeada y sin contenido colado", async () => {
    const { t, admin, adminId } = await setup();
    const seeded = await seedShare(t, adminId);

    const exported = await admin.action(api.workshopBackup.exportBackup, {});
    const payload = JSON.parse(exported.rawJson) as BackupPayload;
    // Aunque alguien edite el archivo, la restauración no deja pasar contenido
    // ni una copia original.
    const row = payload.tables.mailShares?.[0];
    if (!row) throw new Error("Sin copia en el backup");
    row.bodyText = "inyectado";
    row.summary = "inyectado";
    row.mode = "original";

    const restored = await admin.action(api.workshopBackup.restoreBackup, {
      rawJson: JSON.stringify(payload),
    });
    expect(restored.restoredRecords).toBe(exported.summary.totalRecords);

    const [share] = await t.run((ctx) => ctx.db.query("mailShares").collect());
    if (!share) throw new Error("La copia no volvió");
    const incident = await t.run(
      async (ctx) => (await ctx.db.query("incidents").collect())[0],
    );
    expect(share.destinationId).toBe(incident?._id);
    expect(share.destinationId).not.toBe(seeded.incidentId);
    expect(share.destinationReference).toBe("INC-0001");
    expect(share.mode).toBe("summary");
    expect(share.backupRestored).toBe(true);
    expect(share.summary).toBeUndefined();
    expect(share.bodyText).toBeUndefined();
    expect(share.bodyHtml).toBeUndefined();
    expect(share.attachments).toBeUndefined();
    expect(share.emlStorageId).toBeUndefined();
    expect(share.sourceMessageId).toBeUndefined();
    expect(share.sourceEmail).toBeUndefined();

    const detail = await admin.query(api.mailShares.get, {
      shareId: share._id,
    });
    expect(detail?.backupRestored).toBe(true);
    expect(detail?.summary).toBe("");
  });

  test("una copia cuyo destino no vuelve se omite y deja traza", async () => {
    const { t, admin, adminId } = await setup();

    const rawJson = JSON.stringify({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: 1,
      exportedBy: "Administradora",
      tables: {
        mailShares: [
          {
            _id: "share-sin-ficha",
            destinationType: "equipment",
            destinationId: "equipment-que-no-vuelve",
            destinationReference: "EQ-9999",
            mode: "summary",
            subject: "Correo sin ficha",
            fromName: "Proveedor",
            fromAddress: "sat@proveedor.es",
            sentAt: 1,
            sharedBy: adminId,
            sharedByName: "Administradora",
            sharedAt: 1,
          },
        ],
      },
      manifest: { totalRecords: 1, tableCounts: { mailShares: 1 } },
    });

    const restored = await admin.action(api.workshopBackup.restoreBackup, {
      rawJson,
    });

    // No se inventa una huérfana artificial.
    expect(restored.restoredRecords).toBe(0);
    expect(await t.run((ctx) => ctx.db.query("mailShares").collect())).toEqual(
      [],
    );
    const audit = await t.run((ctx) =>
      ctx.db.query("securityAuditLog").collect(),
    );
    expect(
      audit.some(
        (entry) =>
          entry.action === "mail_share_restore_skip" &&
          String(entry.metadata).includes("destination_missing"),
      ),
    ).toBe(true);
  });
});

describe("mailShares y la limpieza del almacén", () => {
  test("la copia protege sus archivos y, tras el reset, la limpieza los retira", async () => {
    const { t, admin, adminId } = await setup();
    const seeded = await seedShare(t, adminId);

    // Con la copia viva, el adjunto y el `.eml` están citados: no se tocan.
    expect(await sweepEverything(t)).toBe(0);
    expect(await stillStored(t, seeded.attachment)).toBe(true);
    expect(await stillStored(t, seeded.eml)).toBe(true);
    expect(await t.run((ctx) => ctx.db.query("trashFiles").collect())).toEqual(
      [],
    );

    // Tampoco cuando la ficha desaparece y la copia queda huérfana: sus siete
    // días de papelera administrativa la siguen citando.
    await admin.mutation(api.equipment.remove, { id: seeded.equipmentId });
    expect(await sweepEverything(t)).toBe(0);
    expect(await stillStored(t, seeded.attachment)).toBe(true);
    expect(await stillStored(t, seeded.eml)).toBe(true);

    // Tras vaciar el taller ya no queda fila que los cite: la limpieza los
    // retira a la papelera, donde esperan su plazo antes de borrarse del todo.
    await admin.action(api.workshopReset.resetWorkshop, {});
    expect(await sweepEverything(t)).toBe(2);

    const trashed = await t.run((ctx) => ctx.db.query("trashFiles").collect());
    expect(trashed.map((row) => row.storageId).sort()).toEqual(
      [seeded.attachment, seeded.eml].sort(),
    );
    expect(trashed.every((row) => row.pass === "orphanFiles")).toBe(true);
    expect(await stillStored(t, seeded.attachment)).toBe(true);
    expect(await stillStored(t, seeded.eml)).toBe(true);
  });
});

describe("mailShares en el vaciado del taller", () => {
  test("se van las filas y los objetos quedan para la limpieza nocturna", async () => {
    const { t, admin, adminId } = await setup();
    const seeded = await seedShare(t, adminId);

    await admin.action(api.workshopReset.resetWorkshop, {});

    expect(await t.run((ctx) => ctx.db.query("mailShares").collect())).toEqual(
      [],
    );
    // El reset no borra contenido: `storageCleanup` lo barrerá cuando ninguna
    // fila lo cite.
    expect(
      await t.run((ctx) => ctx.db.system.get(seeded.attachment)),
    ).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get(seeded.eml))).not.toBeNull();
  });
});
