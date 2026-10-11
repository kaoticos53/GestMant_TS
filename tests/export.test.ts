import { describe, expect, test } from "vitest";
import { csvFilename, escapeCsvCell, toCsv } from "../src/lib/export";

describe("escapeCsvCell", () => {
  test("deja los textos sencillos tal cual", () => {
    expect(escapeCsvCell("Triac BTA16")).toBe("Triac BTA16");
    expect(escapeCsvCell("stock 5")).toBe("stock 5");
  });

  test("convierte null y undefined en cadena vacía", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  test("numera y booleanos se stringifican", () => {
    expect(escapeCsvCell(42)).toBe("42");
    expect(escapeCsvCell(0)).toBe("0");
    expect(escapeCsvCell(false)).toBe("false");
  });

  test("entrecomilla campos con punto y coma", () => {
    expect(escapeCsvCell("B-03; B-04")).toBe('"B-03; B-04"');
  });

  test("duplica las comillas y entrecomilla", () => {
    expect(escapeCsvCell('Dice "urgente"')).toBe('"Dice ""urgente"""');
  });

  test("entrecomilla saltos de línea", () => {
    expect(escapeCsvCell("línea1\nlínea2")).toBe('"línea1\nlínea2"');
    expect(escapeCsvCell("línea1\r\nlínea2")).toBe('"línea1\r\nlínea2"');
  });
});

describe("toCsv", () => {
  test("une cabecera y filas con CRLF y campos con `;`", () => {
    const csv = toCsv(
      ["Código", "Nombre"],
      [
        ["TRI-60004", "Triac; repuesto"],
        ["CAP-100u", 'Condensador "100µF"'],
      ],
    );
    expect(csv).toBe(
      'Código;Nombre\r\nTRI-60004;"Triac; repuesto"\r\nCAP-100u;"Condensador ""100µF"""',
    );
  });

  test("una tabla sin filas solo contiene la cabecera", () => {
    expect(toCsv(["A", "B"], [])).toBe("A;B");
  });

  test("rellena los huecos con cadena vacía", () => {
    expect(toCsv(["A", "B"], [[1, null]])).toBe("A;B\r\n1;");
  });
});

describe("csvFilename", () => {
  test("añade base, fecha ISO y extensión", () => {
    expect(csvFilename("repuestos")).toMatch(
      /^repuestos-\d{4}-\d{2}-\d{2}\.csv$/,
    );
  });
});
