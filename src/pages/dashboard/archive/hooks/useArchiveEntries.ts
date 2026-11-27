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
  fromMs?: number;
  toMs?: number;
}

export function useArchiveEntries({
  incidents,
  requests,
  search,
  kind,
  sort,
  fromMs,
  toMs,
}: UseArchiveEntriesOptions) {
  // 1. Unificación y normalización de entradas memoizada
  const allEntries = useMemo<ArchiveEntry[]>(() => {
    return [
      ...incidents.map(incidentToArchiveEntry),
      ...requests.map(requestToArchiveEntry),
    ];
  }, [incidents, requests]);

  // 2. Búsqueda, normalización de referencia y filtro por fecha memoizados
  const matched = useMemo(() => {
    const trimmed = search.trim();
    const normalizedRef = trimmed ? normalizeIncidentReference(trimmed) : "";

    return allEntries.filter((entry) => {
      if (trimmed) {
        const textOk =
          matchesQuery(entry.fields, trimmed) ||
          (entry.kind === "incident" && entry.reference === normalizedRef);
        if (!textOk) return false;
      }
      if (fromMs !== undefined && entry.date < fromMs) return false;
      if (toMs !== undefined && entry.date > toMs) return false;
      return true;
    });
  }, [allEntries, search, fromMs, toMs]);

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
