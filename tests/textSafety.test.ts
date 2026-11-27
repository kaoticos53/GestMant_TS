import { describe, expect, test } from "vitest";
import { formatMailChunk } from "../src/lib/ai/memory";
import { safeSlice, toWellFormedText, truncateWithEllipsis } from "../src/lib/text";

const LONE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/** Lo mismo que hace Convex al serializar: JSON válido de ida y vuelta. */
function survivesJson(value: string): boolean {
  return !LONE.test(value) && JSON.parse(JSON.stringify(value)) === value;
}

describe("texto seguro para Unicode (indexación de correo en la IA)", () => {
  test("safeSlice no parte un emoji por la mitad", () => {
    const text = "ab😀cd"; // 😀 ocupa las posiciones 2 y 3
    expect(safeSlice(text, 3)).toBe("ab");
    expect(safeSlice(text, 4)).toBe("ab😀");
    expect(safeSlice(text, 100)).toBe(text);
    expect(survivesJson(safeSlice(text, 3))).toBe(true);
  });

  test("toWellFormedText repara medios pares sueltos", () => {
    expect(toWellFormedText("a\uD83Db")).toBe("a\uFFFDb");
    expect(toWellFormedText("a\uDE00b")).toBe("a\uFFFDb");
    expect(toWellFormedText("ok 😀")).toBe("ok 😀");
  });

  test("truncateWithEllipsis respeta el límite y añade «…»", () => {
    const result = truncateWithEllipsis("x".repeat(10) + "😀😀", 12);
    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(12);
    expect(survivesJson(result)).toBe(true);
  });

  test("formatMailChunk genera texto válido con emojis en el límite de recorte", () => {
    // Extracto cuyo carácter 119 cae justo en medio de un emoji.
    const snippet = `${"a".repeat(118)}😀 resto del mensaje`;
    const chunk = formatMailChunk({
      messageId: "m1",
      subject: `${"b".repeat(88)}🔧 asunto largo con más texto`,
      fromName: "Proveedor",
      fromAddress: "p@x.es",
      snippet,
    });
    expect(survivesJson(chunk.compactText)).toBe(true);
    expect(survivesJson(chunk.title)).toBe(true);
  });
});
