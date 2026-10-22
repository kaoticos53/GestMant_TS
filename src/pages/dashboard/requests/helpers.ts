import { richDocIsEmpty, richDocToPlainText } from "@/lib/richDoc";
import { formatDateTime, PRIORITY_META, STATUS_META, type Priority } from "@/lib/workshop";
import {
  PRIORITY_RANK,
  STATUS_RANK,
  type RequestDoc,
  type RequestFilterId,
} from "./types";

/** Orden de trabajo: lo que está pendiente y lo urgente primero. */
export function inQueueOrder(requests: RequestDoc[]): RequestDoc[] {
  return [...requests].sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      b.createdAt - a.createdAt,
  );
}

/** Todo lo que identifica una petición para el buscador. */
export function searchableFields(request: RequestDoc): (string | undefined)[] {
  return [
    request.reference,
    request.requesterName,
    request.requesterTeam,
    request.equipment,
    richDocToPlainText(request.description),
    richDocToPlainText(request.notes),
    richDocToPlainText(request.decisionNote),
    richDocToPlainText(request.issueNote),
    richDocToPlainText(request.holdNote),
    richDocToPlainText(request.returnNote),
    richDocToPlainText(request.cancelNote),
    request.decidedBy,
    STATUS_META[request.status]?.label ?? STATUS_META.pending.label,
    PRIORITY_META[request.priority as Priority].label,
    request.lines.map((line) => `${line.code} ${line.name}`).join(" "),
  ];
}

export function countByStatus(
  requests: RequestDoc[],
): Record<RequestFilterId, number> {
  const counts: Record<RequestFilterId, number> = {
    all: requests.length,
    pending: 0,
    approved: 0,
    issued: 0,
    onHold: 0,
    returned: 0,
    rejected: 0,
    cancelled: 0,
    pendingSupplierQuote: 0,
    materialReceived: 0,
  };
  for (const request of requests) {
    if ("status" in request && request.status in counts)
      counts[request.status] += 1;
  }
  return counts;
}

/**
 * La decisión de una petición en una línea: quién la tomó, cuándo y por qué.
 */
export function decisionLine(request: RequestDoc): string {
  const reason = (value: string | undefined) =>
    value && !richDocIsEmpty(value) ? ` · ${richDocToPlainText(value)}` : "";
  const at = (value: number | undefined) =>
    value ? ` · ${formatDateTime(value)}` : "";

  switch (request.status) {
    case "approved":
      return `Aprobada por ${request.decidedBy ?? "el responsable"}${at(
        request.decidedAt,
      )}${reason(request.decisionNote)}`;
    case "rejected":
      return `Rechazada por ${request.decidedBy ?? "el responsable"}${reason(
        request.decisionNote,
      )}`;
    case "issued":
      return `Material entregado${at(request.issuedAt)}${reason(
        request.issueNote,
      )}`;
    case "onHold":
      return `En espera${at(request.holdSinceAt)}${reason(request.holdNote)}`;
    case "returned":
      return `Material devuelto${at(request.returnedAt)}${reason(
        request.returnNote,
      )}`;
    case "cancelled":
      return `Cancelada${at(request.cancelledAt)}${reason(request.cancelNote)}`;
    case "pendingSupplierQuote":
      return `Presupuesto externo en curso${at(request.quoteRequestedAt)}${reason(
        request.decisionNote,
      )}`;
    default:
      return "";
  }
}

/**
 * El motivo del último paso tal cual, sin el resto de la frase.
 */
export function stepReason(request: RequestDoc): string {
  switch (request.status) {
    case "issued":
      return richDocToPlainText(request.issueNote);
    case "onHold":
      return richDocToPlainText(request.holdNote);
    case "returned":
      return richDocToPlainText(request.returnNote);
    case "cancelled":
      return richDocToPlainText(request.cancelNote);
    default:
      return "";
  }
}

export function attachmentCounts(request: RequestDoc) {
  let images = 0;
  let documents = 0;
  for (const attachment of request.attachments) {
    if (attachment.kind === "image") images += 1;
    else documents += 1;
  }
  return { images, documents };
}

export const REQUESTS_CSV_HEADER = [
  "Referencia",
  "Estado",
  "Prioridad",
  "Solicitante",
  "Área",
  "Equipo",
  "Líneas",
  "Descripción",
  "Notas",
  "Decisión",
  "Motivo",
  "Decidido por",
  "Creada",
  "Decidida",
  "Entregada",
];

/**
 * Transforma una lista de peticiones al formato tabular estructurado para exportar en CSV.
 */
export function buildRequestsCsvData(requests: RequestDoc[]): {
  header: string[];
  rows: (string | number)[][];
} {
  const rows = requests.map((request) => [
    request.reference,
    STATUS_META[request.status]?.label ?? request.status,
    PRIORITY_META[request.priority as Priority]?.label ?? request.priority,
    request.requesterName,
    request.requesterTeam ?? "",
    request.equipment ?? "",
    (request.lines ?? [])
      .map((line) => `${line.code} ${line.name} x${line.quantity}`)
      .join(" | "),
    richDocToPlainText(request.description),
    richDocToPlainText(request.notes),
    richDocToPlainText(request.decisionNote),
    stepReason(request),
    request.decidedBy ?? "",
    formatDateTime(request.createdAt),
    request.decidedAt ? formatDateTime(request.decidedAt) : "",
    request.issuedAt ? formatDateTime(request.issuedAt) : "",
  ]);

  return { header: REQUESTS_CSV_HEADER, rows };
}
