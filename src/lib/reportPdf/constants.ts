import { A4, type PdfColor, type PdfPageSize } from "../pdf";

/** A4 con sus márgenes: el papel del parte. */
export const PAGE: PdfPageSize = A4;
export const MARGIN = { top: 62, right: 56, bottom: 68, left: 56 } as const;
export const CONTENT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right;
export const BODY_SIZE = 10.5;
export const BODY_LEADING = 15;

/** Alto de línea de un texto, a partir de su cuerpo (el del cuerpo, 15). */
export const LINE_FACTOR = 1.43;

export const HEADING_SIZES: Record<number, number> = {
  1: 18,
  2: 13.5,
  3: 12,
  4: 11,
  5: 11,
  6: 11,
};

export const GRAY: PdfColor = [0.42, 0.42, 0.45];
export const LIGHT: PdfColor = [0.82, 0.82, 0.85];
export const HEADER_BG: PdfColor = [0.94, 0.94, 0.95];
export const CELL_PADDING = 5;
export const TABLE_INDENT = 10;
export const LIST_INDENT = 16;
export const QUOTE_INDENT = 16;
export const IMAGE_MAX_HEIGHT = 420;

/** Una imagen pequeña se puede agrandar hasta el ancho de la caja, pero no más. */
export const IMAGE_MAX_SCALE = 1.6;
