/**
 * Constructores SOAP 1.2 de Zimbra. Son funciones puras: reciben datos ya
 * resueltos y devuelven XML. El token nunca se construye fuera de este módulo.
 */

const SOAP_NAMESPACE = "http://www.w3.org/2003/05/soap-envelope";
const ZIMBRA_MAIL_NAMESPACE = "urn:zimbraMail";
const ZIMBRA_ACCOUNT_NAMESPACE = "urn:zimbraAccount";

/** Escapa texto y atributos para no inyectar XML desde datos del servidor. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildEnvelope(body: string, authToken?: string | null): string {
  const header = authToken
    ? `<soap:Header><context xmlns="urn:zimbra"><authToken>${escapeXml(
        authToken,
      )}</authToken></context></soap:Header>`
    : "<soap:Header/>";

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soap:Envelope xmlns:soap="${SOAP_NAMESPACE}">` +
    header +
    `<soap:Body>${body}</soap:Body>` +
    `</soap:Envelope>`
  );
}

export function buildAuthRequest({
  account,
  password,
}: {
  account: string;
  password: string;
}): string {
  return buildEnvelope(
    `<AuthRequest xmlns="${ZIMBRA_ACCOUNT_NAMESPACE}">` +
      `<account by="name">${escapeXml(account)}</account>` +
      `<password>${escapeXml(password)}</password>` +
      `</AuthRequest>`,
  );
}

export function buildGetFolderRequest({
  authToken,
}: {
  authToken: string;
}): string {
  return buildEnvelope(
    `<GetFolderRequest xmlns="${ZIMBRA_MAIL_NAMESPACE}"><folder/></GetFolderRequest>`,
    authToken,
  );
}

export function buildSearchRequest({
  authToken,
  folderPath,
  offset = 0,
  limit = 500,
  sortBy = "dateAsc",
  after,
}: {
  authToken: string;
  folderPath: string;
  offset?: number;
  limit?: number;
  sortBy?: string;
  after?: string;
}): string {
  const safeOffset = Math.max(0, Math.trunc(offset));
  const safeLimit = Math.max(1, Math.trunc(limit));
  const query = after
    ? `in:"${folderPath}" after:${after}`
    : `in:"${folderPath}"`;

  return buildEnvelope(
    `<SearchRequest xmlns="${ZIMBRA_MAIL_NAMESPACE}"` +
      ` types="message" sortBy="${escapeXml(sortBy)}"` +
      ` offset="${safeOffset}" limit="${safeLimit}"` +
      ` query="${escapeXml(query)}"/>`,
    authToken,
  );
}

export function buildSyncRequest({
  authToken,
  folderId,
  token,
}: {
  authToken: string;
  folderId: string;
  token?: string | null;
}): string {
  const tokenAttr = token ? ` token="${escapeXml(token)}"` : "";
  return buildEnvelope(
    `<SyncRequest xmlns="${ZIMBRA_MAIL_NAMESPACE}"` +
      ` l="${escapeXml(folderId)}"${tokenAttr}` +
      ` msgCutoff="0" changeLimit="1000" deleteLimit="1000"/>`,
    authToken,
  );
}

export function buildGetMessageRequest({
  authToken,
  messageId,
}: {
  authToken: string;
  messageId: string;
}): string {
  return buildEnvelope(
    `<GetMsgRequest xmlns="${ZIMBRA_MAIL_NAMESPACE}">` +
      `<m id="${escapeXml(messageId)}" read="0" raw="1" useContentUrl="1"/>` +
      `</GetMsgRequest>`,
    authToken,
  );
}
