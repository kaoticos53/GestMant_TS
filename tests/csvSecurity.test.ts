import { describe, expect, test } from "vitest";
import { escapeCsvCell, toCsv } from "../src/lib/export";
import { historyRowsToCsv, type PurchaseHistoryRow } from "../src/lib/purchasing";

describe("Seguridad AppSec: Mitigación de CSV Formula Injection (CWE-1236)", () => {
  test("escapeCsvCell neutraliza fórmulas que comienzan por '=', '+', '-', '@', '\\t', '\\r'", () => {
    // Casos de inyección clásicos según OWASP
    const payloads = [
      "=cmd|'/C calc'!A0",
      "+cmd|'/C calc'!A0",
      "-5+2+cmd|'/C calc'!A0",
      "@SUM(1+1)*cmd|'/C calc'!A0",
      "\tDDE(\"cmd\";\"/C calc\";\"__DDE__\")",
      "\r=1+1",
    ];

    for (const payload of payloads) {
      const escaped = escapeCsvCell(payload);
      // Debe prefijarse con comilla simple para forzar texto literal
      expect(escaped.startsWith("'") || escaped.startsWith("\"'")).toBe(true);
    }
  });

  test("escapeCsvCell preserva cadenas legítimas normales y números sin alterarlos", () => {
    expect(escapeCsvCell("Bomba de achique 24V")).toBe("Bomba de achique 24V");
    expect(escapeCsvCell("Cámara HDC-4300")).toBe("Cámara HDC-4300");
    expect(escapeCsvCell(42)).toBe("42");
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  test("toCsv produce filas con fórmulas neutralizadas", () => {
    const header = ["Código", "Descripción", "Observaciones"];
    const rows = [
      ["REP-001", "Filtro aire", "=1+1"],
      ["REP-002", "@malicioso", "-riesgo"],
    ];

    const csv = toCsv(header, rows);
    expect(csv).toContain("REP-001;Filtro aire;'=1+1");
    expect(csv).toContain("REP-002;'@malicioso;'-riesgo");
  });

  test("historyRowsToCsv en compras neutraliza fórmulas de pedidos", () => {
    const maliciousRow: PurchaseHistoryRow = {
      orderId: "test_id" as unknown as PurchaseHistoryRow["orderId"],
      orderReference: "OC-0001",
      solicitudeCode: "=HYPERLINK(\"http://attacker.com\")",
      position: "1",
      description: "Sensor óptico",
      quantity: 1,
      receivedQuantity: 0,
      supplier: "@proveedor",
      observations: "+ejecutar",
      pendingQuantity: 1,
      orderedDate: "2026-10-21",
      receivedDate: "-",
      status: "pending",
    };

    const csv = historyRowsToCsv([maliciousRow]);
    expect(csv).toContain("\"'=HYPERLINK(\"\"http://attacker.com\"\")\"");
    expect(csv).toContain("'@proveedor");
    expect(csv).toContain("'+ejecutar");
  });
});
