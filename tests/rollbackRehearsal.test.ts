import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import type { TableNames } from "../src/convex/_generated/dataModel";
import { BACKUP_TABLES, type BackupTableName } from "../src/lib/backup";
import { backend } from "./backend";

/**
 * El ensayo de rollback de F8, tal y como se haría en un deployment de banco de
 * pruebas: se siembra un taller, se exporta la copia con el backend de verdad, se
 * deja que el taller cambie por debajo (datos nuevos y un valor tocado, que es lo
 * que pasa entre una copia y una vuelta atrás) y se restaura.
 *
 * Lo que se mide no es «no lanza»: es que el taller queda **tabla a tabla** con
 * los recuentos de la copia, que lo nuevo desaparece, que la copia de correo
 * vuelve como metadatos y que `securityAuditLog` sigue donde estaba.
 */

type TestBackend = ReturnType<typeof backend>;

/** Los recuentos por tabla del taller tal y como están ahora mismo. */
async function tableCounts(
  t: TestBackend,
): Promise<Record<BackupTableName, number>> {
  return await t.run(async (ctx) => {
    const counts = {} as Record<BackupTableName, number>;
    for (const table of BACKUP_TABLES) {
      const rows = await ctx.db.query(table as TableNames).collect();
      counts[table] = rows.length;
    }
    return counts;
  });
}

