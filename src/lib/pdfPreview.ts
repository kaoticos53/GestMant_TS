/**
 * Vista previa de PDF dentro de la aplicación.
 *
 * Los manuales viven en el almacén de la API (`_storage`), en otro origen: la
 * CSP no deja enmarcar esa dirección (`frame-src 'self'`) y abrirla en otra
 * pestaña saca al técnico del taller. Por eso el visor trae el archivo con
 * `fetch` (permitido por `connect-src`), comprueba que de verdad es un PDF y lo
 * enmarca como objeto local (`blob:`) con el tipo forzado a `application/pdf`.
 *
 * Forzar el tipo y mirar la firma `%PDF-` evita que un archivo con otro
 * contenido —HTML, por ejemplo— se pinte como página dentro de la aplicación:
 * el visor solo enseña lo que el navegador va a tratar como documento PDF.
 *
 * Puro: no sabe de React ni de Convex.
 */

/** Tipo con el que se enmarca el documento. */
export const PDF_MIME_TYPE = "application/pdf";

/** Tamaño máximo que se previsualiza (60 MB); por encima, mejor descargarlo. */
export const PDF_PREVIEW_MAX_BYTES = 60 * 1024 * 1024;

/** Firma de cabecera de un PDF: `%PDF-`. */
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d];

/**
 * ¿Los primeros bytes son los de un PDF? Algunos generadores dejan basura
 * antes de la cabecera, así que se busca la firma en el primer kilobyte, como
 * hacen los lectores habituales.
 */
export function looksLikePdf(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.length, 1024) - PDF_SIGNATURE.length;
  for (let start = 0; start <= limit; start += 1) {
    let matches = true;
    for (let offset = 0; offset < PDF_SIGNATURE.length; offset += 1) {
      if (bytes[start + offset] !== PDF_SIGNATURE[offset]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return false;
}

export type PdfPreviewProblem = "too_large" | "not_pdf" | "empty";

/** Decide si un archivo descargado se puede enseñar en el visor. */
export function pdfPreviewProblem(
  size: number,
  head: Uint8Array,
): PdfPreviewProblem | null {
  if (size <= 0) return "empty";
  if (size > PDF_PREVIEW_MAX_BYTES) return "too_large";
  if (!looksLikePdf(head)) return "not_pdf";
  return null;
}

/** Mensaje para el técnico cuando el visor no puede enseñar el archivo. */
export function pdfPreviewProblemMessage(problem: PdfPreviewProblem): string {
  switch (problem) {
    case "too_large":
      return "El archivo es demasiado grande para verlo aquí. Descárgalo para abrirlo.";
    case "not_pdf":
      return "El archivo no es un PDF válido, así que no se puede previsualizar. Descárgalo para revisarlo.";
    case "empty":
      return "El archivo está vacío.";
  }
}
