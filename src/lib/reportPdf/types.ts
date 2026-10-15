import type { PdfColor, PdfFont, PdfImage } from "../pdf";

/** Ancho de un texto en puntos, para una tipografía y un tamaño. */
export type PdfMeasureText = (
  text: string,
  font: PdfFont,
  size: number,
) => number;

/** Los bytes de una imagen del parte, o `null` si ya no se puede leer. */
export type PdfLoadImage = (src: string) => Promise<PdfImage | null>;

/** Un trozo de texto con la tipografía y los adornos que le tocan. */
export interface Run {
  text: string;
  font: PdfFont;
  color?: PdfColor;
  /** Tachado y enlace se pintan con una raya, no con otra tipografía. */
  strike?: boolean;
  link?: boolean;
}

export interface InlineStyle {
  bold: boolean;
  italic: boolean;
  code: boolean;
  strike: boolean;
  link: boolean;
}

export interface Piece {
  text: string;
  run: Run;
  /**
   * La palabra va pegada a la anterior: no había blanco entre las dos. Lo pide
   * el texto con formato de dentro de la línea, donde «**sin fallos**.» acaba
   * en un punto que va contra la negrita, no separado por un espacio.
   */
  glue?: boolean;
}

/** Un bloque del parte, tal y como se lee del Markdown. */
export type ReportBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "item"; marker: string; text: string; depth: number }
  | { type: "quote"; text: string }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "image"; src: string; alt: string }
  | { type: "rule" };

export interface ReportPdfOptions {
  /** Lo que va en el pie de cada hoja, a la izquierda («Parte de INC-0038»). */
  footer?: string;
  /** Cómo medir un texto; por defecto, los anchos de Helvetica. */
  measure?: PdfMeasureText;
  /** Cómo traer las imágenes del parte; sin esto se citan, no se incrustan. */
  loadImage?: PdfLoadImage;
}
