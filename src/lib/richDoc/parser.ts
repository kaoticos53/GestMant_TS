import {
  canonicalMarks,
  decodeEntities,
  richDocSafeUrl,
  type RichBlock,
  type RichInline,
  type RichMark,
} from "./types";

/** Las marcas que añade una etiqueta de formato, si es que es una. */
export const MARKS_BY_TAG: Record<string, readonly RichMark[]> = {
  strong: ["bold"],
  b: ["bold"],
  em: ["italic"],
  i: ["italic"],
  u: ["underline"],
  s: ["strike"],
  strike: ["strike"],
  del: ["strike"],
  code: ["code"],
};

/** Nodo del árbol de etiquetas que se monta antes de traducirlo a bloques. */
export interface HtmlElement {
  tag: string;
  attrs: Record<string, string>;
  children: HtmlNode[];
}

export type HtmlNode = string | HtmlElement;

/** Etiquetas sin cierre: no hay que esperar su `</...>`. */
export const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/**
 * Etiquetas que se tiran con todo lo que llevan dentro: ni su texto interesa
 * (el de un `script` o un `style` no es parte de la nota) ni se puede admitir lo
 * que traen.
 */
export const DROPPED_TAGS = new Set([
  "applet",
  "audio",
  "canvas",
  "embed",
  "frame",
  "frameset",
  "iframe",
  "math",
  "noscript",
  "object",
  "script",
  "style",
  "svg",
  "template",
  "textarea",
  "title",
  "video",
]);

/** Los atributos de una etiqueta, ya desescapados. */
export function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attr =
    /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = attr.exec(raw))) {
    const name = match[1].toLowerCase();
    if (name in attrs) continue;
    attrs[name] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attrs;
}

/**
 * El árbol de etiquetas de un HTML del editor. No hace falta ser un navegador:
 * este HTML lo escribe el editor (siempre bien cerrado) o el editor de las
 * versiones anteriores, así que basta con una pila de etiquetas abiertas.
 */
export function parseHtml(html: string): HtmlElement[] {
  const root: HtmlElement = { tag: "#root", attrs: {}, children: [] };
  const open: HtmlElement[] = [root];
  const top = () => open[open.length - 1];
  const pushText = (raw: string) => {
    const text = decodeEntities(raw);
    if (text !== "") top().children.push(text);
  };

  const tag = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>])*)>/g;
  const dropping: string[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(html))) {
    if (match.index > last && dropping.length === 0) {
      pushText(html.slice(last, match.index));
    }
    last = tag.lastIndex;
    const name = match[2].toLowerCase();
    const rawAttrs = match[3] ?? "";
    const selfClosing = /\/\s*$/.test(rawAttrs);
    if (dropping.length > 0) {
      if (match[1] === "/") {
        const at = dropping.lastIndexOf(name);
        if (at >= 0) dropping.length = at;
      } else if (!VOID_TAGS.has(name) && !selfClosing) {
        dropping.push(name);
      }
      continue;
    }
    if (match[1] === "/") {
      for (let index = open.length - 1; index > 0; index -= 1) {
        if (open[index].tag === name) {
          open.length = index;
          break;
        }
      }
      continue;
    }
    if (DROPPED_TAGS.has(name)) {
      if (!VOID_TAGS.has(name) && !selfClosing) dropping.push(name);
      continue;
    }
    const element: HtmlElement = {
      tag: name,
      attrs: parseAttrs(rawAttrs),
      children: [],
    };
    top().children.push(element);
    if (VOID_TAGS.has(name) || selfClosing) continue;
    open.push(element);
  }
  if (last < html.length && dropping.length === 0) pushText(html.slice(last));
  return root.children as HtmlElement[];
}

/** Todo el texto que hay dentro de un nodo, sin etiquetas. */
export function textOf(nodes: HtmlNode[]): string {
  return nodes
    .map((node) =>
      typeof node === "string"
        ? node
        : node.tag === "br"
          ? "\n"
          : textOf(node.children),
    )
    .join("");
}

export function sameMarks(
  a: readonly RichMark[] | undefined,
  b: readonly RichMark[],
): boolean {
  const left = a ?? [];
  return left.length === b.length && left.every((mark, i) => mark === b[i]);
}

/** Añade un trozo de texto, fundiéndolo con el anterior si viste igual. */
export function appendRun(
  runs: RichInline[],
  text: string,
  marks: readonly RichMark[],
  href: string | undefined,
): void {
  if (text === "") return;
  const canonical = canonicalMarks(marks);
  const last = runs[runs.length - 1];
  if (last && last.href === href && sameMarks(last.marks, canonical)) {
    last.text += text;
    return;
  }
  runs.push({
    text,
    ...(canonical.length > 0 ? { marks: canonical } : {}),
    ...(href !== undefined ? { href } : {}),
  });
}

/** Un trozo del contenido de un párrafo: texto con marcas, o una imagen. */
export type InlinePiece =
  | { kind: "run"; run: RichInline }
  | { kind: "image"; block: RichBlock };

