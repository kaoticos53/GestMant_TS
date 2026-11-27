import { useMemo, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { groupByDate, sortByDate } from "@/lib/browse";
import { countIncidentsByStatus } from "@/lib/incidentFlow";
import { richDocToPlainText } from "@/lib/richDoc";
import {
  incidentPriorityRank,
  liveNotes,
  matchesIncidentQuery,
  type IncidentStatus,
} from "@/lib/workshop";
import { useRowsThatFit } from "@/hooks/use-rows-that-fit";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { initialQueueDensity, writeDensity, type Density } from "@/lib/density";
import { safeLocalStorage } from "@/lib/sidebar";
import type { QueueSortId } from "../../QueueToolbar";
import { STATUS_RANK, type IncidentDoc } from "../types";

/** Todo lo que identifica una incidencia para el buscador. */
export function searchableFields(
  incident: IncidentDoc,
): (string | undefined)[] {
  return [
    incident.reference,
    incident.equipmentKind,
    incident.model,
    incident.serialNumber,
    richDocToPlainText(incident.description),
    incident.location,
    incident.reporterName,
    incident.reporterRole,
    incident.assigneeName,
    incident.workshopAssigneeName,
    incident.externalRepair?.companyName,
    incident.externalRepair?.contactName,
    incident.externalRepair?.deliveryNoteNumber,
    ...(incident.documents?.map((d) => d.name) ?? []),
    ...liveNotes(incident.lifecycleNotes).map((n) =>
      richDocToPlainText(n.note),
    ),
  ];
}

function inQueueOrder(items: IncidentDoc[]): IncidentDoc[] {
  return [...items].sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      b.reportedAt - a.reportedAt,
  );
}

export function useIncidentFilters({
  incidents,
  initialDetailId = null,
  initialFilter = "all",
}: {
  incidents: IncidentDoc[];
  initialDetailId?: Id<"incidents"> | null;
  initialFilter?: IncidentStatus | "all";
}) {
  const [filter, setFilter] = useState<IncidentStatus | "all">(initialFilter);
  const [detailId, setDetailId] = useState<Id<"incidents"> | null>(
    initialDetailId ?? null,
  );
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<QueueSortId>("recent");
  // La vista de la cola (cómoda o compacta) se recuerda entre visitas: es una
  // preferencia de quien trabaja, no del módulo. Abre en compacta, que es donde
  // caben más casos por pantalla.
  const [density, setDensity] = useState<Density>(() =>
    initialQueueDensity(safeLocalStorage()),
  );
  const compact = density === "compact";
  const setCompact = (value: boolean) => {
    const next: Density = value ? "compact" : "comfortable";
    setDensity(next);
    writeDensity(safeLocalStorage(), next);
  };

  const searchableIndex = useMemo(
    () =>
      incidents.map((incident) => ({
        incident,
        fields: searchableFields(incident),
      })),
    [incidents],
  );

  const matched = useMemo(
    () =>
      searchableIndex
        .filter(({ incident, fields }) =>
          matchesIncidentQuery(fields, incident.reference, search),
        )
        .map(({ incident }) => incident),
    [searchableIndex, search],
  );

  const filtered = useMemo(
    () =>
      filter === "all"
        ? matched
        : matched.filter((item) => item.status === filter),
    [matched, filter],
  );

  const counts = useMemo(() => countIncidentsByStatus(matched), [matched]);

  const byDate = sort === "recent" || sort === "oldest";
  const byUpdatedDate = sort === "updatedRecent" || sort === "updatedOldest";
  const ordered = useMemo(
    () =>
      byDate
        ? sortByDate(filtered, (incident) => incident.reportedAt, sort)
        : byUpdatedDate
          ? sortByDate(
              filtered,
              (incident) => incident.updatedAt,
              sort === "updatedRecent" ? "recent" : "oldest",
            )
          : sort === "priority"
            ? [...filtered].sort(
                (a, b) =>
                  incidentPriorityRank(b.priority) -
                    incidentPriorityRank(a.priority) ||
                  b.reportedAt - a.reportedAt,
              )
            : inQueueOrder(filtered),
    [byDate, byUpdatedDate, filtered, sort],
  );

  const { areaRef, rowsFit } = useRowsThatFit({
    shape: "cards",
    remeasureKey: compact,
  });

  const paging = useTablePagination({
    total: ordered.length,
    rowsFit,
    resetKey: `${search}|${sort}|${filter}`,
  });

  const visible = useMemo(
    () => ordered.slice(paging.from - 1, paging.to),
    [ordered, paging.from, paging.to],
  );
  const sections = useMemo(
    () =>
      byDate
        ? groupByDate(visible, (incident) => incident.reportedAt)
        : byUpdatedDate
          ? groupByDate(visible, (incident) => incident.updatedAt)
          : [{ key: "queue", label: "", items: visible }],
    [byDate, byUpdatedDate, visible],
  );

  const detail = useMemo(
    () =>
      detailId ? (incidents.find((item) => item._id === detailId) ?? null) : null,
    [detailId, incidents],
  );

  return {
    filter,
    setFilter,
    detailId,
    setDetailId,
    search,
    setSearch,
    sort,
    setSort,
    compact,
    setCompact,
    counts,
    ordered,
    paging,
    areaRef,
    sections,
    detail,
  };
}
