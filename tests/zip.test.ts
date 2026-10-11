import { describe, expect, test } from "vitest";
import { createZip, crc32, type ZipEntry } from "../src/lib/zip";
import { readZip } from "./zipReader";

const encoder = new TextEncoder();

/** Un archivo del paquete, de texto para poder compararlo de un vistazo. */
const file = (name: string, content: string): ZipEntry => ({
  name,
  bytes: encoder.encode(content),
});

describe("el CRC-32", () => {
  test("el valor de siempre para «123456789»", () => {
    expect(crc32(encoder.encode("123456789"))).toBe(0xcbf43926);
  });

  test("vacío es cero y cada byte cuenta", () => {
    expect(crc32(new Uint8Array())).toBe(0);
    expect(crc32(encoder.encode("parte"))).not.toBe(
      crc32(encoder.encode("parte ")),
    );
  });
});

describe("el paquete ZIP", () => {
  const fecha = new Date(2026, 9, 9, 18, 30, 12);

  test("lleva los archivos con su nombre, su tamaño y su contenido", () => {
    const bytes = createZip(
      [
        file("parte-inc-0004-2026-10-09.md", "# Parte\n"),
        file("fotos/01-foco.png", "png"),
      ],
      fecha,
    );
    const pdf = Buffer.from(bytes).toString("latin1");

    expect(pdf.startsWith("PK\u0003\u0004")).toBe(true);
    expect(readZip(bytes).map((entry) => [entry.name, entry.content])).toEqual([
      ["parte-inc-0004-2026-10-09.md", "# Parte\n"],
      ["fotos/01-foco.png", "png"],
    ]);
    // El índice central y su final cierran el archivo: el final dice cuántos
    // archivos hay, dónde está el índice y que no lleva comentario.
    expect(pdf).toContain("PK\u0001\u0002");
    const end = new DataView(bytes.buffer, bytes.byteLength - 22, 22);
    expect(end.getUint32(0, true)).toBe(0x06054b50);
    expect(end.getUint16(8, true)).toBe(2);
    expect(end.getUint16(10, true)).toBe(2);
    expect(end.getUint16(20, true)).toBe(0);
    expect(end.getUint32(12, true) + end.getUint32(16, true)).toBe(
      bytes.byteLength - 22,
    );
  });

  test("cada archivo dice dónde está el suyo y lo que ocupa", () => {
    const bytes = createZip(
      [file("a.txt", "uno"), file("b.txt", "dos")],
      fecha,
    );
    const view = new DataView(bytes.buffer);
    // El primer archivo, según su ficha en el índice central del final.
    const index = view.getUint32(bytes.length - 22 + 16, true);
    const first = view.getUint32(index + 42, true);
    expect(view.getUint32(first, true)).toBe(0x04034b50);
    // El segundo empieza donde acaba el primero: su cabecera y sus bytes.
    const second = first + 30 + 5 + 3;
    expect(view.getUint32(second, true)).toBe(0x04034b50);
    expect(view.getUint16(first + 4, true)).toBe(20); // versión
    expect(view.getUint16(first + 6, true)).toBe(0x0800); // nombres en UTF-8
    expect(view.getUint32(first + 14, true)).toBe(crc32(encoder.encode("uno")));
    expect(view.getUint32(first + 18, true)).toBe(3);
    expect(view.getUint32(first + 22, true)).toBe(3);
  });

  test("un paquete vacío sigue siendo un ZIP válido", () => {
    const bytes = createZip([], fecha);
    expect(bytes).toHaveLength(22);
    expect(readZip(bytes)).toEqual([]);
  });

  test("la misma entrega, dos veces, sale byte a byte igual", () => {
    const entries = [file("parte.md", "hola"), file("fotos/01.png", "png")];
    expect(createZip(entries, fecha)).toEqual(createZip(entries, fecha));
  });

  test("los acentos de los nombres viajan como UTF-8", () => {
    const bytes = createZip(
      [file("fotos/01-núria-canó.jpg", "jpg"), file("parte-INC-0004.md", "x")],
      fecha,
    );
    expect(readZip(bytes).map((entry) => entry.name)).toEqual([
      "fotos/01-núria-canó.jpg",
      "parte-INC-0004.md",
    ]);
  });

  test("la fecha va en el formato del ZIP, con la hora y el día que toca", () => {
    const bytes = createZip(
      [file("a.txt", "a")],
      new Date(2026, 9, 9, 18, 30, 12),
    );
    const view = new DataView(bytes.buffer);
    // Hora: 18 << 11 | 30 << 5 | 12 / 2 = 37830. Día: (2026-1980) << 9 | 10 << 5 | 9.
    expect(view.getUint16(10, true)).toBe(37830);
    expect(view.getUint16(12, true)).toBe((2026 - 1980) * 512 + 10 * 32 + 9);
    // Antes de 1980 no se puede escribir: se recorta al mínimo del formato.
    const viejo = createZip([file("a.txt", "a")], new Date(1970, 0, 1));
    expect(new DataView(viejo.buffer).getUint16(12, true)).toBe(1 * 32 + 1);
  });
});
