/**
 * El parte de una incidencia, maquetado en PDF.
 *
 * El informe se compone una sola vez, en Markdown (`lib/report`), porque es el
 * formato que se lee en cualquier editor y el que se descarga. Aquí se toma ese
 * mismo texto y se compone en hojas A4: el PDF y el Markdown cuentan exactamente
 * lo mismo, y el formato de las notas —negritas, cursivas, listas anidadas,
 * citas, separadores, tablas e imágenes— llega al papel sin pasar por HTML.
 *
 * Lo que este módulo sabe leer es lo que escribe `lib/report`: títulos,
 * párrafos, listas, citas, tablas, reglas, imágenes y las marcas de dentro del
 * texto (negrita, cursiva, tachado, código y enlaces). No es un intérprete de
 * Markdown completo ni pretende serlo: si mañana el informe usa otra cosa, se
 * añade aquí y se prueba.
 *
 * El texto se mide con los anchos de Helvetica que declara el archivo (aquí
 * abajo están sus dos tablas), así que el parte sale igual en cualquier máquina
 * y la medida coincide con la letra que se dibuja. Lo único que no se puede
 * hacer sin navegador es traer los bytes de las imágenes: sin `loadImage`, se
 * citan en su sitio en vez de incrustarse.
 */

import {
  A4,
  PdfDocument,
  type PdfColor,
  type PdfFont,
  type PdfImage,
  type PdfPage,
} from "./pdf";

/** Ancho de un texto en puntos, para una tipografía y un tamaño. */
export type PdfMeasureText = (
  text: string,
  font: PdfFont,
  size: number,
) => number;

/** Los bytes de una imagen del parte, o `null` si ya no se puede leer. */
export type PdfLoadImage = (src: string) => Promise<PdfImage | null>;

/* ------------------------------------------------------------------ */
/* La medida de reserva                                                */
/* ------------------------------------------------------------------ */

/**
 * Ancho de cada carácter de Helvetica, en milésimas de em: solo los que no
 * valen lo de siempre (556). Es la tabla clásica de la tipografía —la misma que
 * lleva cualquier lector de PDF—, y es la que decide el maquetado: así el parte
 * sale igual en cualquier máquina y la medida coincide con la letra que el
 * archivo declara.
 *
 * Medir con las fuentes del navegador no vale: la negrita que tiene el sistema
 * no es la Helvetica-Bold del PDF (y si no la tiene, se la inventa), así que el
 * texto se colocaba con anchuras de otra tipografía y las palabras se pisaban.
 */
const HELVETICA_WIDTHS: Record<string, number> = {
  " ": 278,
  "!": 278,
  '"': 355,
  "#": 556,
  $: 556,
  "%": 889,
  "&": 667,
  "'": 191,
  "(": 333,
  ")": 333,
  "*": 389,
  "+": 584,
  ",": 278,
  "-": 333,
  ".": 278,
  "/": 278,
  ":": 278,
  ";": 278,
  "<": 584,
  "=": 584,
  ">": 584,
  "?": 556,
  "@": 1015,
  A: 667,
  B: 667,
  C: 722,
  D: 722,
  E: 667,
  F: 611,
  G: 778,
  H: 722,
  I: 278,
  J: 500,
  K: 667,
  L: 556,
  M: 833,
  N: 722,
  O: 778,
  P: 667,
  Q: 778,
  R: 722,
  S: 667,
  T: 611,
  U: 722,
  V: 667,
  W: 944,
  X: 667,
  Y: 667,
  Z: 611,
  "[": 278,
  "\\": 278,
  "]": 278,
  "^": 469,
  _: 556,
  "`": 333,
  a: 556,
  b: 556,
  c: 500,
  d: 556,
  e: 556,
  f: 278,
  g: 556,
  h: 556,
  i: 222,
  j: 222,
  k: 500,
  l: 222,
  m: 833,
  n: 556,
  o: 556,
  p: 556,
  q: 556,
  r: 333,
  s: 500,
  t: 278,
  u: 556,
  v: 500,
  w: 722,
  x: 500,
  y: 500,
  z: 500,
  "{": 334,
  "|": 260,
  "}": 334,
  "~": 584,
  "¡": 333,
  "¿": 556,
  "«": 556,
  "»": 556,
  "·": 278,
  "–": 556,
  "—": 1000,
  "…": 1000,
  "°": 400,
  "€": 556,
  "“": 333,
  "”": 333,
  "‘": 191,
  "’": 191,
  "•": 350,
};

