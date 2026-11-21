import {
  asArray,
  asNode,
  parseSoapBody,
  readAttr,
  readNumberAttr,
  readText,
  type XmlNode,
} from "./xml";
import type { MailHeader, MailSearchPage } from "./types";

function firstSender(node: XmlNode): XmlNode | null {
  const senders = asArray(node["e"])
    .map((value) => asNode(value))
    .filter((value): value is XmlNode => value !== null);
  return (
    senders.find((sender) => readAttr(sender, "t") === "f") ??
    senders[0] ??
    null
  );
}

function parseHeader(value: unknown): MailHeader | null {
  const node = asNode(value);
  if (!node) return null;

  const messageId = readAttr(node, "id");
  if (!messageId) return null;

  const sender = firstSender(node);
  const fromAddress = readAttr(sender, "a") ?? "";
  const flags = readAttr(node, "f") ?? "";

  return {
    messageId,
    folderRemoteId: readAttr(node, "l") ?? "",
    conversationId: readAttr(node, "cid"),
    subject: readText(node["su"]),
    fromName:
      readAttr(sender, "p") ?? readAttr(sender, "d") ?? fromAddress ?? "",
    fromAddress,
    date: readNumberAttr(node, "d"),
    size: readNumberAttr(node, "s"),
    flags,
    hasAttachments: flags.includes("a"),
    snippet: readText(node["fr"]),
  };
}

/** Parsea una página de Search; no inventa `total` porque el servidor no lo da. */
export function parseSearchResponse(xml: string): MailSearchPage {
  const body = parseSoapBody(xml);
  const response = asNode(body["SearchResponse"]);
  if (!response) throw new Error("La respuesta no es un SearchResponse.");

  const headers = asArray(response["m"])
    .map((value) => parseHeader(value))
    .filter((header): header is MailHeader => header !== null);

  return {
    headers,
    offset: readNumberAttr(response, "offset"),
    more: readAttr(response, "more") === "1",
    sortBy: readAttr(response, "sortBy"),
  };
}

/** El listado local siempre se pinta de más reciente a más antiguo. */
export function sortHeadersByDateDesc(
  headers: readonly MailHeader[],
): MailHeader[] {
  return [...headers].sort(
    (a, b) => b.date - a.date || a.messageId.localeCompare(b.messageId),
  );
}

/**
 * Se sigue mientras el servidor diga `more` o la página venga llena. No se usa
 * `total`: la referencia ya avisa de que este servidor no lo publica.
 */
export function hasMoreSearchResults({
  more,
  count,
  limit,
}: {
  more: boolean;
  count: number;
  limit: number;
}): boolean {
  if (more) return true;
  return limit > 0 && count >= limit;
}

/** Siguiente offset de la paginación por páginas. */
export function nextSearchOffset(offset: number, count: number): number {
  const safeOffset = Number.isFinite(offset)
    ? Math.max(0, Math.trunc(offset))
    : 0;
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  return safeOffset + safeCount;
}

/** Fecha que acepta el filtro `after:` del servidor: M/D/AAAA. */
export function formatSearchDate(date: Date): string {
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()}`;
}
