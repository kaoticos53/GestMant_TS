/**
 * El parte entregable: un ZIP con el Markdown y las fotos que cita dentro, para
 * poder pasarlo a quien lo lee sin depender del servidor.
 *
 * El informe en Markdown lleva las fotos de las notas como enlaces a donde están
 * guardadas; si se entrega así, quien lo recibe se queda con los enlaces —que
 * solo abren con sesión y mientras el archivo siga en el almacén— y con un
 * documento al que le faltan las fotos. El paquete lo cierra: cada foto viaja
 * dentro, en `fotos/`, y el Markdown la cita por su ruta relativa, que es la que
 * funciona en cuanto se descomprime.
 *
 * Una foto que ya no esté no desaparece del parte sin dejar rastro: en su sitio
 * queda dicho que no se pudo incluir, igual que hace el PDF.
 */

import { createZip, type ZipEntry } from "./zip";

/** Tipo MIME del paquete: un ZIP, con el parte y sus fotos dentro. */
export const REPORT_PACKAGE_MIME = "application/zip";

/** Los bytes de una foto citada por el parte, o `null` si ya no está. */
export type ReportLoadPhoto = (
  src: string,
) => Promise<Uint8Array | null | undefined>;

/** Una foto citada por el parte. */
export interface ReportPhoto {
  /** El texto que la describe: `![aquí](dirección)`. */
  alt: string;
  /** De dónde se trae. */
  src: string;
}

/** Una foto del paquete, ya dentro. */
export interface ReportPackagePhoto {
  alt: string;
  /** Su ruta dentro del ZIP (`fotos/01-canal-12.png`). */
  path: string;
  bytes: number;
}

export interface ReportPackageOptions {
  /** El parte en Markdown, tal y como se descargaría solo. */
  markdown: string;
  /** Cómo se llama el Markdown dentro del paquete. */
  markdownName: string;
  /** De dónde se traen los bytes de cada foto. Sin esto, se citan como ausentes. */
  loadPhoto?: ReportLoadPhoto;
  /** El instante con el que se fecha el paquete; por defecto, ahora. */
  now?: number;
}

export interface ReportPackage {
  bytes: Uint8Array;
  /** El Markdown que va dentro, con las fotos citadas por su ruta local. */
  markdown: string;
  photos: ReportPackagePhoto[];
  /** Las fotos que se citan y no se pudieron traer, por su descripción. */
  missing: string[];
}

/** Una imagen del Markdown: `![texto](dirección "título")`. */
const PHOTO = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

/** Una cita de foto, con dónde empieza y acaba para poder sustituirla entera. */
interface PhotoLink extends ReportPhoto {
  from: number;
  to: number;
}

function photoLinks(markdown: string): PhotoLink[] {
  const links: PhotoLink[] = [];
  // La búsqueda empieza de cero cada vez: el patrón lleva `g` y guarda dónde se
  // quedó, y las fotos de un parte no dependen de quién preguntó antes.
  PHOTO.lastIndex = 0;
  let match = PHOTO.exec(markdown);
  while (match !== null) {
    links.push({
      alt: match[1],
      src: match[2],
      from: match.index,
      to: match.index + match[0].length,
    });
    match = PHOTO.exec(markdown);
  }
  return links;
}

/**
 * Las fotos que cita el parte, en el orden en que aparecen y sin repetir las que
 * se citan dos veces: la misma foto es un archivo, no dos.
 */
export function reportPhotos(markdown: string): ReportPhoto[] {
  const seen = new Set<string>();
  return photoLinks(markdown)
    .filter((link) => (seen.has(link.src) ? false : seen.add(link.src)))
    .map(({ alt, src }) => ({ alt, src }));
}

/** El tipo de una imagen por sus primeros bytes; sin ellos, no se sabe. */
function imageExtension(bytes: Uint8Array): string | undefined {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "png";
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return "gif";
  if (bytes[8] === 0x57 && bytes[9] === 0x45) return "webp";
  return undefined;
}

/** Un nombre de archivo presentable: sin acentos, sin espacios y sin barras. */
function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** La extensión que le toca a una foto, por sus bytes o por su dirección. */
function extensionOf(src: string, bytes: Uint8Array): string {
  const known = imageExtension(bytes);
  if (known) return known;
  const fromUrl = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(src)?.[1]?.toLowerCase();
  if (fromUrl && /^(png|jpe?g|gif|webp|bmp|avif|heic)$/.test(fromUrl)) {
    return fromUrl === "jpeg" ? "jpg" : fromUrl;
  }
  return "jpg";
}

/**
 * Cómo se llama la foto dentro del paquete: un número que la ordena —así se
 * leen en el mismo orden en que las cita el parte— y el nombre que se lee en la
 * aplicación, limpiado para que valga en cualquier sistema.
 */
function photoPath(
  index: number,
  alt: string,
  src: string,
  bytes: Uint8Array,
): string {
  const number = String(index + 1).padStart(2, "0");
  const fromAlt = alt.replace(/\.[a-z0-9]+$/i, "");
  const fromUrl = src.split(/[?#]/)[0].split("/").pop() ?? "";
  const name =
    slug(fromAlt) ||
    slug(fromUrl.replace(/\.[a-z0-9]+$/i, "")) ||
    `foto-${number}`;
  return `fotos/${number}-${name}.${extensionOf(src, bytes)}`;
}

/**
 * Compone el paquete: el Markdown con las fotos citadas por su ruta local, cada
 * foto dentro, y la lista de las que no se pudieron traer.
 */
export async function reportPackage(
  options: ReportPackageOptions,
): Promise<ReportPackage> {
  const now = options.now ?? Date.now();
  const links = photoLinks(options.markdown);
  const files: ZipEntry[] = [];
  const photos: ReportPackagePhoto[] = [];
  const missing: string[] = [];
  /** La ruta de cada dirección: la misma foto no entra dos veces. */
  const paths = new Map<string, string>();
  const parts: string[] = [];
  let cursor = 0;

  for (const link of links) {
    parts.push(options.markdown.slice(cursor, link.from));
    cursor = link.to;

    const known = paths.get(link.src);
    if (known !== undefined) {
      parts.push(`![${link.alt}](${known})`);
      continue;
    }

    const bytes = options.loadPhoto
      ? await options.loadPhoto(link.src)
      : undefined;
    if (!bytes || bytes.length === 0) {
      // Una foto perdida no puede llevarse por delante el parte: queda dicho en
      // su sitio, y el paquete sigue siendo entregable.
      const name = link.alt.trim() === "" ? "foto" : link.alt.trim();
      if (!missing.includes(name)) missing.push(name);
      parts.push(`_[imagen no disponible: ${name}]_`);
      continue;
    }

    const path = photoPath(photos.length, link.alt, link.src, bytes);
    paths.set(link.src, path);
    files.push({ name: path, bytes });
    photos.push({ alt: link.alt, path, bytes: bytes.length });
    parts.push(`![${link.alt}](${path})`);
  }
  parts.push(options.markdown.slice(cursor));
  const markdown = parts.join("");

  const entries: ZipEntry[] = [
    { name: options.markdownName, bytes: new TextEncoder().encode(markdown) },
    ...files,
  ];

  return {
    bytes: createZip(entries, new Date(now)),
    markdown,
    photos,
    missing,
  };
}
