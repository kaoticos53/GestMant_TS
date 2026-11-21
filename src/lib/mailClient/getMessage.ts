import { firstNode, parseSoapBody, readAttr, readNumberAttr } from "./xml";
import type { MailMessageDownload } from "./types";

/** Extrae la preparación de descarga: id, tamaño exacto y URL del servlet. */
export function parseGetMessageResponse(xml: string): MailMessageDownload {
  const body = parseSoapBody(xml);
  const response = firstNode(body["GetMsgResponse"]);
  const message = response ? firstNode(response["m"]) : null;
  const content = message ? firstNode(message["content"]) : null;

  const messageId = readAttr(message, "id");
  const contentUrl = readAttr(content, "url");
  if (!message || !messageId || !contentUrl) {
    throw new Error("GetMsg no devolvió mensaje o URL de contenido.");
  }

  return {
    messageId,
    size: readNumberAttr(message, "s"),
    contentUrl,
  };
}

/**
 * Resuelve la URL del servlet contra el origen fijo. Se conserva path y query;
 * una URL absoluta a otro origen se rechaza para no abrir un SSRF.
 */
export function resolveContentUrl(
  serverUrl: string,
  contentUrl: string,
): string {
  let origin: URL;
  try {
    origin = new URL(serverUrl);
  } catch {
    throw new Error("El servidor de correo no es una URL válida.");
  }

  const resolved = new URL(contentUrl, origin);
  if (resolved.origin !== origin.origin) {
    throw new Error("La URL de contenido apunta fuera del servidor de correo.");
  }
  return resolved.toString();
}