/** El contenido de un párrafo o un título, en orden, con sus imágenes. */
export function inlinePieces(nodes: HtmlNode[]): InlinePiece[] {
  const pieces: InlinePiece[] = [];
  const runs: RichInline[] = [];
  const flush = () => {
    for (const run of runs) pieces.push({ kind: "run", run });
    runs.length = 0;
  };
  const walk = (
    list: HtmlNode[],
    current: readonly RichMark[],
    target: string | undefined,
  ) => {
    for (const node of list) {
      if (typeof node === "string") {
        appendRun(runs, node, current, target);
        continue;
      }
      const { tag: name } = node;
      if (name === "br") {
        appendRun(runs, "\n", current, target);
        continue;
      }
      if (name === "img") {
        const image = imageBlock(node.attrs);
        if (image) {
          flush();
          pieces.push({ kind: "image", block: image });
        }
        continue;
      }
      const extra = MARKS_BY_TAG[name];
      const nextHref =
        name === "a" ? (richDocSafeUrl(node.attrs.href) ?? target) : target;
      walk(node.children, extra ? [...current, ...extra] : current, nextHref);
    }
  };
  walk(nodes, [], undefined);
  flush();
  return pieces;
}

export function splitInline(
  pieces: readonly InlinePiece[],
  make: (inline: RichInline[]) => RichBlock,
): RichBlock[] {
  if (!pieces.some((piece) => piece.kind === "image")) {
    return [
      make(
        pieces.flatMap((piece) => (piece.kind === "run" ? [piece.run] : [])),
      ),
    ];
  }
  const blocks: RichBlock[] = [];
  let runs: RichInline[] = [];
  for (const piece of pieces) {
    if (piece.kind === "run") {
      runs.push(piece.run);
      continue;
    }
    if (runs.some((run) => run.text.trim() !== "")) blocks.push(make(runs));
    runs = [];
    blocks.push(piece.block);
  }
  if (runs.length > 0) blocks.push(make(runs));
  return blocks;
}

export function paragraphBlocks(nodes: HtmlNode[]): RichBlock[] {
  return splitInline(inlinePieces(nodes), (inline) => ({
    type: "paragraph",
    inline,
  }));
}

export function headingLevel(tag: string): 3 | 4 {
  return /^h[1-3]$/.test(tag) ? 3 : 4;
}

export function headingBlocks(tag: string, nodes: HtmlNode[]): RichBlock[] {
  const level = headingLevel(tag);
  return splitInline(inlinePieces(nodes), (inline) => ({
    type: "heading",
    level,
    inline,
  }));
}

export function imageBlock(attrs: Record<string, string>): RichBlock | undefined {
  const src = richDocSafeUrl(attrs.src);
  if (src === undefined) return undefined;
  return {
    type: "image",
    src,
    ...(attrs.alt ? { alt: attrs.alt } : {}),
    ...(attrs.title ? { title: attrs.title } : {}),
  };
}

export function itemBlocks(nodes: HtmlNode[]): RichBlock[] {
  const blocks = blocksFrom(nodes);
  return blocks.length > 0 ? blocks : [{ type: "paragraph", inline: [] }];
}

export function listBlock(ordered: boolean, nodes: HtmlNode[]): RichBlock {
  const items: RichBlock[][] = [];
  const lastItem = () => items[items.length - 1];
  for (const node of nodes) {
    if (typeof node === "string") {
      if (node.trim() !== "") items.push(paragraphBlocks([node]));
      continue;
    }
    if (node.tag === "li") {
      items.push(itemBlocks(node.children));
      continue;
    }
    const nested =
      node.tag === "ul" || node.tag === "ol"
        ? [listBlock(node.tag === "ol", node.children)]
        : blocksFrom([node]);
    if (nested.length === 0) continue;
    const item = lastItem();
    if (item) item.push(...nested);
    else items.push(nested);
  }
  return { type: "list", ordered, items };
}