/** Los mismos anchos de la negrita, en milésimas de em (por defecto, 556). */
const HELVETICA_BOLD_WIDTHS: Record<string, number> = {
  " ": 278,
  "!": 333,
  '"': 474,
  "#": 556,
  $: 556,
  "%": 889,
  "&": 722,
  "'": 238,
  "(": 333,
  ")": 333,
  "*": 389,
  "+": 584,
  ",": 278,
  "-": 333,
  ".": 278,
  "/": 278,
  ":": 333,
  ";": 333,
  "<": 584,
  "=": 584,
  ">": 584,
  "?": 611,
  "@": 975,
  A: 722,
  B: 722,
  C: 722,
  D: 722,
  E: 667,
  F: 611,
  G: 778,
  H: 722,
  I: 278,
  J: 556,
  K: 722,
  L: 611,
  M: 833,
  N: 722,
  O: 778,
  P: 667,
  Q: 778,
  R: 722,
  S: 667,
  T: 611,
  U: 722,
  V: 667,
  W: 944,
  X: 667,
  Y: 667,
  Z: 611,
  "[": 333,
  "\\": 278,
  "]": 333,
  "^": 584,
  _: 556,
  "`": 333,
  a: 556,
  b: 611,
  c: 556,
  d: 611,
  e: 556,
  f: 333,
  g: 611,
  h: 611,
  i: 278,
  j: 278,
  k: 556,
  l: 278,
  m: 889,
  n: 611,
  o: 611,
  p: 611,
  q: 611,
  r: 389,
  s: 556,
  t: 333,
  u: 611,
  v: 556,
  w: 778,
  x: 556,
  y: 556,
  z: 500,
  "{": 389,
  "|": 280,
  "}": 389,
  "~": 584,
  "¡": 333,
  "¿": 611,
  "«": 556,
  "»": 556,
  "·": 278,
  "–": 556,
  "—": 1000,
  "…": 1000,
  "°": 400,
  "€": 556,
  "“": 500,
  "”": 500,
  "‘": 333,
  "’": 333,
  "•": 350,
};

const DEFAULT_WIDTH = 556;
/** Courier es monoespaciada: todas sus letras miden lo mismo. */
const MONO_WIDTH = 600;

/**
 * Ancho de un carácter: el suyo, o el de la letra de la que viene (á → a, que
 * en Helvetica mide igual con acento que sin él).
 */
function charWidth(char: string, bold: boolean): number {
  const table = bold ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS;
  const direct = table[char];
  if (direct !== undefined) return direct;
  const [base] = char.normalize("NFD");
  return table[base] ?? DEFAULT_WIDTH;
}

/**
 * La medida del parte: los anchos de Helvetica y Helvetica-Bold, los mismos que
 * el archivo declara. Se inyecta —el maquetador acepta otra— pero no hay razón
 * para usar otra: si la medida no es la de la letra que se dibuja, el texto se
 * coloca mal.
 */
export const helveticaMeasure: PdfMeasureText = (text, font, size) => {
  if (font === "mono") return (text.length * MONO_WIDTH * size) / 1000;
  const bold = font === "bold" || font === "boldItalic";
  let units = 0;
  for (const char of text) units += charWidth(char, bold);
  return (units * size) / 1000;
};

/* ------------------------------------------------------------------ */
/* Del Markdown a los bloques                                          */
/* ------------------------------------------------------------------ */

/** Un trozo de texto con la tipografía y los adornos que le tocan. */
interface Run {
  text: string;
  font: PdfFont;
  color?: PdfColor;
  /** Tachado y enlace se pintan con una raya, no con otra tipografía. */
  strike?: boolean;
  link?: boolean;
}

interface InlineStyle {
  bold: boolean;
  italic: boolean;
  code: boolean;
  strike: boolean;
  link: boolean;
}

const PLAIN_STYLE: InlineStyle = {
  bold: false,
  italic: false,
  code: false,
  strike: false,
  link: false,
};

/**
 * Las marcas que sabe poner el editor, de más larga a más corta: `**` antes que
 * `*`, que si no la negrita se leería como dos cursivas.
 */
