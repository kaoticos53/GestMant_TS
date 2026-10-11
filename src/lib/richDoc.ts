/**
 * Documento de las notas y las descripciones: el texto con formato ya no se
 * guarda como el HTML del editor, sino como estructura —bloques de párrafo,
 * título, lista, cita, imagen y separador, con sus trozos de texto y sus
 * marcas—.
 *
 * Lo que se gana:
 * - Cada cosa que el programa hace con una nota se hace sobre sus bloques: se
 *   pinta (cada bloque con su etiqueta), se lee como texto (buscador, CSV,
 *   informe), se pasa a Markdown (el parte que se imprime o se convierte a PDF)
 *   y se compara con otra versión bloque a bloque. Con el HTML, cada una de
 *   esas cosas tenía que adivinar el formato por su cuenta.
 * - El valor guardado es el documento en JSON dentro de un campo de texto. Los
 *   campos eran de texto y siguen siéndolo, así que no hay migración: un valor
 *   que no sea un documento se lee como lo que es —texto plano de siempre o el
 *   HTML que escribió el editor de las versiones anteriores—.
 * - Nada de esto toca el DOM: el mismo módulo lo usan la interfaz y las
 *   funciones de Convex. Y el propio modelo es la lista blanca: lo que no cabe
 *   en un bloque (una etiqueta que no se admite, un `onerror`, un
 *   `javascript:` en un enlace) no existe al leer. Al pintar ya no se inyecta
 *   HTML en el navegador, así que no hay nada que sanear aparte.
 */

/** Las marcas que puede llevar un trozo de texto (lo que sabe poner el editor). */
export type RichMark = "bold" | "italic" | "underline" | "strike" | "code";

const MARKS: readonly RichMark[] = [
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
];

/** Un trozo de texto con sus marcas y, si va dentro de un enlace, su destino. */
export interface RichInline {
  text: string;
  marks?: RichMark[];
  href?: string;
}

/**
 * Los bloques de un documento. Una lista lleva sus elementos (`items`) y una
 * cita, sus bloques: es el único anidamiento que puede producir el editor. Un
 * elemento de lista es, a su vez, una lista de bloques: lo normal es que sea un
 * único párrafo, y por eso no tiene un bloque propio.
 */
export type RichBlock =
  | { type: "paragraph"; inline: RichInline[] }
  | { type: "heading"; level: 3 | 4; inline: RichInline[] }
  | { type: "list"; ordered: boolean; items: RichBlock[][] }
  | { type: "quote"; blocks: RichBlock[] }
  | { type: "image"; src: string; alt?: string; title?: string }
  | { type: "divider" };

// ---------------------------------------------------------------------------
// Entidades y direcciones
// ---------------------------------------------------------------------------

/** Las entidades que puede dejar el editor al escribir; el resto se conservan. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  laquo: "«",
  raquo: "»",
};

/** Devuelve el texto de una entidad (`&amp;`, `&#39;`, `&#x27;`) o `undefined`. */
function decodeEntity(entity: string): string | undefined {
  const body = entity.slice(1, -1);
  if (body.startsWith("#")) {
    const hex = body.startsWith("#x") || body.startsWith("#X");
    const code = Number.parseInt(
      hex ? body.slice(2) : body.slice(1),
      hex ? 16 : 10,
    );
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff
      ? String.fromCodePoint(code)
      : undefined;
  }
  return NAMED_ENTITIES[body.toLowerCase()];
}

