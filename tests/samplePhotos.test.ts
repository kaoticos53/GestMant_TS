import zlib from "node:zlib";
import { describe, expect, test } from "vitest";
import { SAMPLE_PHOTOS, samplePhotoBytes } from "../src/lib/samplePhotos";

/**
 * Un PNG troceado en sus bloques: longitud, tipo, datos y suma de control. Se
 * lee a mano porque la prueba no necesita un decodificador de imágenes: basta
 * con comprobar que lo que va a guardarse en el almacén es un PNG de verdad y no
 * un puñado de bytes que el navegador no sabría pintar.
 */
function chunksOf(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: { type: string; data: Uint8Array; crc: number }[] = [];
  let at = 8; // la firma
  while (at + 12 <= bytes.length) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...bytes.slice(at + 4, at + 8));
    const data = bytes.slice(at + 8, at + 8 + length);
    const crc = view.getUint32(at + 8 + length);
    chunks.push({ type, data, crc });
    if (type === "IEND") break;
    at += 12 + length;
  }
  return { chunks, end: at };
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe("las fotos de la muestra", () => {
  test("cada una es un PNG válido: firma, bloques, sumas y píxeles", () => {
    expect(SAMPLE_PHOTOS.length).toBeGreaterThan(0);

    for (const photo of SAMPLE_PHOTOS) {
      const bytes = samplePhotoBytes(photo);
      expect([...bytes.slice(0, 8)]).toEqual(PNG_SIGNATURE);

      const { chunks, end } = chunksOf(bytes);
      expect(chunks.map((chunk) => chunk.type)).toEqual([
        "IHDR",
        "IDAT",
        "IEND",
      ]);
      // No sobra nada detrás del último bloque: el decodificador de la muestra
      // devuelve la foto entera, ni un byte de más.
      expect(end + 12).toBe(bytes.length);

      // El IHDR dice lo que dicen las fotos: 80×60, 8 bits por canal, RGB.
      const ihdr = new DataView(
        chunks[0].data.buffer,
        chunks[0].data.byteOffset,
        chunks[0].data.byteLength,
      );
      expect(ihdr.getUint32(0)).toBe(80);
      expect(ihdr.getUint32(4)).toBe(60);
      expect(chunks[0].data[8]).toBe(8);
      expect(chunks[0].data[9]).toBe(2);

      for (const chunk of chunks) {
        const type = Buffer.from(chunk.type, "ascii");
        expect(zlib.crc32(Buffer.concat([type, chunk.data]))).toBe(chunk.crc);
      }

      // El bloque de datos infla justo a una fila por píxel más el byte de
      // filtro: si no, el navegador no sabría pintarla.
      const raw = zlib.inflateSync(Buffer.from(chunks[1].data));
      expect(raw.length).toBe(60 * (1 + 80 * 3));
    }
  });

  test("son tres fotos distintas, cada una con su vale de 32 caracteres", () => {
    const tickets = SAMPLE_PHOTOS.map((photo) => photo.ticket);
    expect(new Set(tickets).size).toBe(tickets.length);
    for (const ticket of tickets) {
      // El mismo formato que reparte el formulario público.
      expect(ticket).toMatch(/^[0-9a-f]{32}$/);
    }

    const photos = SAMPLE_PHOTOS.map((photo) =>
      Buffer.from(samplePhotoBytes(photo)).toString("base64"),
    );
    expect(new Set(photos).size).toBe(photos.length);

    // Todas cumplen su ventana de cortesía: son las que la limpieza de la noche
    // se lleva.
    for (const photo of SAMPLE_PHOTOS) {
      expect(photo.ageDays).toBeGreaterThan(1);
    }
  });
});