export function blocksFrom(nodes: HtmlNode[]): RichBlock[] {
  const blocks: RichBlock[] = [];
  let loose: RichInline[] = [];
  const flush = () => {
    if (loose.some((run) => run.text.trim() !== "")) {
      blocks.push({ type: "paragraph", inline: loose });
    }
    loose = [];
  };

  const walk = (
    list: HtmlNode[],
    marks: readonly RichMark[],
    href: string | undefined,
  ) => {
    for (const node of list) {
      if (typeof node === "string") {
        appendRun(loose, node, marks, href);
        continue;
      }
      const { tag: name } = node;
      if (name === "p") {
        flush();
        blocks.push(...paragraphBlocks(node.children));
        continue;
      }
      if (/^h[1-6]$/.test(name)) {
        flush();
        blocks.push(...headingBlocks(name, node.children));
        continue;
      }
      if (name === "ul" || name === "ol") {
        flush();
        blocks.push(listBlock(name === "ol", node.children));
        continue;
      }
      if (name === "blockquote") {
        flush();
        blocks.push({ type: "quote", blocks: blocksFrom(node.children) });
        continue;
      }
      if (name === "hr") {
        flush();
        blocks.push({ type: "divider" });
        continue;
      }
      if (name === "img") {
        const image = imageBlock(node.attrs);
        if (image) {
          flush();
          blocks.push(image);
        }
        continue;
      }
      if (name === "br") {
        appendRun(loose, "\n", marks, href);
        continue;
      }
      if (name === "pre") {
        flush();
        const text = textOf(node.children).replace(/\s+$/, "");
        blocks.push({
          type: "paragraph",
          inline: text === "" ? [] : [{ text, marks: ["code"] }],
        });
        continue;
      }
      const extra = MARKS_BY_TAG[name];
      const nextHref =
        name === "a" ? (richDocSafeUrl(node.attrs.href) ?? href) : href;
      walk(node.children, extra ? [...marks, ...extra] : marks, nextHref);
    }
  };

  walk(nodes, [], undefined);
  flush();
  return blocks;
}

export const EDITOR_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "del",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "a",
  "img",
];

export const RICH_TEXT_TAG = new RegExp(
  `</?(?:${[...EDITOR_TAGS, ...DROPPED_TAGS].join("|")})\\b[^>]*>`,
  "i",
);

export function looksLikeHtml(value: string): boolean {
  return RICH_TEXT_TAG.test(value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeInline(value: unknown): RichInline[] {
  if (!Array.isArray(value)) return [];
  const runs: RichInline[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.text !== "string") continue;
    const marks = Array.isArray(entry.marks)
      ? entry.marks.filter((mark): mark is RichMark =>
          canonicalMarks(mark as RichMark[]).length > 0,
        )
      : [];
    appendRun(
      runs,
      entry.text,
      marks,
      typeof entry.href === "string" ? richDocSafeUrl(entry.href) : undefined,
    );
  }
  return runs;
}

export function normalizeBlock(value: unknown): RichBlock | undefined {
  if (!isRecord(value)) return undefined;
  switch (value.type) {
    case "paragraph":
      return { type: "paragraph", inline: normalizeInline(value.inline) };
    case "heading":
      return {
        type: "heading",
        level: value.level === 4 ? 4 : 3,
        inline: normalizeInline(value.inline),
      };
    case "list": {
      const items = Array.isArray(value.items)
        ? value.items
            .map((item) => normalizeBlocks(item))
            .filter((item) => item.length > 0)
        : [];
      return { type: "list", ordered: value.ordered === true, items };
    }
    case "quote": {
      const blocks = normalizeBlocks(value.blocks);
      return blocks.length > 0 ? { type: "quote", blocks } : undefined;
    }
    case "image": {
      const src = richDocSafeUrl(
        typeof value.src === "string" ? value.src : undefined,
      );
      if (src === undefined) return undefined;
      return {
        type: "image",
        src,
        ...(typeof value.alt === "string" && value.alt
          ? { alt: value.alt }
          : {}),
        ...(typeof value.title === "string" && value.title
          ? { title: value.title }
          : {}),
      };
    }
    case "divider":
      return { type: "divider" };
    default:
      return undefined;
  }
}

export function normalizeBlocks(value: unknown): RichBlock[] {
  if (!Array.isArray(value)) return [];
  const blocks: RichBlock[] = [];
  for (const entry of value) {
    const block = normalizeBlock(entry);
    if (block) blocks.push(block);
  }
  return blocks;
}

export function parseDocJson(value: string): RichBlock[] | undefined {
  const text = value.trim();
  if (!text.startsWith("[") || !text.endsWith("]")) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!Array.isArray(parsed)) return undefined;
  const isDoc =
    parsed.length === 0 ||
    parsed.every((entry) => isRecord(entry) && typeof entry.type === "string");
  return isDoc ? normalizeBlocks(parsed) : undefined;
}

export function plainTextBlocks(value: string): RichBlock[] {
  if (value === "") return [];
  return value.split(/\r?\n/).map((line) => ({
    type: "paragraph" as const,
    inline: line === "" ? [] : [{ text: line }],
  }));
}

/**
 * Los bloques de cualquier valor guardado: el documento de ahora, el HTML del
 * editor de antes o el texto plano de siempre. Es la puerta de entrada de todo
 * lo que lee una nota, así que siempre devuelve bloques limpios.
 */
export function richDocBlocks(
  value: string | RichBlock[] | null | undefined,
): RichBlock[] {
  if (Array.isArray(value)) return normalizeBlocks(value);
  if (typeof value !== "string") return [];
  if (value.trim() === "") return [];
  const doc = parseDocJson(value);
  if (doc) return doc;
  const html = value.replace(/<!--[\s\S]*?-->/g, "").replace(/<![^>]*>/g, "");
  if (looksLikeHtml(html)) return blocksFrom(parseHtml(html));
  return plainTextBlocks(value);
}
