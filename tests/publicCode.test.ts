import { describe, expect, test } from "vitest";
import {
  PUBLIC_CODE_ALPHABET,
  PUBLIC_CODE_GROUP,
  PUBLIC_CODE_LENGTH,
  confusablePublicCodeChars,
  formatPublicCode,
  normalizePublicCode,
  publicCodeFrom,
} from "../src/lib/publicCode";

/** Bytes a partir de un puñado de números, para no escribir `Uint8Array` a mano. */
function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

/** Los bytes que hacen falta, todos distintos, para un código completo. */
function enoughBytes(offset = 0): Uint8Array {
  return Uint8Array.from(
    { length: PUBLIC_CODE_LENGTH },
    (_unused, index) => index + offset,
  );
}

describe("el alfabeto de los códigos", () => {
  test("son 32 caracteres, sin repetir y sin los que se confunden", () => {
    expect(PUBLIC_CODE_ALPHABET).toHaveLength(32);
    expect(new Set(PUBLIC_CODE_ALPHABET).size).toBe(32);
    // Ni cero ni O, ni uno ni I: es lo que evita el «¿es una O o un cero?» cuando
    // el código se dicta por teléfono.
    for (const confusable of ["O", "0", "1", "I"]) {
      expect(PUBLIC_CODE_ALPHABET).not.toContain(confusable);
    }
    // Y sin letras que se salgan de lo que se espera ver en un código.
    expect(PUBLIC_CODE_ALPHABET).toMatch(/^[A-Z2-9]+$/);
  });

  test("32 justos: cada carácter sale de cinco bits, sin sesgo", () => {
    // Recorriendo los 256 valores de un byte, cada carácter recibe exactamente
    // ocho: la cuenta que demuestra que no hay que descartar bytes ni corregir
    // nada después.
    const all = Uint8Array.from({ length: 256 }, (_unused, value) => value);
    const counts = new Map<string, number>();
    for (let start = 0; start < all.length; start += PUBLIC_CODE_LENGTH) {
      for (const char of publicCodeFrom(
        all.slice(start, start + PUBLIC_CODE_LENGTH),
      )) {
        counts.set(char, (counts.get(char) ?? 0) + 1);
      }
    }
    expect(counts.size).toBe(32);
    expect([...counts.values()].every((count) => count === 8)).toBe(true);
  });
});

describe("el reparto de un código", () => {
  test("tiene la longitud pedida y sale solo del alfabeto", () => {
    const code = publicCodeFrom(Uint8Array.from({ length: 64 }, () => 200));
    expect(code).toHaveLength(PUBLIC_CODE_LENGTH);
    for (const char of code) expect(PUBLIC_CODE_ALPHABET).toContain(char);
  });

  test("cada byte se recorta a cinco bits, en el orden en que llegan", () => {
    // 0 → «2», 31 → «Z», 32 → «2» otra vez (se queda con los cinco bits de abajo)
    // y 255 → «Z». Es la cuenta, sin azar de por medio.
    expect(publicCodeFrom(bytes(0, 31, 32, 255, 1, 2, 3, 4))).toBe("2Z2Z3456");
    expect(publicCodeFrom(bytes(0, 1, 2, 3, 4, 5, 6, 7))).toBe("23456789");
    expect(publicCodeFrom(bytes(31, 31, 31, 31, 31, 31, 31, 31))).toBe(
      "ZZZZZZZZ",
    );
  });

  test("los mismos bytes dan el mismo código, y otros bytes, otro", () => {
    expect(publicCodeFrom(enoughBytes())).toBe(publicCodeFrom(enoughBytes()));
    expect(publicCodeFrom(enoughBytes())).not.toBe(
      publicCodeFrom(enoughBytes(3)),
    );
  });

  test("sin bytes suficientes no se inventa un código a medias", () => {
    expect(() => publicCodeFrom(bytes(1, 2, 3))).toThrow(/bytes de azar/);
  });
});

describe("cómo se enseña un código", () => {
  test("en dos grupos de cuatro, que es como se dicta", () => {
    expect(PUBLIC_CODE_GROUP).toBe(4);
    expect(formatPublicCode("A7K2QX9M")).toBe("A7K2-QX9M");
  });

  test("da igual cómo llegue: se enseña siempre igual", () => {
    const expected = "A7K2-QX9M";
    for (const written of [
      "A7K2QX9M",
      "a7k2qx9m",
      "A7K2-QX9M",
      "a7k2 qx9m",
      " A7K2.QX9M ",
      "A7K2_QX9M",
    ]) {
      expect(formatPublicCode(written), `«${written}»`).toBe(expected);
    }
  });

  test("lo que no tiene forma de código se enseña como se pueda", () => {
    // El formateo no es un validador: solo agrupa. Lo que no vale lo dice
    // `normalizePublicCode`.
    expect(formatPublicCode("")).toBe("");
    expect(formatPublicCode("AB")).toBe("AB");
    expect(formatPublicCode("ABCDEFGHIJ")).toBe("ABCD-EFGH-IJ");
  });
});

describe("lo que se escribió en la consulta", () => {
  test("se acepta como llegue y se busca en su forma canónica", () => {
    for (const written of [
      "A7K2QX9M",
      "a7k2qx9m",
      "a7k2-qx9m",
      "A7K2 QX9M",
      " a7k2.qx9m ",
    ]) {
      expect(normalizePublicCode(written), `«${written}»`).toBe("A7K2QX9M");
    }
  });

  test("lo que no puede ser un código no se busca: se dice", () => {
    for (const written of [
      "",
      "   ",
      "A7K2QX9", // le falta un carácter
      "A7K2QX9MM", // le sobra
      "la del monitor",
      "INC-0004", // la referencia interna no es un código
      "A7K2QX9O", // con la O de más
      "A7K2QX90", // o con un cero
      "A7K2QX91", // o con un uno
      "A7K2QX9I",
    ]) {
      expect(normalizePublicCode(written), `«${written}»`).toBeNull();
    }
    expect(normalizePublicCode(null)).toBeNull();
    expect(normalizePublicCode(undefined)).toBeNull();
  });

  test("los caracteres que se confunden se señalan, sin repetir", () => {
    expect(confusablePublicCodeChars("A7K2-QX90")).toBe("0");
    expect(confusablePublicCodeChars("O0I1l")).toBe("O0I1");
    // La L se queda fuera de la lista porque está en el alfabeto: sin ningún uno
    // que la confunda, no hay nada que avisar.
    expect(confusablePublicCodeChars("LKJH2345")).toBe("");
    expect(confusablePublicCodeChars("A7K2QX9M")).toBe("");
    expect(confusablePublicCodeChars("inc-0004")).toBe("I0");
  });
});