const DELIMITERS: {
  open: string;
  close: string;
  style: Partial<InlineStyle>;
}[] = [
  { open: "**", close: "**", style: { bold: true } },
  { open: "__", close: "__", style: { bold: true } },
  { open: "~~", close: "~~", style: { strike: true } },
  { open: "*", close: "*", style: { italic: true } },
  { open: "_", close: "_", style: { italic: true } },
  { open: "`", close: "`", style: { code: true } },
];

const LINK = /^\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/;
const IMAGE_ONLY = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/;
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

function fontOf(style: InlineStyle): PdfFont {
  if (style.code) return "mono";
  if (style.bold && style.italic) return "boldItalic";
  if (style.bold) return "bold";
  if (style.italic) return "italic";
  return "regular";
}

function runOf(text: string, style: InlineStyle): Run {
  const run: Run = { text, font: fontOf(style) };
  if (style.strike) run.strike = true;
  if (style.link) run.link = true;
  return run;
}

/** El texto de dentro de un bloque, con sus marcas, en trozos de una tipografía. */
export function parseReportInline(text: string): Run[] {
  const runs: Run[] = [];
  walkInline(text, PLAIN_STYLE, runs);
  return runs.filter((run) => run.text !== "");
}

function walkInline(text: string, style: InlineStyle, runs: Run[]): void {
  let buffer = "";
  const flush = () => {
    if (buffer !== "") runs.push(runOf(buffer, style));
    buffer = "";
  };

  let index = 0;
  while (index < text.length) {
    const char = text[index];
    // Una barra invierte lo que venga detrás: lo que se escapó al componer el
    // Markdown (un `*` en un nombre de archivo) se lee tal cual.
    if (char === "\\" && index + 1 < text.length) {
      buffer += text[index + 1];
      index += 2;
      continue;
    }
    if (char === "[") {
      const link = LINK.exec(text.slice(index));
      if (link) {
        flush();
        walkInline(link[1], { ...style, link: true }, runs);
        index += link[0].length;
        continue;
      }
    }
    const delimiter = DELIMITERS.find((item) =>
      text.startsWith(item.open, index),
    );
    if (delimiter) {
      const start = index + delimiter.open.length;
      const end = text.indexOf(delimiter.close, start);
      if (end > start) {
        flush();
        walkInline(
          text.slice(start, end),
          { ...style, ...delimiter.style },
          runs,
        );
        index = end + delimiter.close.length;
        continue;
      }
    }
    buffer += char;
    index += 1;
  }
  flush();
}

/** Los mismos trozos, todos en negrita (un título, la cabecera de una tabla). */
function toBold(runs: readonly Run[]): Run[] {
  return runs.map((run) => ({
    ...run,
    font:
      run.font === "italic"
        ? "boldItalic"
        : run.font === "mono"
          ? "mono"
          : "bold",
  }));
}

/** Los trozos de un texto, todos en negrita. */
function boldRuns(text: string): Run[] {
  return toBold(parseReportInline(text));
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

/** Una fila de tabla: `| a | b |` partida por sus barras, con `\|` respetado. */
function tableCells(line: string): string[] {
  const inner = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let current = "";
  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index];
    if (char === "\\" && index + 1 < inner.length) {
      current += inner[index + 1];
      index += 1;
      continue;
    }
    if (char === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function isTableStart(lines: readonly string[], index: number): boolean {
  const header = lines[index];
  const rule = lines[index + 1];
  if (!header || !rule) return false;
  if (!header.trim().startsWith("|")) return false;
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(rule) && rule.includes("-");
}

/**
 * El Markdown del parte en bloques. Se lee lo que escribe `lib/report`: cada
 * línea que abre algo (título, regla, tabla, cita, viñeta, imagen) empieza un
 * bloque y el resto de líneas seguidas son su continuación.
 */
export function parseReportMarkdown(markdown: string): ReportBlock[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReportBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "") {
      index += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: heading[2].trim(),
      });
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      blocks.push({ type: "rule" });
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      const header = tableCells(lines[index]);
      let row = index + 2;
      const rows: string[][] = [];
      while (row < lines.length && lines[row].trim().startsWith("|")) {
        rows.push(tableCells(lines[row]));
        row += 1;
      }
      blocks.push({ type: "table", header, rows });
      index = row;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      index = readQuote(lines, index, blocks);
      continue;
    }

    if (LIST_ITEM.test(line)) {
      index = readList(lines, index, blocks);
      continue;
    }

    const image = IMAGE_ONLY.exec(line.trim());
    if (image) {
      blocks.push({ type: "image", src: image[2], alt: image[1] });
      index += 1;
      continue;
    }

    index = readParagraph(lines, index, blocks);
  }

  return blocks;
}

