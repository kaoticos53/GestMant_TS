import { richDocToPlainText } from "@/lib/richDoc";
import {
  INCIDENT_STATUS_META,
  STATUS_META,
  formatDateTime,
} from "@/lib/workshop";
import type { IncidentDoc, RequestDoc, ArchiveEntry } from "../types";

/**
 * Transforma un documento de incidencia en una fila de entrada unificada de archivo.
 */
export function incidentToArchiveEntry(incident: IncidentDoc): ArchiveEntry {
  const meta =
    INCIDENT_STATUS_META[incident.status] ?? INCIDENT_STATUS_META.reported;
  return {
    id: incident._id,
    kind: "incident",
    reference: incident.reference,
    title: `${incident.equipmentKind} · ${incident.model}`,
    // Lo descrito se enseña aquí como una línea del listado, no como un bloque
    // con formato: se queda su texto (el formato se lee entero en la ficha).
    subtitle: richDocToPlainText(incident.description),
    statusLabel: meta.label,
    statusClassName: meta.badgeClassName,
    date: incident.archivedAt ?? incident.closedAt ?? incident.reportedAt,
    archivedBy: incident.archivedBy,
    fields: [
      incident.reference,
      incident.equipmentKind,
      incident.model,
      incident.serialNumber,
      // El buscador del archivo compara texto: una descripción con formato se
      // busca por lo que dice, no por el marcado de su documento.
      richDocToPlainText(incident.description),
      incident.location,
      incident.reporterName,
      incident.assigneeName,
      incident.workshopAssigneeName,
      richDocToPlainText(incident.notes),
      incident.archivedBy,
    ],
  };
}

/**
 * Genera el texto de estado contextualizado para una petición archivada.
 */
export function getRequestStatusContext(request: RequestDoc): string {
  const meta = STATUS_META[request.status];
  if (request.status === "issued") {
    return `Entregada · ${request.issuedAt ? formatDateTime(request.issuedAt) : ""}`;
  }
  if (request.status === "onHold") {
    return `En espera${request.holdSinceAt ? ` · desde ${formatDateTime(request.holdSinceAt)}` : ""}`;
  }
  if (request.status === "returned") {
    return `Devuelta${request.returnedAt ? ` · ${formatDateTime(request.returnedAt)}` : ""}`;
  }
  if (request.status === "cancelled") {
    return `Cancelada${request.cancelledAt ? ` · ${formatDateTime(request.cancelledAt)}` : ""}`;
  }
  if (request.status === "pendingSupplierQuote") {
    return `Presupuesto pendiente${request.quoteRequestedAt ? ` · ${formatDateTime(request.quoteRequestedAt)}` : ""}`;
  }
  if (request.decidedAt) {
    return `${meta.label}${` · ${request.decidedAt ? formatDateTime(request.decidedAt) : ""}`}`;
  }
  return meta.label;
}

/**
 * Transforma un documento de petición de repuesto en una fila de entrada unificada de archivo.
 */
export function requestToArchiveEntry(request: RequestDoc): ArchiveEntry {
  const meta = STATUS_META[request.status];
  const lines = request.lines
    .map((line) => `${line.code} ${line.name}`)
    .join(" · ");
  const statusContext = getRequestStatusContext(request);

  return {
    id: request._id,
    kind: "request",
    reference: request.reference,
    title:
      lines ||
      richDocToPlainText(request.description) ||
      "Petición sin repuesto",
    subtitle: [request.requesterName, request.requesterTeam, request.equipment]
      .filter(Boolean)
      .join(" · "),
    statusLabel: statusContext,
    statusClassName: meta.badgeClassName ?? STATUS_META.pending.badgeClassName,
    date:
      request.archivedAt ??
      request.issuedAt ??
      request.decidedAt ??
      request.quoteRequestedAt ??
      request.returnedAt ??
      request.holdSinceAt ??
      request.createdAt,
    archivedBy: request.archivedBy,
    fields: [
      request.reference,
      request.requesterName,
      request.requesterTeam,
      request.equipment,
      richDocToPlainText(request.description),
      // Los motivos de cada decisión: el archivo busca por su texto, que es lo
      // que se lee de un vistazo en una fila.
      richDocToPlainText(request.decisionNote),
      richDocToPlainText(request.issueNote),
      richDocToPlainText(request.returnNote),
      richDocToPlainText(request.cancelNote),
      richDocToPlainText(request.holdNote),
      request.decidedBy,
      request.archivedBy,
      lines,
    ],
  };
}
