import { asNode, firstNode, parseSoapBody, readText } from "./xml";

export interface MailFault {
  code: string;
  message: string;
  trace: string | null;
}

export interface MailFailureClassification {
  code: string | null;
  message: string;
  retryable: boolean;
  requiresCredentials: boolean;
  requiresTokenRefresh: boolean;
  invalidSyncToken: boolean;
  retryAfterSeconds: number | null;
}

/** Extrae un fault SOAP 1.2; devuelve `null` si la respuesta no es un fault. */
export function parseSoapFault(xml: string): MailFault | null {
  const body = parseSoapBody(xml);
  const fault = asNode(body["Fault"]);
  if (!fault) return null;

  const codeNode = asNode(fault["Code"]);
  const reasonNode = asNode(fault["Reason"]);
  const detailNode = asNode(fault["Detail"]);
  const errorNode = detailNode ? firstNode(detailNode["Error"]) : null;

  return {
    code:
      readText(errorNode?.["Code"]) ||
      readText(codeNode?.["Value"]) ||
      "unknown",
    message:
      readText(reasonNode?.["Text"]) ||
      readText(errorNode?.["Text"]) ||
      "Error SOAP",
    trace: readText(errorNode?.["Trace"]) || null,
  };
}

/**
 * Decide si un fallo de transporte se puede reintentar. Un fault de negocio
 * manda sobre el status: un 500 con `mail.NO_SUCH_PART` no se repite.
 */
export function classifyHttpFailure({
  status,
  fault = null,
  retryAfterSeconds = null,
}: {
  status: number;
  fault?: MailFault | null;
  retryAfterSeconds?: number | null;
}): MailFailureClassification {
  const code = fault?.code ?? null;
  const normalizedCode = code?.trim().toLowerCase() ?? "";
  const requiresCredentials = normalizedCode.includes("account.auth_failed");
  const requiresTokenRefresh =
    status === 401 ||
    normalizedCode.includes("auth_required") ||
    normalizedCode.includes("auth_expired");
  const invalidSyncToken = normalizedCode.includes("invalid_sync_token");

  const retryableStatus =
    status === 408 || status === 425 || status === 429 || status >= 500;
  const retryable =
    !fault && !requiresTokenRefresh && !invalidSyncToken && retryableStatus;

  const retryAfter =
    typeof retryAfterSeconds === "number" && Number.isFinite(retryAfterSeconds)
      ? Math.max(0, Math.trunc(retryAfterSeconds))
      : null;

  return {
    code,
    message: fault?.message ?? `Error HTTP ${status}`,
    retryable,
    requiresCredentials,
    requiresTokenRefresh,
    invalidSyncToken,
    retryAfterSeconds: retryAfter,
  };
}
