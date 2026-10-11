/**
 * La ficha de un manual como documento: lo que se descarga para adjuntar a un
 * correo o para imprimir.
 *
 * Se compone aquí, fuera del componente, para poder probarla sin navegador —es
 * texto en Markdown, como el parte de una incidencia— y el maquetador del taller
 * (`reportPdf`) la pone en hojas A4. Lleva todo lo que la ficha sabe: su
 * clasificación, el archivo en uso, su nota del taller, las versiones anteriores
 * de su archivo y su historial de cambios.
 *
 * Los archivos no viajan dentro del documento: se citan por su nombre y su
 * tamaño, que es lo que se lee en papel y lo que permite cotejarlos con los que
 * se descargan desde la ficha.
 */

import {
  MANUAL_KIND_META,
  manualChangeSummary,
  manualFileVersions,
  manualHistory,
  manualScopeLabel,
  normalizeManualText,
  type ManualChangeLike,
  type ManualKind,
} from "./manuals";
import { heading, table } from "./markdown";
import { richDocToMarkdown } from "./richDoc";
import { formatDateTime, formatFileSize } from "./workshop";

/** Lo que la ficha de un manual sabe y entra en el documento. */
export interface ManualRecordInput {
  title: string;
  kind: ManualKind;
  type: string;
  brand?: string | null;
  model?: string | null;
  /** El archivo en uso, si el manual es de tipo archivo. */
  fileName?: string | null;
  size?: number | null;
  /** La nota del taller, tal cual sale del editor (documento de `richDoc`). */
  notes?: string | null;
  /** Quién subió o escribió la ficha. */
  author?: string | null;
  createdAt: number;
  updatedAt: number;
  history?: readonly ManualChangeLike[] | null;
}

export interface ManualRecordOptions {
  /** El equipo del inventario al que está asignado, con su nombre visible. */
  equipmentName?: string;
  /** Cuándo se exporta la ficha (por defecto, ahora). */
  now?: number;
}

/** Título → trozo de nombre de archivo: minúsculas, sin acentos ni signos. */
function slug(title: string): string {
  return (
    normalizeManualText(title)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      // Un título largo no puede dejar un nombre de archivo interminable; si el
      // corte deja un guion suelto al final, se quita.
      .slice(0, 60)
      .replace(/-+$/, "") || "manual"
  );
}

/**
 * El nombre del documento, con la fecha dentro para que dos descargas del mismo
 * manual no se pisen ni se confundan en una carpeta:
 * `ficha-manual-manual-de-servicio-hdc-3500-2026-10-10.pdf`.
 */
export function manualRecordPdfFilename(
  title: string,
  now: number = Date.now(),
): string {
  const day = new Date(now).toISOString().slice(0, 10);
  return `ficha-manual-${slug(title)}-${day}.pdf`;
}

/** De qué es el manual: del equipo, del modelo o suelto (como en su ficha). */
function equipmentLine(
  manual: ManualRecordInput,
  equipmentName: string | undefined,
): string {
  return equipmentName ?? manualScopeLabel(manual);
}

/** La clasificación de la ficha, en una tabla. */
function identityTable(
  manual: ManualRecordInput,
  equipmentName: string | undefined,
): string {
  return table(
    ["Dato", "Valor"],
    [
      ["Forma", MANUAL_KIND_META[manual.kind].label],
      ["Tipo", manual.type],
      ["Marca", manual.brand || "—"],
      ["Modelo", manual.model || "—"],
      ["Equipo", equipmentLine(manual, equipmentName)],
      ["Autor de la ficha", manual.author || "—"],
      ["Alta", formatDateTime(manual.createdAt)],
      ["Última modificación", formatDateTime(manual.updatedAt)],
    ],
  );
}

/** El archivo en uso, o el aviso de que no lo hay. */
function fileBlock(manual: ManualRecordInput): string {
  if (manual.kind !== "file") {
    return "Es una nota del taller: su contenido es el apartado siguiente.";
  }
  const name = manual.fileName?.trim();
  if (!name) {
    return "El archivo de este manual ya no está en el almacén del taller.";
  }
  const size = manual.size ? ` (${formatFileSize(manual.size)})` : "";
  return `- **Archivo en uso:** ${name}${size}`;
}

/** La nota del taller, con su formato; o el aviso de que no la lleva. */
function notesBlock(manual: ManualRecordInput): string {
  const markdown = richDocToMarkdown(manual.notes)?.trim();
  return markdown || "Este manual no lleva nota del taller.";
}

/**
 * Las versiones anteriores del archivo, de la más reciente a la más antigua y
 * numeradas desde la primera —la que se sustituyó antes que ninguna—.
 *
 * Van en lista y no en tabla a propósito: el nombre de un archivo es una
 * palabra larga sin espacios, así que en una columna estrecha se partiría por la
 * mitad, mientras que en un renglón entero cabe de sobra.
 */
function versionsBlock(manual: ManualRecordInput): string {
  const versions = manualFileVersions(manual);
  if (versions.length === 0) {
    return "El archivo de este manual no se ha sustituido: no hay versiones anteriores.";
  }
  const lines = versions.map((entry, index) => {
    const name = entry.file?.fileName ?? "—";
    const size = entry.file?.size
      ? ` (${formatFileSize(entry.file.size)})`
      : "";
    const by = entry.by ? ` por ${entry.by}` : "";
    return `- **v${versions.length - index}** · ${name}${size} · sustituida el ${formatDateTime(
      entry.at,
    )}${by}`;
  });
  return [
    ...lines,
    "",
    "Las versiones anteriores se siguen descargando desde la ficha del manual.",
  ].join("\n");
}

/** Quién hizo qué y cuándo: el historial entero, del último movimiento atrás. */
function historyBlock(manual: ManualRecordInput): string {
  const history = manualHistory(manual);
  if (history.length === 0) return "Sin movimientos registrados.";
  return table(
    ["Fecha", "Movimiento", "Quién"],
    history.map((entry) => [
      formatDateTime(entry.at),
      manualChangeSummary(entry, manual.kind),
      entry.by || "—",
    ]),
  );
}

/**
 * La ficha del manual, lista para convertir a PDF o guardar como Markdown. Se
 * compone con lo que se le pasa: quien exporta ve en el documento exactamente lo
 * que ve en la ficha.
 */
export function manualRecord(
  manual: ManualRecordInput,
  options: ManualRecordOptions = {},
): string {
  const now = options.now ?? Date.now();
  const blocks: string[] = [
    [
      heading(1, manual.title),
      "",
      `Ficha del manual generada el ${formatDateTime(now)} desde el taller.`,
      "",
      identityTable(manual, options.equipmentName),
    ].join("\n"),
    heading(2, "Archivo"),
    fileBlock(manual),
    heading(2, "Nota del taller"),
    notesBlock(manual),
    heading(2, "Versiones anteriores del archivo"),
    versionsBlock(manual),
    heading(2, "Historial de cambios"),
    historyBlock(manual),
  ];
  // Sin cierre a propósito: el pie de cada hoja ya dice de qué documento es y de
  // qué taller sale, y un colofón suelto se lleva la ficha a una segunda hoja
  // casi en blanco cuando el historial llena la primera.
  return `${blocks.join("\n\n")}\n`;
}
