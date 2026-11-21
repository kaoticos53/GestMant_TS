import { describe, expect, test } from "vitest";
import schema from "../src/convex/schema";
import {
  CAPABILITIES,
  DEFAULT_GRANTS,
  type Capability,
} from "../src/lib/permissions";
import {
  BODY_HTML_MAX_CHARS,
  BODY_TEXT_MAX_CHARS,
  DESTINATION_AUDIENCE,
  DESTINATION_LABELS,
  DESTINATION_TYPES,
  MAX_SHARE_BYTES,
  ORPHAN_RETENTION_MS,
  SHARE_CAPABILITY,
  SUMMARY_MAX_CHARS,
  allowsOriginal,
  buildShareSummary,
  canReadSharedMail,
  fitsShareLimit,
  orphanPurgeAt,
  resolveShareMode,
  shareSnapshotBytes,
  truncateShareText,
  type MailShareDestinationType,
} from "../src/lib/mailShare";

const grants = (...allowed: Capability[]): Partial<Record<Capability, boolean>> =>
  Object.fromEntries(allowed.map((item) => [item, true]));

describe("mailShares: esquema", () => {
  const indexNames = () =>
    schema.tables.mailShares.indexes
      .map((index) => index.indexDescriptor)
      .sort();
  const indexFields = (name: string) =>
    schema.tables.mailShares.indexes.find(
      (index) => index.indexDescriptor === name,
    )?.fields;

  test("la tabla existe con sus cuatro índices", () => {
    expect(schema.tables.mailShares).toBeDefined();
    expect(indexNames()).toEqual([
      "by_client_share",
      "by_destination",
      "by_orphan_purge",
      "by_source_message",
    ]);
  });

  test("cada índice apunta a los campos que consulta el backend", () => {
    expect(indexFields("by_destination")).toEqual([
      "destinationType",
      "destinationId",
      "sharedAt",
    ]);
    expect(indexFields("by_orphan_purge")).toEqual(["orphanPurgeAt"]);
    expect(indexFields("by_client_share")).toEqual([
      "sharedBy",
      "clientShareId",
    ]);
    expect(indexFields("by_source_message")).toEqual(["sourceMessageId"]);
  });
});

describe("mailShares: capacidad createIncidentFromMail", () => {
  test("está en el catálogo, en el grupo Incidencias", () => {
    const item = CAPABILITIES.find(
      (entry) => entry.id === "createIncidentFromMail",
    );
    expect(item).toBeDefined();
    expect(item?.group).toBe("Incidencias");
    expect(item?.locked).not.toBe(true);
  });

  test("nace activa para administrador, responsable y técnico, y apagada para invitado", () => {
    expect(DEFAULT_GRANTS.admin.createIncidentFromMail).toBe(true);
    expect(DEFAULT_GRANTS.manager.createIncidentFromMail).toBe(true);
    expect(DEFAULT_GRANTS.technician.createIncidentFromMail).toBe(true);
    expect(DEFAULT_GRANTS.guest.createIncidentFromMail).toBe(false);
  });

  test("todos los roles declaran la capacidad (ningún default incompleto)", () => {
    for (const value of Object.values(DEFAULT_GRANTS)) {
      expect(typeof value.createIncidentFromMail).toBe("boolean");
    }
  });
});

describe("mailShares: modos y destinos", () => {
  test("cada tipo de destino tiene etiqueta y capacidades", () => {
    for (const type of DESTINATION_TYPES) {
      expect(DESTINATION_LABELS[type]).not.toBe("");
      expect(Array.isArray(DESTINATION_AUDIENCE[type])).toBe(true);
      expect(SHARE_CAPABILITY[type]).toBeTruthy();
    }
  });

  test("el manual no admite original; el resto sí", () => {
    expect(allowsOriginal("manual")).toBe(false);
    for (const type of DESTINATION_TYPES.filter((item) => item !== "manual")) {
      expect(allowsOriginal(type)).toBe(true);
    }
  });

  test("pedir original en un manual se rechaza, no se degrada en silencio", () => {
    const result = resolveShareMode("manual", "original");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Manual");
  });

  test("resumen y original válidos se conservan", () => {
    expect(resolveShareMode("manual", "summary")).toEqual({
      ok: true,
      mode: "summary",
    });
    expect(resolveShareMode("incident", "original")).toEqual({
      ok: true,
      mode: "original",
    });
  });

  test("compras comparten la capacidad de su módulo", () => {
    expect(SHARE_CAPABILITY.purchaseOrder).toBe("managePurchasing");
    expect(SHARE_CAPABILITY.purchaseRequest).toBe("managePurchasing");
  });
});