/** El taller de banco de pruebas: dos equipos, un repuesto y una copia de correo. */
async function seedWorkshop(t: TestBackend) {
  const { adminId, cameraId, monitorId } = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", {
      name: "Administradora",
      email: "admin@taller.es",
      role: "admin",
      active: true,
    });
    const cameraId = await ctx.db.insert("equipment", {
      name: "Cámara de estudio",
      model: "HDC-3500",
      code: "EQ-0001",
      location: "Plató 1",
      createdAt: 1,
      updatedAt: 1,
    });
    const monitorId = await ctx.db.insert("equipment", {
      name: "Monitor de realización",
      model: "LMD-2451",
      code: "EQ-0002",
      location: "Control",
      createdAt: 1,
      updatedAt: 1,
    });
    return { adminId, cameraId, monitorId };
  });

  const admin = t.withIdentity({ subject: `${adminId}|s-admin` });

  await admin.mutation(api.spareParts.create, {
    code: "BK-001",
    name: "Fusible 5A",
    category: "Electrónica",
    unit: "ud",
    stock: 10,
    minStock: 2,
    compatibleWith: [cameraId],
  });

  const retiredDocId = await t.run(async (ctx) => {
    const incidentId = await ctx.db.insert("incidents", {
      reference: "INC-0001",
      reporterName: "Proveedor",
      description: "Presupuesto del SAT",
      reportedAt: 1_795_179_963_000,
      status: "reported",
      history: [{ status: "reported", at: 1_795_179_963_000 }],
      equipmentId: cameraId,
      createdAt: 1_795_179_963_000,
      updatedAt: 1_795_179_963_000,
    });
    const attachment = await ctx.storage.store(
      new Blob(["presupuesto"], { type: "application/pdf" }),
    );
    const eml = await ctx.storage.store(
      new Blob(["Subject: Presupuesto del SAT"], { type: "message/rfc822" }),
    );
    await ctx.db.insert("mailShares", {
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

    // Un adjunto retirado: el documento se borra y el rastro se queda, con una
    // referencia a una fila que ya no existe. Es el caso que rompía la
    // restauración contra un deployment con historia de verdad.
    const retiredDocId = await ctx.db.insert("incidentDocuments", {
      incidentId,
      name: "Parte retirado.pdf",
      author: "Administradora",
      createdAt: 1_795_179_963_000,
    });
    await ctx.db.insert("incidentDocumentLog", {
      incidentId,
      documentId: retiredDocId,
      action: "removed",
      name: "Parte retirado.pdf",
      by: "Administradora",
      byId: adminId,
      at: 1_795_179_963_000,
    });
    await ctx.db.delete(retiredDocId);
    return retiredDocId;
  });

  return { admin, adminId, cameraId, monitorId, retiredDocId };
}

describe("F8 — ensayo de rollback en un deployment de banco de pruebas", () => {
  test("restaura la copia y deja los recuentos por tabla iguales a los exportados", async () => {
    const t = backend();
    const { admin, retiredDocId } = await seedWorkshop(t);

    // 1. La copia, con los mismos handlers que usa la pantalla de Ajustes.
    const exported = await admin.action(api.workshopBackup.exportBackup, {});
    const backupCounts = exported.summary.tableCounts;
    const beforeRestore = await tableCounts(t);

    // 2. El taller sigue trabajando entre la copia y la vuelta atrás.
    await admin.mutation(api.spareParts.create, {
      code: "EXTRA-999",
      name: "Llegó después de la copia",
      category: "Electrónica",
      unit: "ud",
      stock: 1,
      minStock: 0,
    });
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("spareParts")
        .withIndex("by_code", (q) => q.eq("code", "BK-001"))
        .unique();
      if (row) await ctx.db.patch(row._id, { stock: 999 });
    });
    const drifted = await tableCounts(t);
    expect(drifted.spareParts).toBe((backupCounts.spareParts ?? 0) + 1);

    // 3. La vuelta atrás.
    const started = performance.now();
    const restored = await admin.action(api.workshopBackup.restoreBackup, {
      rawJson: exported.rawJson,
    });
    const elapsedMs = Math.round(performance.now() - started);
    const afterRestore = await tableCounts(t);

    // 4. Tabla a tabla: ni una fila de más ni de menos respecto a la copia.
    const comparison = BACKUP_TABLES.map((table) => ({
      table,
      backup: backupCounts[table] ?? 0,
      before: beforeRestore[table],
      drifted: drifted[table],
      after: afterRestore[table],
    })).filter((row) => row.backup > 0 || row.drifted > 0 || row.after > 0);
    console.log(
      [
        "",
        "tabla                  copia  antes  deriva  después",
        ...comparison.map(
          (row) =>
            `${row.table.padEnd(22)} ${String(row.backup).padStart(5)} ${String(
              row.before,
            ).padStart(6)} ${String(row.drifted).padStart(7)} ${String(
              row.after,
            ).padStart(8)}`,
        ),
        `total filas de la copia: ${exported.summary.totalRecords} · restauradas: ${restored.restoredRecords} · ${elapsedMs} ms`,
      ].join("\n"),
    );

    for (const table of BACKUP_TABLES) {
      expect(afterRestore[table], `recuento de ${table}`).toBe(
        backupCounts[table] ?? 0,
      );
    }
    expect(restored.restoredRecords).toBe(exported.summary.totalRecords);

    // 5. Lo que llegó después de la copia no sobrevive, y lo tocado vuelve.
    const parts = await admin.query(api.spareParts.list, {});
    expect(parts.map((part) => part.code)).toEqual(["BK-001"]);
    expect(parts[0]?.stock).toBe(10);
    const equipment = await admin.query(api.equipment.list, {});
    expect(equipment.map((row) => row.code).sort()).toEqual([
      "EQ-0001",
      "EQ-0002",
    ]);

    // 6. La copia de correo vuelve como metadatos: sin cuerpo, sin adjuntos y
    //    sin el .eml, que son del buzón y no de la copia de seguridad.
    const shares = await t.run((ctx) => ctx.db.query("mailShares").collect());
    expect(shares).toHaveLength(1);
    expect(shares[0]?.mode).toBe("summary");
    expect(shares[0]?.backupRestored).toBe(true);
    expect(shares[0]?.bodyText).toBeUndefined();
    expect(shares[0]?.attachments).toBeUndefined();
    expect(shares[0]?.emlStorageId).toBeUndefined();
    expect(shares[0]?.destinationReference).toBe("INC-0001");

    // 7. El rastro de un adjunto retirado vuelve con su `documentId` histórico:
    //    el documento no viaja en la copia y el esquema exige el campo.
    const [logEntry] = await t.run((ctx) =>
      ctx.db.query("incidentDocumentLog").collect(),
    );
    expect(logEntry?.documentId).toBe(retiredDocId);

    // 8. La auditoría no entra en el vaciado: sigue con su historia.
    const audit = await t.run((ctx) =>
      ctx.db.query("securityAuditLog").collect(),
    );
    const actions = audit.map((row) => row.action);
    expect(actions).toContain("workshop_backup_export");
    expect(actions).toContain("workshop_backup_restore");
  });

  test("una copia que el esquema rechaza a mitad no toca el taller", async () => {
    const t = backend();
    const { admin } = await seedWorkshop(t);
    const exported = await admin.action(api.workshopBackup.exportBackup, {});
    const before = await tableCounts(t);

    // La copia llega estropeada a mitad: al rastro de un adjunto retirado le
    // falta `documentId`, que el esquema exige. Es el fallo que dejó el taller a
    // medias cuando la restauración vaciaba antes de insertar.
    const payload = JSON.parse(exported.rawJson) as {
      tables: Record<string, Array<Record<string, unknown>>>;
    };
    delete payload.tables.incidentDocumentLog?.[0]?.documentId;

    await expect(
      admin.action(api.workshopBackup.restoreBackup, {
        rawJson: JSON.stringify(payload),
      }),
    ).rejects.toThrow(/taller sigue como estaba/);

    // Nada se vació ni se reescribió: los recuentos son los de antes de
    // intentarlo, y la copia de correo conserva su cuerpo y su modo original.
    expect(await tableCounts(t)).toEqual(before);
    const shares = await t.run((ctx) => ctx.db.query("mailShares").collect());
    expect(shares[0]?.mode).toBe("original");
    expect(shares[0]?.bodyText).toBe("Cuerpo del correo");
  });
});
