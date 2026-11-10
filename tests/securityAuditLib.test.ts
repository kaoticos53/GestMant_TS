import { describe, expect, test } from "vitest";
import { toCsv } from "../src/lib/export";
import {
  formatSecurityMetadata,
  securityActionLabel,
  securityAuditCsvTable,
} from "../src/lib/securityAudit";

describe("utilidades puras de auditoría de seguridad", () => {
  test("securityActionLabel traduce acciones conocidas y respeta desconocidas", () => {
    expect(securityActionLabel("role_change")).toBe("Cambio de rol");
    expect(securityActionLabel("global_rate_limit_reached")).toBe(
      "Umbral global anti-abuso",
    );
    expect(securityActionLabel("custom_event")).toBe("custom_event");
  });

  test("formatSecurityMetadata formatea JSON sin fallar en texto plano", () => {
    expect(formatSecurityMetadata(undefined)).toBe("—");
    expect(
      formatSecurityMetadata(
        JSON.stringify({ previousRole: "technician", newRole: "manager" }),
      ),
    ).toBe("previousRole: technician · newRole: manager");
    expect(formatSecurityMetadata("detalle plano")).toBe("detalle plano");
  });

  test("securityAuditCsvTable genera CSV neutralizando fórmulas CWE-1236", () => {
    const { header, rows } = securityAuditCsvTable([
      {
        _id: "log1",
        action: "role_change",
        actorEmail: "admin@taller.es",
        target: "=HYPERLINK(\"http://evil\")",
        metadata: JSON.stringify({ newRole: "admin" }),
        at: Date.UTC(2026, 10, 10, 12, 0),
      },
    ]);

    const csv = toCsv(header, rows);
    expect(csv).toContain("Fecha;Acción;Actor;Objetivo;Detalles");
    expect(csv).toContain("Cambio de rol");
    expect(csv).toContain("'=HYPERLINK");
  });
});