describe("mailShares: resumen y tamaño", () => {
  test("el resumen colapsa espacios y saltos de línea", () => {
    expect(buildShareSummary("  Hola,\n\n  adjunto el   presupuesto.  ")).toBe(
      "Hola, adjunto el presupuesto.",
    );
  });

  test("sin texto legible el resumen usa el asunto", () => {
    expect(buildShareSummary("   ", "Presupuesto SAT")).toBe("Presupuesto SAT");
    expect(buildShareSummary("", "")).toBe("");
  });

  test("el resumen no supera su límite", () => {
    const summary = buildShareSummary("a".repeat(SUMMARY_MAX_CHARS * 2));
    expect(summary.length).toBe(SUMMARY_MAX_CHARS);
  });

  test("recortar avisa de que hubo recorte", () => {
    expect(truncateShareText("corto", 10)).toEqual({
      value: "corto",
      truncated: false,
    });
    expect(truncateShareText("12345678901", 10)).toEqual({
      value: "1234567890",
      truncated: true,
    });
  });

  test("el recorte no parte un par sustituto", () => {
    const emoji = "🙂";
    const { value } = truncateShareText(`ab${emoji}cd`, 3);
    expect(value).toBe("ab");
  });

  test("los límites de cuerpo son los de SPEC-0018", () => {
    expect(BODY_TEXT_MAX_CHARS).toBe(64 * 1024);
    expect(BODY_HTML_MAX_CHARS).toBe(512 * 1024);
    expect(MAX_SHARE_BYTES).toBe(50 * 1024 * 1024);
  });

  test("el tamaño suma cuerpo, adjuntos y .eml, y respeta los 50 MB", () => {
    expect(
      shareSnapshotBytes({
        bodyText: 100,
        bodyHtml: 200,
        attachments: 300,
        eml: 400,
      }),
    ).toBe(1000);
    expect(fitsShareLimit(MAX_SHARE_BYTES)).toBe(true);
    expect(fitsShareLimit(MAX_SHARE_BYTES + 1)).toBe(false);
  });

  test("las huérfanas vencen a los siete días fijos", () => {
    const deletedAt = 1_000_000;
    expect(orphanPurgeAt(deletedAt) - deletedAt).toBe(ORPHAN_RETENTION_MS);
    expect(ORPHAN_RETENTION_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe("mailShares: audiencia del destino", () => {
  const base = {
    active: true,
    isAnonymous: false,
  } as const;

  test("un miembro activo ve las copias de incidencias y peticiones sin capacidades", () => {
    for (const destinationType of [
      "incident",
      "request",
    ] as MailShareDestinationType[]) {
      expect(canReadSharedMail({ ...base, destinationType, grants: {} })).toBe(
        true,
      );
    }
  });

  test("en equipos, manuales y compras manda la capacidad del módulo", () => {
    expect(
      canReadSharedMail({
        ...base,
        destinationType: "equipment",
        grants: grants("viewEquipment"),
      }),
    ).toBe(true);
    expect(
      canReadSharedMail({
        ...base,
        destinationType: "equipment",
        grants: grants("viewManuals"),
      }),
    ).toBe(false);
    expect(
      canReadSharedMail({
        ...base,
        destinationType: "manual",
        grants: grants("manageManuals"),
      }),
    ).toBe(true);
    expect(
      canReadSharedMail({
        ...base,
        destinationType: "purchaseOrder",
        grants: grants("viewPurchasing"),
      }),
    ).toBe(true);
    expect(
      canReadSharedMail({
        ...base,
        destinationType: "purchaseRequest",
        grants: grants("viewInventory"),
      }),
    ).toBe(false);
  });

  test("en la papelera de incidencias y peticiones solo entra la coordinación", () => {
    expect(
      canReadSharedMail({
        ...base,
        destinationType: "incident",
        destinationInTrash: true,
        grants: grants("viewIncidents"),
      }),
    ).toBe(false);
    expect(
      canReadSharedMail({
        ...base,
        destinationType: "incident",
        destinationInTrash: true,
        grants: grants("manageIncidents"),
      }),
    ).toBe(true);
    expect(
      canReadSharedMail({
        ...base,
        destinationType: "request",
        destinationInTrash: true,
        grants: grants("decideRequests"),
      }),
    ).toBe(true);
  });

  test("el invitado, la sesión anónima y la cuenta de baja no ven copias", () => {
    expect(
      canReadSharedMail({
        ...base,
        destinationType: "incident",
        isAnonymous: true,
      }),
    ).toBe(false);
    expect(
      canReadSharedMail({
        ...base,
        destinationType: "incident",
        active: false,
      }),
    ).toBe(false);
    expect(
      canReadSharedMail({
        destinationType: "incident",
        grants: grants("manageIncidents"),
      }),
    ).toBe(false);
  });

  test("el administrador ve las copias de cualquier destino", () => {
    for (const destinationType of DESTINATION_TYPES) {
      expect(
        canReadSharedMail({ ...base, destinationType, isAdmin: true }),
      ).toBe(true);
    }
  });
});
