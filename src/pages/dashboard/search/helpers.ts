import { Archive, Boxes, ClipboardList, Cpu, Siren } from "lucide-react";
import { richDocToPlainText } from "@/lib/richDoc";
import {
  INCIDENT_STATUS_META,
  STATUS_META,
  equipmentLabel,
  looksLikeIncidentReference,
  normalizeIncidentReference,
} from "@/lib/workshop";
import type {
  FilterSearchGroupsParams,
  SearchGroup,
  SearchHit,
} from "./types";

export const MAX_PER_GROUP = 5;

/** Minúsculas sin acentos para comparar («estación» encuentra "Estacion"). */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function includesQuery(haystack: string, query: string): boolean {
  return normalize(haystack).includes(query);
}

/**
 * Filtra y agrupa los resultados de búsqueda global por categoría.
 * Las incidencias y peticiones archivadas se agrupan en su propio bloque
 * «archive» para indicar que se abren en solo lectura desde el archivo.
 */
export function filterSearchGroups({
  query,
  incidents,
  requests,
  parts,
  equipment,
  canSearchCatalog,
}: FilterSearchGroupsParams): SearchGroup[] {
  const q = normalize(query.trim());
  if (!q) return [];

  const requestHits: Extract<SearchHit, { kind: "request" }>[] = requests
    .filter((request) =>
      [
        request.reference,
        request.requesterName,
        request.requesterTeam ?? "",
        request.equipment ?? "",
        richDocToPlainText(request.description),
        (request.lines ?? []).map((line) => `${line.code} ${line.name}`).join(" "),
      ].some((value) => includesQuery(value, q)),
    )
    .slice(0, MAX_PER_GROUP)
    .map((request) => ({
      kind: "request" as const,
      id: request._id,
      title: request.reference,
      subtitle: `${STATUS_META[request.status]?.label ?? STATUS_META.pending.label} · ${request.requesterName}${
        request.equipment ? ` · ${request.equipment}` : ""
      }`,
      archived: request.archivedAt !== undefined,
    }));

  const reference = looksLikeIncidentReference(query.trim())
    ? normalizeIncidentReference(query.trim())
    : null;

  const incidentHits: Extract<SearchHit, { kind: "incident" }>[] = incidents
    .filter(
      (incident) =>
        (reference !== null && incident.reference === reference) ||
        [
          incident.reference,
          incident.equipmentKind ?? "",
          incident.model ?? "",
          incident.serialNumber ?? "",
          incident.location ?? "",
          incident.reporterName,
          richDocToPlainText(incident.description),
        ].some((value) => includesQuery(value, q)),
    )
    .slice(0, MAX_PER_GROUP)
    .map((incident) => ({
      kind: "incident" as const,
      id: incident._id,
      title: incident.reference,
      subtitle: [
        INCIDENT_STATUS_META[incident.status]?.label,
        [incident.equipmentKind, incident.model].filter(Boolean).join(" "),
        incident.location,
      ]
        .filter(Boolean)
        .join(" · "),
      archived: incident.archivedAt !== undefined,
    }));

  const archivedHits: SearchHit[] = [...incidentHits, ...requestHits].filter(
    (hit) => hit.archived,
  );

  const result: SearchGroup[] = [
    {
      kind: "incident",
      label: "Incidencias",
      icon: Siren,
      hits: incidentHits.filter((hit) => !hit.archived),
    },
    {
      kind: "request",
      label: "Peticiones",
      icon: ClipboardList,
      hits: requestHits.filter((hit) => !hit.archived),
    },
    {
      kind: "archive",
      label: "Archivo · solo lectura",
      icon: Archive,
      hits: archivedHits,
    },
  ];

  if (canSearchCatalog) {
    const partHits: SearchHit[] = parts
      .filter((part) =>
        [
          part.code,
          part.name,
          richDocToPlainText(part.description),
          part.category,
          part.partNumber ?? "",
          part.supplier ?? "",
          part.location ?? "",
        ].some((value) => includesQuery(value, q)),
      )
      .slice(0, MAX_PER_GROUP)
      .map((part) => ({
        kind: "part",
        id: part._id,
        term: part.code,
        title: `${part.code} · ${part.name}`,
        subtitle: `${part.category} · stock ${part.stock}${
          part.location ? ` · ${part.location}` : ""
        }`,
      }));

    const equipmentHits: SearchHit[] = equipment
      .filter((item) =>
        [
          item.code ?? "",
          item.brand ?? "",
          item.name,
          item.model,
          item.location ?? "",
          item.serialNumber ?? "",
          item.supplier ?? "",
        ].some((value) => includesQuery(value, q)),
      )
      .slice(0, MAX_PER_GROUP)
      .map((item) => ({
        kind: "equipment",
        id: item._id,
        term: item.code ?? item.model,
        title: equipmentLabel(item),
        subtitle: [item.code, item.serialNumber, item.location]
          .filter(Boolean)
          .join(" · "),
      }));

    result.push(
      { kind: "part", label: "Repuestos", icon: Boxes, hits: partHits },
      { kind: "equipment", label: "Equipos", icon: Cpu, hits: equipmentHits },
    );
  }

  return result.filter((group) => group.hits.length > 0);
}
