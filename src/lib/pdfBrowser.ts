/**
 * Lo que el parte en PDF necesita del navegador, aparte del maquetado: traer las
 * imágenes que cita el informe y guardarlo en el disco.
 *
 * El maquetador (`reportPdf.ts`) no toca el navegador a propósito —así se puede
 * probar sin él—: mide con los anchos de Helvetica que declara el archivo, y lo
 * único que no puede hacer solo, los bytes de cada imagen, se le pasa desde
 * aquí.
 */

import { downloadBlob } from "./export";
import type { PdfImage } from "./pdf";
import type { PdfLoadImage } from "./reportPdf";

/**
 * Los bytes de una imagen del parte, listos para incrustar. Un JPEG se mete tal
 * cual —el PDF lo declara como `/DCTDecode` y no lo recomprime—; lo demás
 * (PNG, WebP, un GIF) se vuelve a dibujar en un lienzo y se guarda como JPEG:
 * blanco de fondo, porque el PDF no tiene transparencia.
 *
 * Si la imagen ya no está o no se puede leer, devuelve `null` y el maquetador lo
 * dice en su sitio. El informe se descarga igual: una foto perdida no puede
 * llevarse por delante un parte entero.
 */
export const loadPdfImage: PdfLoadImage = async (src) => {
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const { width, height } = bitmap;

    const embed = async (bytes: Uint8Array): Promise<PdfImage> => ({
      bytes,
      width,
      height,
    });

    if (blob.type === "image/jpeg") {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      bitmap.close();
      return await embed(bytes);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const jpeg = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.88),
    );
    if (!jpeg) return null;
    return await embed(new Uint8Array(await jpeg.arrayBuffer()));
  } catch {
    return null;
  }
};

/** Guarda el parte en PDF con el nombre que le toque. */
export function downloadPdf(filename: string, bytes: Uint8Array): void {
  // `slice()` deja el ArrayBuffer suelto que `Blob` espera: los bytes de un PDF
  // no tienen por qué venir de un búfer compartido.
  downloadBlob(
    filename,
    new Blob([bytes.slice()], { type: "application/pdf" }),
  );
}
