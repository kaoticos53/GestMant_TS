import { describe, expect, test } from "vitest";
import {
  MIN_COMPRESS_BYTES,
  compressedImageName,
  compressedImageType,
  compressImageFile,
  fittedImageSize,
  isCompressibleImage,
  shouldCompressImage,
} from "../src/lib/imageCompress";

/** Una foto de móvil: doce megapíxeles y unos cuantos megas. */
const MOBILE_PHOTO = { type: "image/jpeg", size: 4 * 1024 * 1024 };

describe("recompresión de fotos en el navegador", () => {
  test("la foto se reduce a lo que se mira, sin deformarla ni ampliarla", () => {
    // Una foto de móvil de 12 MP baja a 2000 px de lado mayor.
    expect(fittedImageSize(4032, 3024)).toEqual({ width: 2000, height: 1500 });
    // Y una ya pequeña no se toca: ampliarla no le añadiría nada.
    expect(fittedImageSize(800, 600)).toEqual({ width: 800, height: 600 });
    // Un panorama extremo mantiene la proporción y no se queda en cero.
    expect(fittedImageSize(4000, 10)).toEqual({ width: 2000, height: 5 });
    expect(fittedImageSize(4000, 3)).toEqual({ width: 2000, height: 2 });
    // Un dato imposible no rompe el cálculo.
    expect(fittedImageSize(0, 0)).toEqual({ width: 0, height: 0 });
  });

  test("solo se recomprimen fotos: ni vectores, ni animaciones, ni documentos", () => {
    expect(isCompressibleImage({ type: "image/jpeg" })).toBe(true);
    expect(isCompressibleImage({ type: "image/PNG" })).toBe(true);
    expect(isCompressibleImage({ type: "image/heic" })).toBe(true);
    expect(isCompressibleImage({ type: "image/avif" })).toBe(true);
    // Un GIF animado perdería el movimiento y un SVG es un documento.
    expect(isCompressibleImage({ type: "image/gif" })).toBe(false);
    expect(isCompressibleImage({ type: "image/svg+xml" })).toBe(false);
    expect(isCompressibleImage({ type: "application/pdf" })).toBe(false);
  });

  test("una foto que ya viene ligera se sube tal cual", () => {
    expect(shouldCompressImage(MOBILE_PHOTO)).toBe(true);
    expect(
      shouldCompressImage({ type: "image/jpeg", size: MIN_COMPRESS_BYTES }),
    ).toBe(false);
    expect(shouldCompressImage({ type: "image/jpeg", size: 900 * 1024 })).toBe(
      false,
    );
    // Un documento grande no es una foto: no hay nada que reescalar.
    expect(
      shouldCompressImage({ type: "application/pdf", size: 9 * 1024 * 1024 }),
    ).toBe(false);
  });

  test("la foto comprimida conserva el nombre y cambia de extensión", () => {
    expect(compressedImageName("IMG_1234.HEIC", "image/jpeg")).toBe(
      "IMG_1234.jpg",
    );
    expect(compressedImageName("foto del plató 2.jpeg", "image/jpeg")).toBe(
      "foto del plató 2.jpg",
    );
    // Un PNG se queda PNG: es el único que lleva transparencia.
    expect(compressedImageName("captura.png", "image/png")).toBe("captura.png");
    // Sin extensión que quitar, o con puntos de más, el nombre sigue siendo legible.
    expect(compressedImageName("foto", "image/jpeg")).toBe("foto.jpg");
    expect(compressedImageName("foto.tar.gz", "image/jpeg")).toBe(
      "foto.tar.jpg",
    );
  });

  test("un PNG sigue siendo PNG y el resto va a JPEG", () => {
    expect(compressedImageType("image/png")).toBe("image/png");
    expect(compressedImageType("image/jpeg")).toBe("image/jpeg");
    expect(compressedImageType("image/heic")).toBe("image/jpeg");
  });

  test("lo que no es una foto para recomprimir se devuelve intacto", async () => {
    const pdf = new File([new Uint8Array(2048)], "parte.pdf", {
      type: "application/pdf",
    });
    expect(await compressImageFile(pdf)).toBe(pdf);

    const lightPhoto = new File([new Uint8Array(2048)], "miniatura.jpg", {
      type: "image/jpeg",
    });
    expect(await compressImageFile(lightPhoto)).toBe(lightPhoto);
  });
});
