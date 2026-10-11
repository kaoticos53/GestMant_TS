/**
 * Lo que el paquete del parte necesita del navegador: traer los bytes de cada
 * foto tal y como están guardados y bajar el ZIP. El paquete en sí
 * (`reportPackage.ts`) no toca el navegador a propósito —así se puede probar sin
 * él—, y aquí solo se le da de dónde tirar.
 */

import { downloadBlob } from "./export";
import type { ReportLoadPhoto } from "./reportPackage";

/**
 * Los bytes de una foto del parte. Se traen tal cual —sin recomprimir—: la foto
 * que se adjuntó es la que se entrega, y así el ZIP pesa lo mismo que el
 * original.
 *
 * Si la foto ya no está o no se puede leer, devuelve `null` y el paquete lo dice
 * en su sitio. Un parte al que le falta una foto se entrega igual.
 */
export const loadReportPhoto: ReportLoadPhoto = async (src) => {
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.length > 0 ? bytes : null;
  } catch {
    return null;
  }
};

/** Guarda el paquete en el disco con el nombre que le toque. */
export function downloadReportPackage(
  filename: string,
  bytes: Uint8Array,
): void {
  // `slice()` deja el ArrayBuffer suelto que `Blob` espera: los bytes del ZIP no
  // tienen por qué venir de un búfer compartido.
  downloadBlob(
    filename,
    new Blob([bytes.slice()], { type: "application/zip" }),
  );
}
