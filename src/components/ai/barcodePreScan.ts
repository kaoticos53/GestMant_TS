interface DetectedBarcodeLike {
  rawValue?: string;
}

interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<DetectedBarcodeLike[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
}

const SUPPORTED_FORMATS = [
  "code_128",
  "code_39",
  "data_matrix",
  "qr_code",
  "ean_13",
];

/**
 * Escanea códigos 1D/DataMatrix/QR localmente en el navegador cuando
 * `BarcodeDetector` está disponible. Nunca lanza error: devuelve `[]` si el
 * navegador no lo soporta o la imagen no contiene códigos legibles.
 */
export async function preScanBarcodes(file: File): Promise<string[]> {
  const detectorCtor = (
    globalThis as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }
  ).BarcodeDetector;
  if (!detectorCtor || typeof createImageBitmap !== "function") {
    return [];
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const detector = new detectorCtor({ formats: SUPPORTED_FORMATS });
    const detected = await detector.detect(bitmap);
    const seen = new Set<string>();
    for (const item of detected) {
      const value = item.rawValue?.trim();
      if (value) {
        seen.add(value);
      }
    }
    return Array.from(seen);
  } catch {
    return [];
  } finally {
    bitmap?.close();
  }
}
