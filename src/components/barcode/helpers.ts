import type {
  BarcodeDetectorConstructor,
  BarcodeDetectorInstance,
} from "./types";

/**
 * Formatos de códigos de barras y QR industriales predeterminados.
 */
export const DEFAULT_BARCODE_FORMATS: readonly string[] = [
  "qr_code",
  "code_128",
  "code_39",
  "ean_13",
  "ean_8",
  "data_matrix",
];

/**
 * Limpia el valor crudo detectado por el sensor o introducido manualmente.
 */
export function cleanScannedCode(raw: string): string {
  return raw.trim();
}

/**
 * Comprueba si la API BarcodeDetector está disponible en el entorno de ejecución.
 */
export function isBarcodeDetectorSupported(
  targetWindow: unknown = typeof window !== "undefined" ? window : undefined,
): boolean {
  if (!targetWindow || typeof targetWindow !== "object") {
    return false;
  }
  return typeof (targetWindow as { BarcodeDetector?: unknown }).BarcodeDetector ===
    "function";
}

/**
 * Crea una instancia segura de BarcodeDetector si está soportada, o null en caso contrario.
 */
export function createBarcodeDetector(
  formats: readonly string[] = DEFAULT_BARCODE_FORMATS,
  targetWindow: unknown = typeof window !== "undefined" ? window : undefined,
): BarcodeDetectorInstance | null {
  if (!isBarcodeDetectorSupported(targetWindow)) {
    return null;
  }

  const BarcodeDetectorClass = (
    targetWindow as { BarcodeDetector?: BarcodeDetectorConstructor }
  ).BarcodeDetector;

  if (!BarcodeDetectorClass) {
    return null;
  }

  try {
    return new BarcodeDetectorClass({ formats: [...formats] });
  } catch {
    return null;
  }
}

/**
 * Dispara una vibración háptica segura al detectar un código si el dispositivo lo soporta.
 */
export function triggerScanHapticFeedback(
  pattern: readonly number[] = [40, 30, 40],
  targetNavigator: unknown = typeof navigator !== "undefined" ? navigator : undefined,
): void {
  if (!targetNavigator || typeof targetNavigator !== "object") {
    return;
  }
  try {
    const nav = targetNavigator as { vibrate?: (p: number[]) => boolean };
    if (typeof nav.vibrate === "function") {
      nav.vibrate([...pattern]);
    }
  } catch {
    // Ignorar si el hardware o navegador bloquea la vibración
  }
}