/** Una cita: las líneas con `>` seguidas; cada párrafo suyo es un bloque. */
function readQuote(
  lines: readonly string[],
  start: number,
  blocks: ReportBlock[],
): number {
  let index = start;
  let text = "";
  const flush = () => {
    if (text.trim() !== "") blocks.push({ type: "quote", text: text.trim() });
    text = "";
  };
  while (index < lines.length) {
    const line = lines[index];
    if (!/^\s*>/.test(line)) break;
    const inner = line.replace(/^\s*>\s?/, "");
    if (inner.trim() === "") flush();
    else text += `${text === "" ? "" : " "}${inner.trim()}`;
    index += 1;
  }
  flush();
  return index;
}

/** Una lista: sus puntos, con la sangría que los anida y sus continuaciones. */
function readList(
  lines: readonly string[],
  start: number,
  blocks: ReportBlock[],
): number {
  let index = start;
  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "") {
      const next = lines[index + 1];
      // Un hueco entre puntos, o el que separa un punto de su lista anidada, no
      // cierra la lista: la lista sigue mientras lo que venga siga siendo suyo.
      if (next !== undefined && (LIST_ITEM.test(next) || /^\s+\S/.test(next))) {
        index += 1;
        continue;
      }
      break;
    }

    const item = LIST_ITEM.exec(line);
    if (item) {
      const depth = Math.floor(item[1].replace(/\t/g, "  ").length / 2);
      const ordered = /\d/.test(item[2]);
      const number = /^\d+/.exec(item[2])?.[0];
      let text = item[3].trim();
      index += 1;
      while (
        index < lines.length &&
        lines[index].trim() !== "" &&
        !LIST_ITEM.test(lines[index]) &&
        /^\s+\S/.test(lines[index])
      ) {
        text += ` ${lines[index].trim()}`;
        index += 1;
      }
      blocks.push({
        type: "item",
        marker: ordered && number ? `${number}.` : "•",
        text,
        depth,
      });
      continue;
    }

    // Una línea sangrada sin viñeta es la continuación del último punto.
    const last = blocks[blocks.length - 1];
    if (/^\s+\S/.test(line) && last && last.type === "item") {
      last.text += ` ${line.trim()}`;
      index += 1;
      continue;
    }
    break;
  }
  return index;
}

/** Un párrafo: las líneas seguidas hasta que algo abre otro bloque. */
function readParagraph(
  lines: readonly string[],
  start: number,
  blocks: ReportBlock[],
): number {
  let index = start;
  const parts: string[] = [];
  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "") break;
    if (
      parts.length > 0 &&
      (/^#{1,6}\s/.test(line) ||
        /^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim()) ||
        line.trim().startsWith("|") ||
        /^\s*>/.test(line) ||
        LIST_ITEM.test(line) ||
        IMAGE_ONLY.test(line.trim()))
    ) {
      break;
    }
    parts.push(line.trim());
    index += 1;
  }
  const text = parts.join(" ");
  const image = IMAGE_ONLY.exec(text);
  if (image) blocks.push({ type: "image", src: image[2], alt: image[1] });
  else if (text !== "") blocks.push({ type: "paragraph", text });
  return index;
}

/* ------------------------------------------------------------------ */
/* La hoja                                                             */
/* ------------------------------------------------------------------ */

