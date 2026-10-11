/**
 * Piezas de Markdown que se componen en los documentos del taller: el parte de
 * una incidencia y la ficha de un manual.
 *
 * Aquí no hay un conversor de Markdown —eso es del maquetador (`reportPdf`), que
 * lo lee—, sino lo mínimo para *escribirlo*: un título, una tabla y el escapado
 * de sus celdas. Vive aparte porque los dos documentos se componen igual.
 */

/** Título de un apartado en el nivel que le toque (el del documento suelto, 1). */
export function heading(level: number, text: string): string {
  return `${"#".repeat(Math.max(1, level))} ${text}`;
}

/** Celda de una tabla Markdown: sin saltos de línea y con `|` escapado. */
export function cell(value: string | number | undefined): string {
  if (value === undefined) return "";
  return String(value)
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\|/g, "\\|");
}

/** Tabla Markdown con su cabecera y su raya (las filas pueden ir vacías). */
export function table(
  header: string[],
  rows: (string | number | undefined)[][],
): string {
  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(cell).join(" | ")} |`),
  ].join("\n");
}
