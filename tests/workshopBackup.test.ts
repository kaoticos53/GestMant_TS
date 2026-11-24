import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import { BACKUP_VERSION } from "../src/lib/backup";
import { backend } from "./backend";

async function setup() {
  const t = backend();
  const { adminId, techId } = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", {
      name: "Admin",
      email: "admin@taller.es",
      role: "admin",
      active: true,
    });
    const techId = await ctx.db.insert("users", {
      name: "Técnico",
      email: "tech@taller.es",
      role: "technician",
      active: true,
    });
    return { adminId, techId };
  });

  return {
    t,
    admin: t.withIdentity({ subject: `${adminId}|s-admin` }),
    tech: t.withIdentity({ subject: `${techId}|s-tech` }),
  };
}

describe("Fase 2 TDD — workshopBackup (exportación y restauración completa)", () => {
  test("solo el administrador puede exportar o restaurar backups", async () => {
    const { t, tech } = await setup();

    await expect(
      t.action(api.workshopBackup.exportBackup, {}),
    ).rejects.toThrow();
    await expect(
      tech.action(api.workshopBackup.exportBackup, {}),
    ).rejects.toThrow(/administrador/i);
    await expect(
      tech.action(api.workshopBackup.restoreBackup, { rawJson: "{}" }),
    ).rejects.toThrow(/administrador/i);
  });

  test("exporta todos los datos operativos, restaura tras un vaciado y preserva relaciones e inmutabilidad de securityAuditLog", async () => {
    const { t, admin } = await setup();

    const eqId = await admin.mutation(api.equipment.create, {
      code: "EQ-BK01",
      name: "Cámara Backup",
      model: "HDC-3500",
      location: "Plató 1",
    });
    const partId = await admin.mutation(api.spareParts.create, {
      code: "BK-001",
      name: "Fusible 5A",
      category: "Electrónica",
      unit: "ud",
      stock: 10,
      minStock: 2,
      compatibleWith: [eqId],
    });

    // Exportar backup completo
    const exported = await admin.action(api.workshopBackup.exportBackup, {});
    expect(exported.rawJson).not.toContain("\n  ");
    expect(exported.summary.totalRecords).toBeGreaterThanOrEqual(4);
    const payload = JSON.parse(exported.rawJson) as {
      version: number;
      manifest: { totalRecords: number; tableCounts: Record<string, number> };
    };
    expect(payload.version).toBe(BACKUP_VERSION);
    expect(payload.manifest.totalRecords).toBe(exported.summary.totalRecords);
    expect(payload.manifest.tableCounts.equipment).toBe(1);

    // Añadir un dato posterior que no estaba en el backup
    await admin.mutation(api.spareParts.create, {
      code: "EXTRA-999",
      name: "No debe quedar tras restaurar",
      category: "Electrónica",
      unit: "ud",
      stock: 1,
      minStock: 0,
    });

    // Restaurar backup
    const restored = await admin.action(api.workshopBackup.restoreBackup, {
      rawJson: exported.rawJson,
    });
    expect(restored.restoredRecords).toBe(exported.summary.totalRecords);

    // El dato extra desapareció y los datos originales + relaciones volvieron
    const partsAfter = await admin.query(api.spareParts.list, {});
    expect(partsAfter.map((p) => p.code)).toEqual(["BK-001"]);
    const eqAfter = await admin.query(api.equipment.list, {});
    expect(eqAfter.map((e) => e.code)).toEqual(["EQ-BK01"]);
    expect(partsAfter[0]?.compatibleWith).toEqual([eqAfter[0]?._id]);

    // securityAuditLog registró exportación y restauración sin borrarse
    const logs = await t.run((ctx) =>
      ctx.db.query("securityAuditLog").collect(),
    );
    const actions = logs.map((l) => l.action);
    expect(actions).toContain("workshop_backup_export");
    expect(actions).toContain("workshop_backup_restore");
    expect(partId).toBeDefined();
  });
});