/** A4 con sus márgenes: el papel del parte. */
const PAGE = A4;
const MARGIN = { top: 62, right: 56, bottom: 68, left: 56 };
const CONTENT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right;
const BODY_SIZE = 10.5;
const BODY_LEADING = 15;
/** Alto de línea de un texto, a partir de su cuerpo (el del cuerpo, 15). */
const LINE_FACTOR = 1.43;
const HEADING_SIZES: Record<number, number> = {
  1: 18,
  2: 13.5,
  3: 12,
  4: 11,
  5: 11,
  6: 11,
};
const GRAY: PdfColor = [0.42, 0.42, 0.45];
const LIGHT: PdfColor = [0.82, 0.82, 0.85];
const HEADER_BG: PdfColor = [0.94, 0.94, 0.95];
const CELL_PADDING = 5;
const TABLE_INDENT = 10;
const LIST_INDENT = 16;
const QUOTE_INDENT = 16;
const IMAGE_MAX_HEIGHT = 420;
/** Una imagen pequeña se puede agrandar hasta el ancho de la caja, pero no más. */
const IMAGE_MAX_SCALE = 1.6;

export interface ReportPdfOptions {
  /** Lo que va en el pie de cada hoja, a la izquierda («Parte de INC-0038»). */
  footer?: string;
  /** Cómo medir un texto; por defecto, los anchos de Helvetica. */
  measure?: PdfMeasureText;
  /** Cómo traer las imágenes del parte; sin esto se citan, no se incrustan. */
  loadImage?: PdfLoadImage;
}

interface Piece {
  text: string;
  run: Run;
  /**
   * La palabra va pegada a la anterior: no había blanco entre las dos. Lo pide
   * el texto con formato de dentro de la línea, donde «**sin fallos**.» acaba
   * en un punto que va contra la negrita, no separado por un espacio.
   */
  glue?: boolean;
}

class ReportLayout {
  private readonly doc = new PdfDocument(PAGE);
  private readonly measure: PdfMeasureText;
  private readonly loadImage: PdfLoadImage | undefined;
  private readonly footer: string | undefined;
  private page: PdfPage;
  /** Alto del siguiente bloque, contado desde el borde superior del papel. */
  private y = MARGIN.top;

  constructor(
    measure: PdfMeasureText,
    loadImage: PdfLoadImage | undefined,
    footer: string | undefined,
  ) {
    this.measure = measure;
    this.loadImage = loadImage;
    this.footer = footer;
    this.page = this.doc.addPage();
  }

  async render(markdown: string): Promise<Uint8Array> {
    for (const block of parseReportMarkdown(markdown)) {
      await this.block(block);
    }
    this.drawFooters();
    return this.doc.toBytes();
  }

  /* -------------------- la página -------------------- */

  private get bottom(): number {
    return PAGE.height - MARGIN.bottom;
  }

  /** Si lo que va a escribirse no cabe, se abre hoja. */
  private ensure(space: number): void {
    if (this.y + space <= this.bottom) return;
    this.page = this.doc.addPage();
    this.y = MARGIN.top;
  }

  /** Una línea de texto: reserva su alto, la pinta y baja el cursor. */
  private line(
    line: readonly Run[],
    options: {
      x?: number;
      size?: number;
      leading?: number;
      color?: PdfColor;
    } = {},
  ): void {
    const size = options.size ?? BODY_SIZE;
    const leading = options.leading ?? BODY_LEADING;
    this.ensure(leading);
    const baseline = this.y + size * 1.06;
    this.drawRuns(
      line,
      options.x ?? MARGIN.left,
      baseline,
      size,
      options.color,
    );
    this.y += leading;
  }

  /** Los trozos de una línea, uno detrás de otro, con sus rayas. */
  private drawRuns(
    runs: readonly Run[],
    x: number,
    baseline: number,
    size: number,
    color?: PdfColor,
  ): void {
    let cursor = x;
    for (const run of runs) {
      const width = this.measure(run.text, run.font, size);
      this.page.text(run.text, cursor, baseline, {
        font: run.font,
        size,
        color: run.color ?? color,
      });
      if (run.strike) {
        this.page.line(
          cursor,
          baseline - size * 0.28,
          cursor + width,
          baseline - size * 0.28,
          {
            color: run.color ?? color ?? GRAY,
          },
        );
      }
      if (run.link) {
        this.page.line(cursor, baseline + 1.8, cursor + width, baseline + 1.8, {
          color: run.color ?? color ?? GRAY,
          width: 0.5,
        });
      }
      cursor += width;
    }
  }

  /* -------------------- el reparto en líneas -------------------- */

