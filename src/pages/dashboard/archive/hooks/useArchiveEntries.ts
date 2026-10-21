import { useMemo } from "react";
import { matchesQuery, sortByDate } from "@/lib/browse";
import { normalizeIncidentReference } from "@/lib/workshop";
import type { QueueSortId } from "../../QueueToolbar";
import {
  incidentToArchiveEntry,
  requestToArchiveEntry,
} from "../helpers/archiveMappers";
import type {
  ArchiveEntry,
  ArchiveKind,
  IncidentDoc,
  RequestDoc,
} from "../types";

export interface UseArchiveEntriesOptions {
  incidents: IncidentDoc[];
  requests: RequestDoc[];
  search: string;
  kind: ArchiveKind;
  sort: QueueSortId;
}

export function useArchiveEntries({
  incidents,
  requests,
  search,
  kind,
  sort,
}: UseArchiveEntriesOptions) {
  // 1. Unificación y normalización de entradas memoizada
  const allEntries = useMemo<ArchiveEntry[]>(() => {
    return [
      ...incidents.map(incidentToArchiveEntry),
      ...requests.map(requestToArchiveEntry),
    ];
  }, [incidents, requests]);

  // 2. Búsqueda y normalización de referencia memoizada
  const matched = useMemo(() => {
    const trimmed = search.trim();
    if (!trimmed) return allEntries;

    const normalizedRef = normalizeIncidentReference(trimmed);

    return allEntries.filter(
      (entry) =>
        matchesQuery(entry.fields, trimmed) ||
        (entry.kind === "incident" && entry.reference === normalizedRef),
    );
  }, [allEntries, search]);

  // 3. Conteo de incidencias y peticiones según los resultados encontrados
  const counts = useMemo<Record<ArchiveKind, number>>(
    () => ({
      all: matched.length,
      incident: matched.filter((entry) => entry.kind === "incident").length,
      request: matched.filter((entry) => entry.kind === "request").length,
    }),
    [matched],
  );

  // 4. Filtrado por tipo activo y ordenación temporal
  const ordered = useMemo(() => {
    const filtered =
      kind === "all" ? matched : matched.filter((entry) => entry.kind === kind);

    return sortByDate(
      filtered,
      (entry) => entry.date,
      sort === "oldest" ? "oldest" : "recent",
    );
  }, [matched, kind, sort]);

  return {
    allEntries,
    matched,
    ordered,
    counts,
    hasMatches: matched.length > 0,
    isEmpty: allEntries.length === 0,
  };
}
