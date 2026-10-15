/** Las marcas que puede llevar un trozo de texto (lo que sabe poner el editor). */
export type RichMark = "bold" | "italic" | "underline" | "strike" | "code";

export const MARKS: readonly RichMark[] = [
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

/** Las entidades que puede dejar el editor al escribir; el resto se conservan. */
export const NAMED_ENTITIES: Record<string, string> = {
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
export function decodeEntity(entity: string): string | undefined {
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
export function decodeEntities(value: string): string {
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
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Las marcas, sin repetir y siempre en el mismo orden (para poder compararlas). */
export function canonicalMarks(marks: readonly RichMark[]): RichMark[] {
  return MARKS.filter((mark) => marks.includes(mark));
}