  /**
   * Las palabras de los trozos, con el corte obligatorio de un salto de línea y
   * el blanco que llevaban delante. El blanco se cuenta, no se supone: entre dos
   * palabras de distinto formato lo normal es que hubiera un espacio, pero no
   * siempre —«**sin fallos**.» acaba en un punto pegado a la negrita—, y si se
   * pusiera uno el papel diría «sin fallos .».
   */
  private tokens(runs: readonly Run[]): { token: Piece; hardBreak: boolean }[] {
    const tokens: { token: Piece; hardBreak: boolean }[] = [];
    let hardBreak = false;
    /** Si el trozo anterior acabó en un hueco (o en un salto de línea). */
    let afterBlank = true;
    for (const run of runs) {
      for (const match of run.text.matchAll(/(\s*)(\S+)/g)) {
        const [blank, word] = [match[1], match[2]];
        tokens.push({
          token: { text: word, run, glue: !afterBlank && blank === "" },
          hardBreak: hardBreak || blank.includes("\n"),
        });
        hardBreak = false;
        afterBlank = false;
      }
      const trailing = /\s*$/.exec(run.text)?.[0] ?? "";
      afterBlank = trailing !== "";
      hardBreak = trailing.includes("\n");
    }
    return tokens;
  }

  /**
   * Los trozos, repartidos en líneas de un ancho. Una palabra que no cabe sola
   * —un nombre de archivo largo, una dirección— se parte por caracteres: antes
   * eso que dejar media hoja en blanco.
   */
  private wrap(runs: readonly Run[], width: number, size: number): Run[][] {
    const lines: Run[][] = [];
    let line: Piece[] = [];
    let lineWidth = 0;
    const newline = () => {
      lines.push(mergeRuns(line));
      line = [];
      lineWidth = 0;
    };

    for (const { token, hardBreak } of this.tokens(runs)) {
      if (hardBreak && line.length > 0) newline();
      const wordWidth = this.measure(token.text, token.run.font, size);
      // El hueco que separa la palabra de la anterior; ninguno si va pegada.
      const gap = token.glue ? 0 : this.measure(" ", token.run.font, size);
      if (line.length > 0 && lineWidth + gap + wordWidth > width) newline();

      if (wordWidth <= width) {
        line.push(token);
        lineWidth += (line.length > 1 ? gap : 0) + wordWidth;
        continue;
      }

      let rest = token.text;
      while (rest !== "") {
        const padding = line.length > 0 ? gap : 0;
        const room = width - lineWidth - padding;
        let fit = 0;
        while (
          fit < rest.length &&
          this.measure(rest.slice(0, fit + 1), token.run.font, size) <= room
        ) {
          fit += 1;
        }
        if (fit === 0) fit = 1;
        const chunk = rest.slice(0, fit);
        lineWidth += padding + this.measure(chunk, token.run.font, size);
        line.push({ text: chunk, run: token.run });
        rest = rest.slice(fit);
        if (rest !== "") newline();
      }
    }
    if (line.length > 0) newline();
    return lines.length > 0 ? lines : [[]];
  }

  /* -------------------- los bloques -------------------- */

  private async block(block: ReportBlock): Promise<void> {
    switch (block.type) {
      case "heading":
        this.heading(block);
        return;
      case "paragraph":
        this.paragraph(
          parseReportInline(block.text),
          CONTENT_WIDTH,
          MARGIN.left,
          10,
        );
        return;
      case "item":
        this.item(block);
        return;
      case "quote":
        this.quote(block);
        return;
      case "table":
        this.table(block);
        return;
      case "image":
        await this.image(block);
        return;
      case "rule":
        this.rule();
        return;
    }
  }

  private heading(block: { level: number; text: string }): void {
    const size = HEADING_SIZES[block.level] ?? BODY_SIZE + 0.5;
    const leading = size * LINE_FACTOR;
    const lines = this.wrap(
      toBold(parseReportInline(block.text)),
      CONTENT_WIDTH,
      size,
    );
    const gap = block.level === 1 ? 0 : size * 1.1;
    // Un título no se queda solo al final de la hoja: se lleva consigo las
    // primeras líneas de lo que anuncia.
    this.ensure(gap + lines.length * leading + BODY_LEADING * 2);
    this.y += gap;
    for (const line of lines) this.line(line, { size, leading });
    this.y += size * 0.5;
  }

