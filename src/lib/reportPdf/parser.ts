import type { PdfFont } from "../pdf";
import type { InlineStyle, PdfMeasureText, ReportBlock, Run } from "./types";

/* ------------------------------------------------------------------ */
/* La medida de reserva                                                */
/* ------------------------------------------------------------------ */

export const HELVETICA_WIDTHS: Record<string, number> = {
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
  "“": 500,
  "”": 500,
  "‘": 222,
  "’": 222,
  "•": 350,
};

export const HELVETICA_BOLD_WIDTHS: Record<string, number> = {
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
const MONO_WIDTH = 600;

function charWidth(char: string, bold: boolean): number {
  const table = bold ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS;
  const direct = table[char];
  if (direct !== undefined) return direct;
  const [base] = char.normalize("NFD");
  return table[base] ?? DEFAULT_WIDTH;
}

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

const PLAIN_STYLE: InlineStyle = {
  bold: false,
  italic: false,
  code: false,
  strike: false,
  link: false,
};

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

export function toBold(runs: readonly Run[]): Run[] {
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

export function boldRuns(text: string): Run[] {
  return toBold(parseReportInline(text));
}

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
