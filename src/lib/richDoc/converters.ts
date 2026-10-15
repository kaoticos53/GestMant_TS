import {
  looksLikeHtml,
  parseDocJson,
  richDocBlocks,
} from "./parser";
import {
  escapeHtml,
  type RichBlock,
  type RichInline,
  type RichMark,
} from "./types";

/** El texto de un trozo, sin sus marcas. */
export function inlineText(inline: readonly RichInline[]): string {
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
export function plainTextOf(blocks: readonly RichBlock[]): string {
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
export function hasImage(block: RichBlock): boolean {
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

export function safeSrc(src: string | undefined): string {
  if (!src) return "";
  const trimmed = src.trim();
  if (/^(?:https?:|\/|data:image\/(?:png|jpeg|webp|gif|avif);base64,)/i.test(trimmed)) {
    return trimmed;
  }
  return "";
}

export function safeHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  const trimmed = href.trim();
  if (/^(?:https?:|mailto:|tel:|\/|#)/i.test(trimmed)) {
    return trimmed;
  }
  return undefined;
}

export function blockToHtml(block: RichBlock): string {
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
    case "image": {
      const src = safeSrc(block.src);
      if (!src) return "";
      return `<img src="${escapeHtml(src)}"${
        block.alt ? ` alt="${escapeHtml(block.alt)}"` : ""
      }${block.title ? ` title="${escapeHtml(block.title)}"` : ""}>`;
    }
    case "divider":
      return "<hr>";
  }
}

export const MARK_TAGS: Record<RichMark, string> = {
  bold: "strong",
  italic: "em",
  underline: "u",
  strike: "s",
  code: "code",
};

export function inlineToHtml(inline: readonly RichInline[]): string {
  return inline.map(runToHtml).join("");
}

export function runToHtml(run: RichInline): string {
  const text = escapeHtml(run.text).replace(/\r?\n/g, "<br>");
  const wrapped = (run.marks ?? []).reduce(
    (inner, mark) => `<${MARK_TAGS[mark]}>${inner}</${MARK_TAGS[mark]}>`,
    text,
  );
  const href = safeHref(run.href);
  return href !== undefined
    ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer">${wrapped}</a>`
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

export function markdownOf(blocks: readonly RichBlock[]): string {
  return blocks.map((block) => markdownBlock(block, 0)).join("\n\n");
}

export function markdownBlock(block: RichBlock, depth: number): string {
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

export function markdownItem(
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

export function escapeMarkdown(text: string): string {
  return text.replace(/[*_`\\[\]]/g, "\\$&");
}

export function inlineToMarkdown(inline: readonly RichInline[]): string {
  return inline.map(runToMarkdown).join("");
}

export function runToMarkdown(run: RichInline): string {
  const marks = run.marks ?? [];
  let text = escapeMarkdown(run.text);
  if (marks.includes("strike")) text = `~~${text}~~`;
  if (marks.includes("italic")) text = `*${text}*`;
  if (marks.includes("bold")) text = `**${text}**`;
  return run.href !== undefined ? `[${text}](${run.href})` : text;
}

export function hasStructure(value: string): boolean {
  if (looksLikeHtml(value.replace(/<!--[\s\S]*?-->/g, ""))) return true;
  return parseDocJson(value) !== undefined;
}

export function trimTrailingEmptyBlocks(blocks: RichBlock[]): RichBlock[] {
  const out = [...blocks];
  while (out.length > 0) {
    const last = out[out.length - 1];
    if (last.type === "paragraph" && richBlockText(last).trim() === "")
      out.pop();
    else break;
  }
  return out;
}

export function richDocIsEmpty(
  value: string | RichBlock[] | null | undefined,
): boolean {
  const blocks = richDocBlocks(value);
  return !blocks.some(hasImage) && plainTextOf(blocks).length === 0;
}

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