/** El texto de un valor con entidades HTML (`&amp;`, `&#189;`). */
function decodeEntities(value: string): string {
  return value.replace(
    /&(#x?[0-9a-f]+|[a-z]+);/gi,
    (entity) => decodeEntity(entity) ?? entity,
  );
}

/**
 * La dirección de un enlace o de una imagen, o `undefined` si no es admisible.
 * Es lo único que se conserva de los atributos de una etiqueta, así que aquí se
 * decide lo que puede acabar siendo un `href` o un `src`: `http`, `https`,
 * `mailto`, `tel` y las direcciones relativas del propio sitio. Todo lo demás
 * (`javascript:`, `data:`, `vbscript:`...) no vale.
 */
export function richDocSafeUrl(
  value: string | undefined | null,
): string | undefined {
  if (typeof value !== "string") return undefined;
  // El esquema se cuela con caracteres de control o invisibles por medio
  // (`java\tscript:`), así que se quitan antes de mirarlo.
  const url = value.replace(/[\p{Cc}\p{Cf}]/gu, "").trim();
  if (url === "") return undefined;
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(url);
  if (!scheme) return url;
  return ["http", "https", "mailto", "tel"].includes(scheme[1].toLowerCase())
    ? url
    : undefined;
}

/** Lo que no puede acabar tal cual dentro del HTML al escribirlo. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Las marcas, sin repetir y siempre en el mismo orden (para poder compararlas). */
function canonicalMarks(marks: readonly RichMark[]): RichMark[] {
  return MARKS.filter((mark) => marks.includes(mark));
}

/** Las marcas que añade una etiqueta de formato, si es que es una. */
const MARKS_BY_TAG: Record<string, readonly RichMark[]> = {
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

// ---------------------------------------------------------------------------
// Lectura del HTML (el del editor y el de las notas anteriores)
// ---------------------------------------------------------------------------

/** Nodo del árbol de etiquetas que se monta antes de traducirlo a bloques. */
interface HtmlElement {
  tag: string;
  attrs: Record<string, string>;
  children: HtmlNode[];
}

type HtmlNode = string | HtmlElement;

/** Etiquetas sin cierre: no hay que esperar su `</...>`. */
const VOID_TAGS = new Set([
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
 * que traen. El resto de etiquetas que no se admiten —`div`, `span`, `table`...
 * — se quedan sin su etiqueta y con su contenido: así una nota en la que todo
 * iba dentro de un `div` sigue leyéndose entera.
 */
const DROPPED_TAGS = new Set([
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
function parseAttrs(raw: string): Record<string, string> {
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
function parseHtml(html: string): HtmlElement[] {
  const root: HtmlElement = { tag: "#root", attrs: {}, children: [] };
  const open: HtmlElement[] = [root];
  const top = () => open[open.length - 1];
  const pushText = (raw: string) => {
    const text = decodeEntities(raw);
    if (text !== "") top().children.push(text);
  };

  const tag = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>])*)>/g;
  /** Etiquetas que se están tirando: ni su texto ni lo que haya dentro valen. */
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
      // Se cierra la última etiqueta con ese nombre: lo que quedara abierto por
      // dentro se cierra de paso, como haría el navegador.
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
function textOf(nodes: HtmlNode[]): string {
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

/** Añade un trozo de texto, fundiéndolo con el anterior si viste igual. */
function appendRun(
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

function sameMarks(
  a: readonly RichMark[] | undefined,
  b: readonly RichMark[],
): boolean {
  const left = a ?? [];
  return left.length === b.length && left.every((mark, i) => mark === b[i]);
}

/** Un trozo del contenido de un párrafo: texto con marcas, o una imagen. */
type InlinePiece =
  | { kind: "run"; run: RichInline }
  | { kind: "image"; block: RichBlock };

/** El contenido de un párrafo o un título, en orden, con sus imágenes. */
function inlinePieces(nodes: HtmlNode[]): InlinePiece[] {
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

/** Reparte el contenido de un párrafo o un título en bloques, por sus imágenes. */
function splitInline(
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

function paragraphBlocks(nodes: HtmlNode[]): RichBlock[] {
  return splitInline(inlinePieces(nodes), (inline) => ({
    type: "paragraph",
    inline,
  }));
}

/** El editor solo escribe títulos de nivel 3 y 4; lo de fuera se ajusta a esos. */
function headingLevel(tag: string): 3 | 4 {
  return /^h[1-3]$/.test(tag) ? 3 : 4;
}

function headingBlocks(tag: string, nodes: HtmlNode[]): RichBlock[] {
  const level = headingLevel(tag);
  return splitInline(inlinePieces(nodes), (inline) => ({
    type: "heading",
    level,
    inline,
  }));
}

/** Una imagen, si su dirección es admisible. */
function imageBlock(attrs: Record<string, string>): RichBlock | undefined {
  const src = richDocSafeUrl(attrs.src);
  if (src === undefined) return undefined;
  return {
    type: "image",
    src,
    ...(attrs.alt ? { alt: attrs.alt } : {}),
    ...(attrs.title ? { title: attrs.title } : {}),
  };
}

/** El contenido de un elemento de lista: sus bloques, y al menos un párrafo. */
function itemBlocks(nodes: HtmlNode[]): RichBlock[] {
  const blocks = blocksFrom(nodes);
  return blocks.length > 0 ? blocks : [{ type: "paragraph", inline: [] }];
}

function listBlock(ordered: boolean, nodes: HtmlNode[]): RichBlock {
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
    // Una lista anidada (el editor la mete en su `li`, así que esto es de
    // fuera) o cualquier otra cosa suelta: va con el elemento anterior, o forma
    // uno propio si la lista empieza así.
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

/**
 * Los bloques de un contexto: la raíz del documento, una cita o lo que hay
 * dentro de un elemento de lista. El texto que aparece suelto —una nota escrita
 * sin etiquetas— se agrupa en un párrafo.
 */
function blocksFrom(nodes: HtmlNode[]): RichBlock[] {
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
        // El editor no escribe bloques de código; una nota antigua que los
        // traiga se lee como un párrafo con su texto sin formato.
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

/** Las etiquetas que escribe el editor de siempre. */
const EDITOR_TAGS = [
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

/**
 * Etiquetas por las que se reconoce el HTML: las que escribe el editor y las
 * que se tiran enteras con su contenido. Un `script` o un `iframe` no los
 * escribe nadie queriendo decir «texto», así que valen como señal de que esto
 * es marcado —y de que hay que quitarlos—.
 */
const RICH_TEXT_TAG = new RegExp(
  `</?(?:${[...EDITOR_TAGS, ...DROPPED_TAGS].join("|")})\\b[^>]*>`,
  "i",
);

/**
 * ¿El valor es HTML del editor, o texto plano? Se mira solo por esas etiquetas:
 * un texto que mencione `<` y `>` de paso (p. ej. «el modelo <A17>») no es
 * HTML y no se le puede quitar nada.
 */
function looksLikeHtml(value: string): boolean {
  return RICH_TEXT_TAG.test(value);
}

// ---------------------------------------------------------------------------
// Validación del documento guardado
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Los trozos de texto de un bloque guardado, ya limpios. */
function normalizeInline(value: unknown): RichInline[] {
  if (!Array.isArray(value)) return [];
  const runs: RichInline[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.text !== "string") continue;
    const marks = Array.isArray(entry.marks)
      ? entry.marks.filter((mark): mark is RichMark =>
          MARKS.includes(mark as RichMark),
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

/**
 * Un bloque guardado, revisado. Es la misma lista blanca que la del HTML: lo
 * que no se entiende se cae, y de un enlace o una imagen solo sobrevive una
 * dirección admisible. Un documento puede venir de la API, así que no se da
 * por hecho que lo escribió el editor.
 */
function normalizeBlock(value: unknown): RichBlock | undefined {
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

function normalizeBlocks(value: unknown): RichBlock[] {
  if (!Array.isArray(value)) return [];
  const blocks: RichBlock[] = [];
  for (const entry of value) {
    const block = normalizeBlock(entry);
    if (block) blocks.push(block);
  }
  return blocks;
}

/**
 * El documento que hay dentro de un valor guardado, si es que lo trae: un
 * documento es un array de bloques. Un texto que empiece por `[` sin serlo
 * (una nota que era una lista escrita a mano) se lee como texto, no como
 * documento estropeado.
 */
function parseDocJson(value: string): RichBlock[] | undefined {
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

/**
 * ¿El valor trae estructura —un documento o el HTML del editor— o es texto de
 * siempre? Solo lo que trae estructura se convierte en documento al guardar.
 */
function hasStructure(value: string): boolean {
  if (looksLikeHtml(value.replace(/<!--[\s\S]*?-->/g, ""))) return true;
  return parseDocJson(value) !== undefined;
}

/** Texto de siempre → un párrafo por línea (las líneas vacías se conservan). */
function plainTextBlocks(value: string): RichBlock[] {
  if (value === "") return [];
  return value.split(/\r?\n/).map((line) => ({
    type: "paragraph" as const,
    inline: line === "" ? [] : [{ text: line }],
  }));
}

// ---------------------------------------------------------------------------
// Un valor guardado → bloques
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Bloques → las demás formas
// ---------------------------------------------------------------------------

/** El texto de un trozo, sin sus marcas. */
function inlineText(inline: readonly RichInline[]): string {
  return inline.map((run) => run.text).join("");
}

/** El texto que se lee de un bloque. Una imagen se ve, no se lee. */
export function richBlockText(block: RichBlock): string {
  switch (block.type) {
    case "paragraph":
    case "heading":
      return inlineText(block.inline);
    case "list":
      return block.items
        .map((item) => item.map(richBlockText).join("\n"))
        .join("\n");
    case "quote":
      return block.blocks.map(richBlockText).join("\n");
    default:
      return "";
  }
}

/** El texto de unos bloques, con los huecos que dejan sus saltos ya recortados. */
function plainTextOf(blocks: readonly RichBlock[]): string {
  return blocks
    .map(richBlockText)
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * El texto de una nota o una descripción, para lo que no admite formato: el
 * buscador, el CSV, el informe y el historial de correcciones. Una nota de
 * siempre (texto plano) sale tal y como estaba.
 */
export function richDocToPlainText(
  value: string | RichBlock[] | null | undefined,
): string {
  return plainTextOf(richDocBlocks(value));
}

/** ¿Hay alguna imagen en el documento, aunque no diga nada? */
function hasImage(block: RichBlock): boolean {
  switch (block.type) {
    case "image":
      return true;
    case "list":
      return block.items.some((item) => item.some(hasImage));
    case "quote":
      return block.blocks.some(hasImage);
    default:
      return false;
  }
}

/** El HTML del editor: lo que se le da a TipTap para que lo abra y lo edite. */
export function richDocToHtml(
  value: string | RichBlock[] | null | undefined,
): string {
  return richDocBlocks(value).map(blockToHtml).join("");
}

function blockToHtml(block: RichBlock): string {
  switch (block.type) {
    case "paragraph":
      return `<p>${inlineToHtml(block.inline)}</p>`;
    case "heading":
      return `<h${block.level}>${inlineToHtml(block.inline)}</h${block.level}>`;
    case "list":
      return `<${block.ordered ? "ol" : "ul"}>${block.items
        .map((item) => `<li>${item.map(blockToHtml).join("")}</li>`)
        .join("")}</${block.ordered ? "ol" : "ul"}>`;
    case "quote":
      return `<blockquote>${block.blocks.map(blockToHtml).join("")}</blockquote>`;
    case "image":
      return `<img src="${escapeHtml(block.src)}"${
        block.alt ? ` alt="${escapeHtml(block.alt)}"` : ""
      }${block.title ? ` title="${escapeHtml(block.title)}"` : ""}>`;
    case "divider":
      return "<hr>";
  }
}

/** Las etiquetas de cada marca, de fuera hacia dentro. */
const MARK_TAGS: Record<RichMark, string> = {
  bold: "strong",
  italic: "em",
  underline: "u",
  strike: "s",
  code: "code",
};

function inlineToHtml(inline: readonly RichInline[]): string {
  return inline.map(runToHtml).join("");
}

function runToHtml(run: RichInline): string {
  const text = escapeHtml(run.text).replace(/\r?\n/g, "<br>");
  const wrapped = (run.marks ?? []).reduce(
    (inner, mark) => `<${MARK_TAGS[mark]}>${inner}</${MARK_TAGS[mark]}>`,
    text,
  );
  return run.href !== undefined
    ? `<a href="${escapeHtml(run.href)}">${wrapped}</a>`
    : wrapped;
}

/**
 * El documento en Markdown, para lo que se lee o se imprime fuera de la
 * aplicación —el informe, que se pasa a PDF tal cual—: los bloques se traducen
 * a la pieza de Markdown que les corresponde (lista, cita, título, imagen), no
 * a un párrafo de texto.
 */
export function richDocToMarkdown(
  value: string | RichBlock[] | null | undefined,
): string {
  return markdownOf(richDocBlocks(value)).trim();
}

function markdownOf(blocks: readonly RichBlock[]): string {
  return blocks.map((block) => markdownBlock(block, 0)).join("\n\n");
}

function markdownBlock(block: RichBlock, depth: number): string {
  switch (block.type) {
    case "paragraph":
      return inlineToMarkdown(block.inline);
    case "heading":
      return `${"#".repeat(block.level)} ${inlineToMarkdown(block.inline)}`;
    case "quote":
      return markdownOf(block.blocks)
        .split("\n")
        .map((line) => (line === "" ? ">" : `> ${line}`))
        .join("\n");
    case "list":
      return block.items
        .map((item, index) => markdownItem(item, index, block.ordered, depth))
        .join("\n");
    case "image":
      return `![${block.alt ?? ""}](${block.src}${
        block.title ? ` "${block.title}"` : ""
      })`;
    case "divider":
      return "---";
  }
}

function markdownItem(
  item: readonly RichBlock[],
  index: number,
  ordered: boolean,
  depth: number,
): string {
  const indent = "  ".repeat(depth);
  const marker = ordered ? `${index + 1}. ` : "- ";
  const [first = "", ...rest] = item
    .map((block) => markdownBlock(block, depth + 1))
    .join("\n\n")
    .split("\n");
  return [
    `${indent}${marker}${first}`,
    ...rest.map((line) =>
      line === "" ? "" : `${indent}${" ".repeat(marker.length)}${line}`,
    ),
  ].join("\n");
}

/**
 * Las marcas de Markdown que hay que neutralizar para que no pinten nada: se
 * usa con el texto de la nota y con lo que se pone a su alrededor (un nombre de
 * archivo lleva guiones bajos con mucha facilidad).
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/[*_`\\[\]]/g, "\\$&");
}

function inlineToMarkdown(inline: readonly RichInline[]): string {
  return inline.map(runToMarkdown).join("");
}

function runToMarkdown(run: RichInline): string {
  const marks = run.marks ?? [];
  let text = escapeMarkdown(run.text);
  if (marks.includes("strike")) text = `~~${text}~~`;
  if (marks.includes("italic")) text = `*${text}*`;
  if (marks.includes("bold")) text = `**${text}**`;
  return run.href !== undefined ? `[${text}](${run.href})` : text;
}

// ---------------------------------------------------------------------------
// Lo que se guarda
// ---------------------------------------------------------------------------

/**
 * El editor necesita un párrafo libre al final para poder seguir escribiendo,
 * así que al guardar suele sobrar uno vacío. No es contenido y se quita: si no,
 * el documento arrastraría un hueco en blanco por cada nota.
 */
function trimTrailingEmptyBlocks(blocks: RichBlock[]): RichBlock[] {
  const out = [...blocks];
  while (out.length > 0) {
    const last = out[out.length - 1];
    if (last.type === "paragraph" && richBlockText(last).trim() === "")
      out.pop();
    else break;
  }
  return out;
}

/**
 * ¿No hay nada escrito? Un documento con formato vacío no es una nota: cuenta
 * como vacío, salvo que lleve una imagen, que sí es contenido.
 */
export function richDocIsEmpty(
  value: string | RichBlock[] | null | undefined,
): boolean {
  const blocks = richDocBlocks(value);
  return !blocks.some(hasImage) && plainTextOf(blocks).length === 0;
}

/**
 * Lo que se manda a guardar, o `undefined` si al final no dice nada: lo que
 * escribe el editor —o un valor con el formato de antes— se guarda como
 * documento, ya recortado de párrafos vacíos, para que la ficha no arrastre un
 * hueco en blanco por cada nota.
 *
 * Un texto sin estructura —una nota escrita en un campo de texto plano, de las
 * de antes— se guarda tal y como estaba, recortado: pasar por bloques un texto
 * que no tiene ninguno no añadiría nada, y así las notas de siempre siguen en
 * la base tal y como se escribieron.
 */
export function richDocToStore(
  value: string | RichBlock[] | null | undefined,
): string | undefined {
  if (typeof value === "string" && !hasStructure(value)) {
    const text = value.trim();
    return text === "" ? undefined : text;
  }
  const blocks = trimTrailingEmptyBlocks(richDocBlocks(value));
  if (blocks.length === 0 || richDocIsEmpty(blocks)) return undefined;
  return JSON.stringify(blocks);
}
