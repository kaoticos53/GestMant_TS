import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  BACKUP_VERSION,
  decodeBackupFile,
  parseWorkshopBackup,
} from "../src/lib/backup";

function fixture(name: string): string {
  return readFileSync(
    new URL(`./fixtures/backup/${name}`, import.meta.url),
    "utf8",
  );
}

describe("compatibilidad de copias congeladas v1/v2/v3", () => {
  test("una copia v1 sin manifiesto se migra y conserva sus filas", () => {
    const parsed = parseWorkshopBackup(fixture("v1.json"));
    if (!parsed.ok) throw new Error(parsed.error);

    expect(parsed.migratedFrom).toBe(1);
    expect(parsed.backup.version).toBe(BACKUP_VERSION);
    expect(parsed.backup.files).toBeUndefined();
    expect(parsed.summary.totalRecords).toBe(1);
    expect(parsed.summary.tableCounts.equipment).toBe(1);
    expect(parsed.backup.tables.equipment?.[0]?.code).toBe("EQ-001");
  });

  test("una copia v2 con manifiesto y sin archivos se lee sin inventar files", () => {
    const parsed = parseWorkshopBackup(fixture("v2-sin-archivos.json"));
    if (!parsed.ok) throw new Error(parsed.error);

    expect(parsed.migratedFrom).toBe(2);
    expect(parsed.backup.version).toBe(BACKUP_VERSION);
    expect(parsed.backup.files).toBeUndefined();
    expect(parsed.summary.fileCount).toBe(0);
    expect(parsed.summary.tableCounts.spareParts).toBe(1);
  });

  test("una copia v2 con archivos conserva los bytes al migrar", () => {
    const parsed = parseWorkshopBackup(fixture("v2-con-archivos.json"));
    if (!parsed.ok) throw new Error(parsed.error);

    expect(parsed.migratedFrom).toBe(2);
    expect(parsed.backup.files).toHaveLength(1);
    const file = parsed.backup.files?.[0];
    if (!file) throw new Error("Falta el archivo de la copia v2");
    expect(file.storageId).toBe("storage-legacy-1");
    expect(new TextDecoder().decode(decodeBackupFile(file.data))).toBe("hello");
  });

  test("una copia v3 actual conserva archivos y no se marca como migrada", () => {
    const parsed = parseWorkshopBackup(fixture("v3-con-archivos.json"));
    if (!parsed.ok) throw new Error(parsed.error);

    expect(parsed.migratedFrom).toBeUndefined();
    expect(parsed.backup.version).toBe(BACKUP_VERSION);
    expect(parsed.summary.fileCount).toBe(1);
    expect(parsed.summary.fileBytes).toBe(5);
    const file = parsed.backup.files?.[0];
    if (!file) throw new Error("Falta el archivo de la copia v3");
    expect(new TextDecoder().decode(decodeBackupFile(file.data))).toBe("mundo");
  });

  test("una copia v3 con el manifiesto alterado se rechaza antes de restaurar", () => {
    const parsed = parseWorkshopBackup(
      fixture("v3-manifiesto-incorrecto.json"),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/total de registros|manifiesto/i);
  });
});
