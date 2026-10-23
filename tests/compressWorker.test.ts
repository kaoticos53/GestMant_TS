import { describe, expect, test } from "vitest";
import { compressImageFile } from "../src/lib/imageCompress";

describe("Web Worker de compresión de imágenes (compress.worker.ts)", () => {
  test("compressImageFile realiza fallback seguro si Worker o OffscreenCanvas no están disponibles", async () => {
    // Archivo simulado superior a MIN_COMPRESS_BYTES
    const bigBytes = new Uint8Array(1.5 * 1024 * 1024);
    const file = new File([bigBytes], "foto_averia.jpg", { type: "image/jpeg" });

    // En entorno Vitest / Node no hay Worker nativo con OffscreenCanvas;
    // la llamada debe degradar suavemente sin romper la ejecución
    const result = await compressImageFile(file);

    expect(result).toBeDefined();
    expect(result.name).toBe("foto_averia.jpg");
    expect(result.type).toBe("image/jpeg");
  });

  test("Las imágenes que no requieren compresión retornan intactas inmediatamente", async () => {
    const smallFile = new File(["contenido ligero"], "manual.pdf", {
      type: "application/pdf",
    });

    const result = await compressImageFile(smallFile);
    expect(result).toBe(smallFile);
  });
});
