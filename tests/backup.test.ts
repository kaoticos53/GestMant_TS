import { describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT,
  BACKUP_LEGACY_VERSION,
  BACKUP_PREVIOUS_VERSION,
  BACKUP_TABLES,
  BACKUP_VERSION,
  backupManifest,
  estimateRestoreSeconds,
  parseWorkshopBackup,
  remapBackupDocument,
  restoreSizeLevel,
} from "@/lib/backup";

describe("Backup y Restauración (Dominio puro)", () => {
  it("valida un archivo de backup correcto y calcula el resumen de registros", () => {
    const tables = {
      equipment: [{ _id: "eq_old_1", name: "Cámara", model: "HDC-3500" }],
      spareParts: [
        { _id: "sp_old_1", code: "AUD-01", name: "Cable", stock: 3 },
        { _id: "sp_old_2", code: "AUD-02", name: "Conector", stock: 5 },
      ],
    };
    const raw = JSON.stringify({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: 1_700_000_000_000,
      exportedBy: "admin@taller.es",
      tables,
      manifest: backupManifest(tables),
    });

    const parsed = parseWorkshopBackup(raw);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.ok).toBe(true);
    expect(parsed.summary.totalRecords).toBe(3);
    expect(parsed.summary.tableCounts.equipment).toBe(1);
    expect(parsed.summary.tableCounts.spareParts).toBe(2);
    expect(parsed.migratedFrom).toBeUndefined();
  });

  it("migra una copia v1 al formato actual", () => {
    const raw = JSON.stringify({
      format: BACKUP_FORMAT,
      version: BACKUP_LEGACY_VERSION,
      exportedAt: 1_700_000_000_000,
      exportedBy: "admin@taller.es",
      tables: {
        equipment: [{ _id: "eq_old_1", name: "Cámara" }],
      },
    });

    const parsed = parseWorkshopBackup(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.migratedFrom).toBe(1);
    expect(parsed.backup.version).toBe(BACKUP_VERSION);
    expect(parsed.backup.manifest.totalRecords).toBe(1);
    expect(parsed.backup.tables.equipment).toHaveLength(1);
  });

  it("migra una copia v2 sin archivos al formato actual", () => {
    const tables = { equipment: [{ _id: "e1", name: "Cámara" }] };
    const raw = JSON.stringify({
      format: BACKUP_FORMAT,
      version: BACKUP_PREVIOUS_VERSION,
      exportedAt: 1,
      exportedBy: "admin@taller.es",
      tables,
      manifest: backupManifest(tables),
    });

    const parsed = parseWorkshopBackup(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.migratedFrom).toBe(2);
    expect(parsed.backup.version).toBe(BACKUP_VERSION);
    expect(parsed.backup.files).toBeUndefined();
    expect(parsed.summary.fileCount).toBe(0);
  });

  it("migra una copia v2 con archivos sin perderlos", () => {
    const file = {
      storageId: "storage-1",
      contentType: "image/png",
      size: 5,
      data: "aGVsbG8=",
    };
    const tables = {
      incidentDocuments: [
        { _id: "doc-1", incidentId: "inc-1", storageId: "storage-1" },
      ],
    };
    const raw = JSON.stringify({
      format: BACKUP_FORMAT,
      version: BACKUP_PREVIOUS_VERSION,
      exportedAt: 1,
      exportedBy: "admin@taller.es",
      tables,
      files: [file],
      manifest: backupManifest(tables, [file]),
    });

    const parsed = parseWorkshopBackup(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.migratedFrom).toBe(2);
    expect(parsed.backup.version).toBe(BACKUP_VERSION);
    expect(parsed.backup.files).toEqual([file]);
    expect(parsed.summary.fileCount).toBe(1);
    expect(parsed.summary.fileBytes).toBe(5);
  });

  it("rechaza una copia v2 cuyo manifiesto no cuadra", () => {
    const tables = { equipment: [{ _id: "e1", name: "Cámara" }] };
    const raw = JSON.stringify({
      format: BACKUP_FORMAT,
      version: BACKUP_PREVIOUS_VERSION,
      exportedAt: 1,
      exportedBy: "admin@taller.es",
      tables,
      manifest: { totalRecords: 99, tableCounts: { equipment: 1 } },
    });

    expect(parseWorkshopBackup(raw).ok).toBe(false);
  });

  it("rechaza archivos inválidos, JSON corrupto o versión no soportada", () => {
    expect(parseWorkshopBackup("no es json").ok).toBe(false);
    expect(
      parseWorkshopBackup(
        JSON.stringify({ format: "otro", version: 1, tables: {} }),
      ).ok,
    ).toBe(false);
    expect(
      parseWorkshopBackup(
        JSON.stringify({ format: BACKUP_FORMAT, version: 99, tables: {} }),
      ).ok,
    ).toBe(false);
    // Una copia v3 con archivos no la puede leer un cliente anterior: su
    // parser solo conoce v1/v2 y la rechaza antes de restaurar sin ellos.
    expect(BACKUP_VERSION).toBe(3);
  });

  it("remapea relaciones padre-hijo y elimina _id / _creationTime antiguos", () => {
    const idMap = new Map<string, string>([
      ["eq_old", "eq_new"],
      ["model_old", "model_new"],
      ["sp_old", "sp_new"],
      ["inc_old", "inc_new"],
    ]);

    const remappedPart = remapBackupDocument(
      "spareParts",
      {
        _id: "sp_old",
        _creationTime: 123,
        code: "AUD-01",
        compatibleWith: ["eq_old", "eq_missing"],
        compatibleModels: ["model_old"],
      },
      idMap,
    );
    expect(remappedPart._id).toBeUndefined();
    expect(remappedPart._creationTime).toBeUndefined();
    expect(remappedPart.compatibleWith).toEqual(["eq_new"]);
    expect(remappedPart.compatibleModels).toEqual(["model_new"]);

    const remappedReq = remapBackupDocument(
      "partRequests",
      {
        _id: "req_old",
        equipmentId: "eq_old",
        incidentId: "inc_old",
        lines: [{ sparePartId: "sp_old", code: "AUD-01", quantity: 2 }],
      },
      idMap,
    );
    expect(remappedReq.equipmentId).toBe("eq_new");
    expect(remappedReq.incidentId).toBe("inc_new");
    expect(
      (remappedReq.lines as Array<{ sparePartId: string }>)[0]?.sparePartId,
    ).toBe("sp_new");

    // securityAuditLog nunca está en BACKUP_TABLES
    expect(BACKUP_TABLES).not.toContain("securityAuditLog");
  });

  it("estima la restauración con el ritmo medido y avisa por tramos", () => {
    expect(estimateRestoreSeconds(0)).toBe(2);
    expect(estimateRestoreSeconds(880)).toBe(2);
    expect(estimateRestoreSeconds(3_000)).toBe(6);
    expect(estimateRestoreSeconds(6_000)).toBe(12);
    expect(estimateRestoreSeconds(7_806)).toBe(16);

    expect(restoreSizeLevel(2_999)).toBe("normal");
    expect(restoreSizeLevel(3_000)).toBe("slow");
    expect(restoreSizeLevel(5_999)).toBe("slow");
    expect(restoreSizeLevel(6_000)).toBe("very-slow");
  });
});
