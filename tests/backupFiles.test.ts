import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import type { Id } from "../src/convex/_generated/dataModel";
import { decodeBackupFile, type BackupFile } from "../src/lib/backup";
import { backend } from "./backend";

type TestBackend = ReturnType<typeof backend>;

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

async function storedText(
  t: TestBackend,
  storageId: Id<"_storage">,
): Promise<string> {
  const bytes = await t.run(async (ctx) => {
    const file = await ctx.storage.get(storageId);
    if (!file) return null;
    return [...new Uint8Array(await file.arrayBuffer())];
  });
  if (!bytes) throw new Error("El archivo no está en el almacén");
  return new TextDecoder().decode(new Uint8Array(bytes));
}

/**
 * Un taller con archivos en los tres sitios que los citan: el expediente de
 * una incidencia (también incrustado en su descripción), una petición de
 * repuesto y un manual con su versión anterior.
 */
async function seedWorkshopWithFiles(t: TestBackend, adminId: Id<"users">) {
  return await t.run(async (ctx) => {
    const incidentFile = await ctx.storage.store(
      new Blob(["foto-incidencia"], { type: "image/png" }),
    );
    const incidentId = await ctx.db.insert("incidents", {
      reference: "INC-0001",
      reporterName: "Proveedor",
      description: `Foto del equipo: /api/storage/${incidentFile}`,
      reportedAt: 1_795_179_963_000,
      status: "reported",
      history: [{ status: "reported", at: 1_795_179_963_000 }],
      createdAt: 1_795_179_963_000,
      updatedAt: 1_795_179_963_000,
    });
    await ctx.db.insert("incidentDocuments", {
      incidentId,
      name: "foto.png",
      storageId: incidentFile,
      author: "Administradora",
      createdAt: 1_795_179_963_000,
    });

    const requestFile = await ctx.storage.store(
      new Blob(["plano"], { type: "application/pdf" }),
    );
    await ctx.db.insert("partRequests", {
      reference: "PET-0001",
      requesterName: "Técnico",
      priority: "normal",
      status: "pending",
      lines: [],
      attachments: [
        {
          storageId: requestFile,
          name: "plano.pdf",
          kind: "document",
        },
      ],
      createdAt: 1_795_179_963_000,
    });

    const manualFile = await ctx.storage.store(
      new Blob(["manual"], { type: "application/pdf" }),
    );
    const previousManualFile = await ctx.storage.store(
      new Blob(["manual-anterior"], { type: "application/pdf" }),
    );
    const manualId = await ctx.db.insert("manuals", {
      title: "Manual de la cámara",
      kind: "file",
      type: "Equipo",
      storageId: manualFile,
      fileName: "manual.pdf",
      contentType: "application/pdf",
      size: 6,
      author: "Administradora",
      authorId: adminId,
      history: [
        {
          at: 1_795_179_963_000,
          action: "fileReplaced",
          by: "Administradora",
          file: {
            storageId: previousManualFile,
            fileName: "manual-anterior.pdf",
            contentType: "application/pdf",
            size: 14,
          },
        },
      ],
      createdAt: 1_795_179_963_000,
      updatedAt: 1_795_179_963_000,
    });

    return {
      incidentFile,
      requestFile,
      manualFile,
      previousManualFile,
      incidentId,
      manualId,
    };
  });
}

describe("archivos y adjuntos en la copia de seguridad", () => {
  test("exporta los bytes y la restauración los repone con ids nuevos", async () => {
    const { t, admin, adminId } = await setup();
    const seeded = await seedWorkshopWithFiles(t, adminId);

    const exported = await admin.action(api.workshopBackup.exportBackup, {});
    expect(exported.summary.fileCount).toBe(4);
    const payload = JSON.parse(exported.rawJson) as {
      version?: number;
      files?: BackupFile[];
    };
    // La copia nueva se marca con el formato interior v3: un cliente que solo
    // conoce v1/v2 no puede restaurarla ignorando sus archivos.
    expect(payload.version).toBe(3);
    const files = payload.files ?? [];
    expect(files.map((file) => file.storageId).sort()).toEqual(
      [
        seeded.incidentFile,
        seeded.requestFile,
        seeded.manualFile,
        seeded.previousManualFile,
      ]
        .map(String)
        .sort(),
    );
    const incidentCopy = files.find(
      (file) => file.storageId === seeded.incidentFile,
    );
    if (!incidentCopy) throw new Error("Falta la foto en la copia");
    expect(new TextDecoder().decode(decodeBackupFile(incidentCopy.data))).toBe(
      "foto-incidencia",
    );

    const restored = await admin.action(api.workshopBackup.restoreBackup, {
      rawJson: exported.rawJson,
    });
    expect(restored.restoredFiles).toBe(4);

    const after = await t.run(async (ctx) => {
      const documents = await ctx.db.query("incidentDocuments").collect();
      const requests = await ctx.db.query("partRequests").collect();
      const manuals = await ctx.db.query("manuals").collect();
      const incidents = await ctx.db.query("incidents").collect();
      return {
        document: documents[0],
        request: requests[0],
        manual: manuals[0],
        incident: incidents[0],
      };
    });

    if (!after.document?.storageId) throw new Error("No volvió el documento");
    if (!after.request?.attachments?.[0]?.storageId) {
      throw new Error("No volvió el adjunto de la petición");
    }
    if (!after.manual?.storageId) throw new Error("No volvió el manual");
    const previous = after.manual.history?.find(
      (entry) => entry.file !== undefined,
    )?.file?.storageId;
    if (!previous) throw new Error("No volvió la versión anterior");

    // Los ids del almacén de destino no son los del origen.
    expect(String(after.document.storageId)).not.toBe(
      String(seeded.incidentFile),
    );
    expect(String(after.request.attachments[0].storageId)).not.toBe(
      String(seeded.requestFile),
    );
    expect(String(after.manual.storageId)).not.toBe(String(seeded.manualFile));
    expect(String(previous)).not.toBe(String(seeded.previousManualFile));

    // Y los bytes son los mismos, también en la versión anterior del manual.
    expect(await storedText(t, after.document.storageId)).toBe(
      "foto-incidencia",
    );
    expect(await storedText(t, after.request.attachments[0].storageId)).toBe(
      "plano",
    );
    expect(await storedText(t, after.manual.storageId)).toBe("manual");
    expect(await storedText(t, previous)).toBe("manual-anterior");

    // La imagen incrustada en la descripción también apunta al archivo nuevo.
    expect(after.incident?.description).toContain(
      `/api/storage/${after.document.storageId}`,
    );
    expect(after.incident?.description).not.toContain(
      String(seeded.incidentFile),
    );
  });

  test("una copia con un archivo incoherente se rechaza antes de tocar el taller", async () => {
    const { admin } = await setup();
    const exported = await admin.action(api.workshopBackup.exportBackup, {});
    const payload = JSON.parse(exported.rawJson) as {
      tables: Record<string, unknown>;
      manifest: Record<string, unknown>;
    };
    // Se declara un archivo con tamaño distinto de sus bytes: el parser lo
    // detecta y la restauración ni siquiera empieza.
    const raw = JSON.stringify({
      ...payload,
      files: [
        {
          storageId: "storage-1",
          contentType: "text/plain",
          size: 4,
          data: "aGVsbG8=", // 5 bytes
        },
      ],
      manifest: {
        ...payload.manifest,
        fileCount: 1,
        fileBytes: 4,
      },
    });

    await expect(
      admin.action(api.workshopBackup.restoreBackup, { rawJson: raw }),
    ).rejects.toThrow(/tamaño/);
  });
});
