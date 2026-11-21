import { normalizeContentId } from "@/lib/mailClient/mime";

export interface CidAttachment {
  contentId: string | null;
  url: string | null;
}

/** Mapa `Content-ID` → URL del objeto; solo se construye con datos del servidor. */
export function cidUrlMap(
  attachments: readonly CidAttachment[],
): Map<string, string> {
  const urls = new Map<string, string>();
  for (const attachment of attachments) {
    const contentId = normalizeContentId(attachment.contentId);
    if (contentId !== null && attachment.url !== null) {
      urls.set(contentId, attachment.url);
    }
  }
  return urls;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/**
 * Sustituye solo las referencias que tienen un adjunto propio. Las que no lo
 * tienen se quedan como están y el CSP las bloquea si intentan salir fuera.
 */
export function replaceCidReferences(
  html: string,
  urls: ReadonlyMap<string, string>,
): string {
  return html.replace(/cid:([^"'\s)>]+)/gi, (match, raw: string) => {
    let key = raw;
    try {
      key = decodeURIComponent(raw);
    } catch {
      // Un `cid:` mal formado se deja intacto; el CSP lo bloquea.
    }
    const url = urls.get(key);
    return url === undefined ? match : escapeAttribute(url);
  });
}

/** ¿El HTML intenta cargar una imagen remota? Se usa para ofrecer el botón. */
export function hasRemoteImages(html: string): boolean {
  return (
    /<\s*img\b[^>]*\bsrc\s*=\s*["']?https?:/i.test(html) ||
    /url\(\s*["']?https?:/i.test(html)
  );
}

/** Orígenes de los objetos del almacén que el iframe puede enseñar. */
export function storageOrigins(
  attachments: readonly { url: string | null }[],
  fallbackOrigin: string,
): string[] {
  const origins = new Set<string>();
  for (const attachment of attachments) {
    if (attachment.url === null) continue;
    try {
      origins.add(new URL(attachment.url, fallbackOrigin).origin);
    } catch {
      // Una URL que no se puede leer no se añade al CSP.
    }
  }
  return [...origins];
}
