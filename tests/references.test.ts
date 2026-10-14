import { describe, expect, test } from "vitest";
import {
  REFERENCE_PREFIX,
  formatReference,
  nextSequence,
  normalizeReference,
  parseReference,
  resumeSequence,
} from "../src/lib/references";

describe("formatReference — cómo se escribe una referencia", () => {
  test("prefijo, guion y cuatro cifras", () => {
    expect(formatReference("incident", 4)).toBe("INC-0004");
    expect(formatReference("partRequest", 7)).toBe("PET-0007");
    expect(formatReference("purchaseRequest", 1)).toBe("PC-0001");
    expect(formatReference("purchaseOrder", 12)).toBe("OC-0012");
  });

  test("cada serie tiene su prefijo", () => {
    expect(REFERENCE_PREFIX).toEqual({
      incident: "INC",
      partRequest: "PET",
      purchaseRequest: "PC",
      purchaseOrder: "OC",
    });
  });

  test("a partir de la quinta cifra no se recorta nada", () => {
    expect(formatReference("incident", 12345)).toBe("INC-12345");
  });
});

describe("parseReference — leer una referencia escrita", () => {
  test("dice de qué serie es y qué número lleva", () => {
    expect(parseReference("PET-0007")).toEqual({
      kind: "partRequest",
      sequence: 7,
    });
    expect(parseReference("OC-10000")).toEqual({
      kind: "purchaseOrder",
      sequence: 10000,
    });
  });

  test("lo que no repartimos nosotros no es una referencia", () => {
    for (const text of ["", "PET", "PET-", "X-1", "PET-0007 bis", "AB-12"]) {
      expect(parseReference(text), `«${text}»`).toBeNull();
    }
  });
});

describe("nextSequence — el número que toca repartir", () => {
  test("después del más alto, no después de contar filas", () => {
    // Es la regla que impide que una referencia gastada vuelva a repartirse: da
    // igual cuántas filas queden, lo que manda es la más alta que hay.
    expect(nextSequence("partRequest", ["PET-0001", "PET-0003"])).toBe(4);
    expect(nextSequence("partRequest", ["PET-0003"])).toBe(4);
  });

  test("las referencias de las otras series no mueven el número", () => {
    expect(
      nextSequence("partRequest", ["INC-0009", "PC-0004", "OC-0002"]),
    ).toBe(1);
  });

  test("lo que no es de nuestra serie tampoco", () => {
    expect(nextSequence("incident", ["XX-9999", "INC-", ""])).toBe(1);
  });

  test("sin ninguna repartida, la primera", () => {
    expect(nextSequence("incident", [])).toBe(1);
    // Vacío de verdad: la tabla no tenía filas.
    expect(nextSequence("incident", [undefined])).toBe(1);
  });

  test("los huecos por debajo no bajan el número", () => {
    expect(nextSequence("purchaseOrder", ["OC-0007"])).toBe(8);
  });

  test("ese número, escrito, es la referencia que toca", () => {
    expect(
      formatReference("incident", nextSequence("incident", ["INC-0009"])),
    ).toBe("INC-0010");
  });
});

describe("resumeSequence — por dónde va la serie cuando hay contador", () => {
  test("sin contador todavía, la serie arranca desde lo que ya está repartido", () => {
    // Es el caso de una instalación que ya tenía datos (o la muestra cargada)
    // antes de que existiera el contador.
    expect(resumeSequence("partRequest", ["PET-0007"], undefined)).toBe(8);
  });

  test("el contador manda aunque la serie se haya vaciado entera", () => {
    // La papelera borró las tres filas: no queda ninguna, pero el 1, el 2 y el 3
    // ya se gastaron y no pueden volver a repartirse.
    expect(resumeSequence("partRequest", [], 3)).toBe(4);
  });

  test("si el contador se quedó atrás, manda lo que hay en la tabla", () => {
    expect(resumeSequence("incident", ["INC-0012"], 3)).toBe(13);
  });

  test("las referencias de otras series no arrancan el contador", () => {
    expect(resumeSequence("incident", ["PET-0009", "OC-0040"], 0)).toBe(1);
  });

  test("sin contador y sin nada repartido, la primera", () => {
    expect(resumeSequence("incident", [], undefined)).toBe(1);
  });

  test("de cuatro cifras a cinco se cuenta igual", () => {
    // El orden de las referencias escritas deja de ser el numérico aquí, y por eso
    // el reparto comprueba que la que ha salido esté libre antes de darla.
    expect(
      formatReference(
        "incident",
        resumeSequence("incident", ["INC-9999"], 9999),
      ),
    ).toBe("INC-10000");
  });
});

describe("normalizeReference — lo que alguien teclea", () => {
  test("se acepta escrita como sea: en minúsculas, sin el prefijo o el número suelto", () => {
    for (const typed of ["inc-4", "INC-4", "4", " la 4 ", "Incidencia nº 4"]) {
      expect(normalizeReference("incident", typed), `«${typed}»`).toBe(
        "INC-0004",
      );
    }
  });

  test("cada serie normaliza a su prefijo", () => {
    expect(normalizeReference("partRequest", "pet-7")).toBe("PET-0007");
    expect(normalizeReference("purchaseOrder", "12")).toBe("OC-0012");
  });

  test("el número es lo que cuenta, no el prefijo que se escriba", () => {
    // Quien pregunta dice de qué serie busca; el prefijo tecleado se ignora.
    expect(normalizeReference("partRequest", "INC-0007")).toBe("PET-0007");
  });

  test("más de cuatro cifras se respetan tal cual", () => {
    expect(normalizeReference("incident", "INC-12345")).toBe("INC-12345");
  });

  test("el primer número es el que cuenta", () => {
    expect(normalizeReference("incident", "INC-0004 (2026)")).toBe("INC-0004");
  });

  test("sin ningún número no hay referencia que buscar", () => {
    for (const typed of ["", "   ", "la de la cámara", null, undefined]) {
      expect(
        normalizeReference("incident", typed),
        `«${String(typed)}»`,
      ).toBeNull();
    }
  });
});
