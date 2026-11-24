import { asArray, asNode, parseSoapBody, readAttr } from "./xml";
import type { MailSyncPage } from "./types";

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

function collectIds(value: unknown): string[] {
  const node = asNode(value);
  if (!node) return [];

  const ids = parseIds(readAttr(node, "ids"));
  for (const message of asArray(node["m"])) {
    const messageNode = asNode(message);
    if (messageNode) ids.push(...parseIds(readAttr(messageNode, "ids")));
  }
  return ids;
}

/**
 * Parsea una página de Sync. Los ids modificados viven dentro de
 * `<folder><m ids="…"/>` y los borrados dentro de `<deleted>`, no en la raíz.
 */
export function parseSyncResponse(xml: string): MailSyncPage {
  const body = parseSoapBody(xml);
  const response = asNode(body["SyncResponse"]);
  if (!response) throw new Error("La respuesta no es un SyncResponse.");

  const changedIds: string[] = [];
  for (const folder of asArray(response["folder"])) {
    changedIds.push(...collectIds(folder));
  }

  const deletedIds: string[] = [];
  for (const deleted of asArray(response["deleted"])) {
    deletedIds.push(...collectIds(deleted));
  }

  return {
    changedIds,
    deletedIds,
    token: readAttr(response, "token"),
    more: readAttr(response, "more") === "1",
  };
}

/** Si hay más páginas, hay que iterarlas antes de guardar el token. */
export function shouldContinueSync(more: boolean): boolean {
  return more;
}

/** Campos comparables para decidir si una cabecera persistida requiere escritura. */
export interface MailHeaderComparable {
  folderRemoteId: string;
  conversationId?: string | null;
  subject: string;
  fromName: string;
  fromAddress: string;
  date: number;
  size: number;
  flags: string;
  hasAttachments: boolean;
  snippet: string;
  deletedRemoteAt?: number;
}

/**
 * Devuelve `true` si la cabecera recibida cambia respecto a la almacenada
 * (o si había sido marcada como borrada remotamente y hay que resucitarla).
 */
export function hasMailHeaderChanged(
  existing: MailHeaderComparable,
  incoming: MailHeaderComparable,
): boolean {
  if (existing.deletedRemoteAt !== undefined) return true;
  if (existing.folderRemoteId !== incoming.folderRemoteId) return true;
  if (
    (existing.conversationId ?? undefined) !==
    (incoming.conversationId ?? undefined)
  ) {
    return true;
  }
  if (existing.subject !== incoming.subject) return true;
  if (existing.fromName !== incoming.fromName) return true;
  if (existing.fromAddress !== incoming.fromAddress) return true;
  if (existing.date !== incoming.date) return true;
  if (existing.size !== incoming.size) return true;
  if (existing.flags !== incoming.flags) return true;
  if (existing.hasAttachments !== incoming.hasAttachments) return true;
  if (existing.snippet !== incoming.snippet) return true;
  return false;
}
