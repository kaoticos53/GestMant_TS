/**
 * Utilidades de descarga de archivos: el CSV de las listas y el texto del
 * informe de una incidencia.
 *
 * Usa `;` como separador (el configurado por defecto en Excel en español) y
 * escaping RFC 4180: los campos que contienen `;`, comillas o saltos de línea
 * se envuelven entre comillas dobles, y `""` representa una comilla literal.
 * El fichero lleva BOM UTF-8 para que Excel reconozca los acentos.
 */

export type CsvCell = string | number | boolean | null | undefined;

/** Escapa una celda según RFC 4180 (adaptado al separador `;`). */
export function escapeCsvCell(value: CsvCell): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Convierte una cabecera y sus filas en un texto CSV separado por `;`. */
export function toCsv(header: string[], rows: CsvCell[][]): string {
  const lines = [header, ...rows].map((row) =>
    row.map(escapeCsvCell).join(";"),
  );
  return lines.join("\r\n");
}

/** Nombre de archivo con la fecha del día: `repuestos-2026-10-06.csv`. */
export function csvFilename(base: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return `${base}-${day}.csv`;
}

/** Guarda un Blob como archivo con el nombre indicado (un clic, sin servidor). */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Descarga un texto como archivo con el tipo indicado (Markdown, texto...). */
export function downloadText(
  filename: string,
  content: string,
  mime: string,
): void {
  downloadBlob(filename, new Blob([content], { type: mime }));
}

/** Descarga `content` como CSV con el nombre indicado. */
export function downloadCsv(filename: string, content: string): void {
  // BOM UTF-8 para que Excel reconozca los acentos.
  downloadBlob(
    filename,
    new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8;" }),
  );
}