  private paragraph(
    runs: readonly Run[],
    width: number,
    x: number,
    gap: number,
    size: number = BODY_SIZE,
  ): void {
    const lines = this.wrap(runs, width, size);
    this.y += gap;
    for (const line of lines) this.line(line, { x, size });
  }

  private item(block: { marker: string; text: string; depth: number }): void {
    const indent = MARGIN.left + block.depth * LIST_INDENT;
    const markerWidth = this.measure(block.marker, "regular", BODY_SIZE) + 6;
    const textX = indent + markerWidth;
    const width = CONTENT_WIDTH - (textX - MARGIN.left);
    const lines = this.wrap(parseReportInline(block.text), width, BODY_SIZE);
    this.y += block.depth === 0 ? 4 : 3;

    lines.forEach((line, index) => {
      this.ensure(BODY_LEADING);
      const baseline = this.y + BODY_SIZE * 1.06;
      // Solo el primer renglón lleva la viñeta; los demás quedan sangrados a su
      // sombra, que es lo que hace legible una lista de varios renglones.
      if (index === 0) {
        this.drawRuns(
          parseReportInline(block.marker),
          indent,
          baseline,
          BODY_SIZE,
          GRAY,
        );
      }
      this.drawRuns(line, textX, baseline, BODY_SIZE);
      this.y += BODY_LEADING;
    });
  }

  private quote(block: { text: string }): void {
    const x = MARGIN.left + QUOTE_INDENT;
    const width = CONTENT_WIDTH - QUOTE_INDENT;
    const lines = this.wrap(parseReportInline(block.text), width, BODY_SIZE);
    this.y += 8;
    for (const line of lines) {
      this.ensure(BODY_LEADING);
      const baseline = this.y + BODY_SIZE * 1.06;
      this.drawRuns(line, x, baseline, BODY_SIZE);
      // La barra se pinta renglón a renglón: así no cruza de una hoja a otra.
      this.page.line(
        MARGIN.left + 4,
        baseline - BODY_SIZE,
        MARGIN.left + 4,
        baseline + BODY_SIZE * 0.3,
        { color: LIGHT, width: 2 },
      );
      this.y += BODY_LEADING;
    }
    this.y += 4;
  }

  private rule(): void {
    this.y += 12;
    this.ensure(1);
    this.page.line(MARGIN.left, this.y, PAGE.width - MARGIN.right, this.y, {
      color: LIGHT,
      width: 0.8,
    });
    this.y += 12;
  }

  private async image(block: { src: string; alt: string }): Promise<void> {
    const image = this.loadImage ? await this.loadImage(block.src) : null;
    if (!image) {
      // Una imagen que ya no está no se traga en silencio: se dice, para que
      // quien lee el parte sepa que ahí había algo.
      this.paragraph(
        parseReportInline(
          `_${block.alt ? `[imagen no disponible: ${block.alt}]` : "[imagen no disponible]"}_`,
        ),
        CONTENT_WIDTH,
        MARGIN.left,
        10,
      );
      return;
    }
    const scale = Math.min(
      CONTENT_WIDTH / image.width,
      IMAGE_MAX_HEIGHT / image.height,
      IMAGE_MAX_SCALE,
    );
    const width = image.width * scale;
    const height = image.height * scale;
    const x = MARGIN.left + (CONTENT_WIDTH - width) / 2;
    this.y += 10;
    this.ensure(height);
    this.page.drawImage(this.doc.addImage(image), x, this.y, width, height);
    this.y += height + 10;
  }

  private table(block: { header: string[]; rows: string[][] }): void {
    const columns = Math.max(
      block.header.length,
      ...block.rows.map((row) => row.length),
      1,
    );
    const header = normalizeRow(block.header, columns);
    const rows = block.rows.map((row) => normalizeRow(row, columns));

    this.y += TABLE_INDENT;
    // El ancho de cada columna sale de lo que ocupa su celda más larga, y luego
    // se reparte el ancho de la caja: si sobra papel, se ensanchan todas; si
    // falta, se estrechan y el texto se reparte en más renglones.
    const natural = Array.from({ length: columns }, (_, column) => {
      const texts = [header[column], ...rows.map((row) => row[column])];
      return Math.max(
        ...texts.map(
          (text) => this.measure(text, "regular", BODY_SIZE) + CELL_PADDING * 2,
        ),
      );
    });
    const total = natural.reduce((sum, width) => sum + width, 0);
    const widths = natural.map((width) => (width * CONTENT_WIDTH) / total);

    const rowLayout = (cells: readonly string[], bold: boolean) =>
      cells.map((cell, column) => {
        const runs = bold ? boldRuns(cell) : parseReportInline(cell);
        return this.wrap(runs, widths[column] - CELL_PADDING * 2, BODY_SIZE);
      });

    const drawRow = (cells: readonly string[], bold: boolean): void => {
      const lines = rowLayout(cells, bold);
      const height =
        Math.max(...lines.map((cell) => cell.length)) * BODY_LEADING +
        CELL_PADDING * 2;
      this.ensure(height);
      const top = this.y;
      if (bold) {
        this.page.rect(MARGIN.left, top, CONTENT_WIDTH, height, {
          color: HEADER_BG,
        });
      }
      let x = MARGIN.left;
      lines.forEach((cell, column) => {
        cell.forEach((line, index) => {
          this.drawRuns(
            line,
            x + CELL_PADDING,
            top + CELL_PADDING + BODY_SIZE * 1.06 + index * BODY_LEADING,
            BODY_SIZE,
          );
        });
        x += widths[column];
      });
      this.y = top + height;
      this.page.line(MARGIN.left, this.y, MARGIN.left + CONTENT_WIDTH, this.y, {
        color: LIGHT,
      });
    };

    drawRow(header, true);
    for (const row of rows) {
      const page = this.page;
      drawRow(row, false);
      // La tabla puede partirse entre dos hojas: la nueva vuelve a llevar su
      // cabecera, que si no se lee una tabla sin saber qué es cada columna.
      if (this.page !== page) drawRow(header, true);
    }
    this.y += TABLE_INDENT;
  }

  /** Pie de hoja: lo que es el parte a la izquierda y la hoja que es, a la derecha. */
  private drawFooters(): void {
    const total = this.doc.pageCount;
    this.doc.pages.forEach((page, index) => {
      const baseline = PAGE.height - MARGIN.bottom + 28;
      page.line(
        MARGIN.left,
        baseline - 14,
        PAGE.width - MARGIN.right,
        baseline - 14,
        {
          color: LIGHT,
        },
      );
      if (this.footer) {
        page.text(this.footer, MARGIN.left, baseline, { size: 8, color: GRAY });
      }
      const label = `Página ${index + 1} de ${total}`;
      const width = this.measure(label, "regular", 8);
      page.text(label, PAGE.width - MARGIN.right - width, baseline, {
        size: 8,
        color: GRAY,
      });
    });
  }
}

/** Una fila con tantas celdas como columnas tenga la tabla. */
function normalizeRow(row: readonly string[], columns: number): string[] {
  return Array.from({ length: columns }, (_, column) => row[column] ?? "");
}

/**
 * Los trozos de una línea, uno solo cuando comparten tipografía. Entre palabra
 * y palabra va un espacio: el reparto en líneas trabaja con palabras sueltas y
 * el hueco no está dentro de ninguna, así que se pone al juntarlas.
 */
function mergeRuns(pieces: readonly Piece[]): Run[] {
  const runs: Run[] = [];
  pieces.forEach((piece, index) => {
    const text = index === 0 || piece.glue ? piece.text : ` ${piece.text}`;
    const last = runs[runs.length - 1];
    if (
      last &&
      piece.run.font === last.font &&
      piece.run.color === last.color &&
      piece.run.strike === last.strike &&
      piece.run.link === last.link
    ) {
      last.text += text;
      return;
    }
    runs.push({ ...piece.run, text });
  });
  return runs;
}

/**
 * El parte en PDF: el mismo Markdown que se descarga, compuesto en hojas A4.
 * Es asíncrono porque las imágenes del parte se traen de donde estén.
 */
export async function reportToPdf(
  markdown: string,
  options: ReportPdfOptions = {},
): Promise<Uint8Array> {
  const layout = new ReportLayout(
    options.measure ?? helveticaMeasure,
    options.loadImage,
    options.footer,
  );
  return await layout.render(markdown);
}
