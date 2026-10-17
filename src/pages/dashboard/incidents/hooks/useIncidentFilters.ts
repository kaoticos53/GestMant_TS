import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { groupByDate, sortByDate } from "@/lib/browse";
import { richDocToPlainText } from "@/lib/richDoc";
import {
  liveNotes,
  matchesIncidentQuery,
  type IncidentStatus,
} from "@/lib/workshop";
import { useRowsThatFit } from "@/hooks/use-rows-that-fit";
import { useTablePagination } from "@/hooks/use-table-pagination";
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
    ...(incident.documents?.map((d) => d.name) ?? []),
    ...liveNotes(incident.lifecycleNotes).map((n) =>
      richDocToPlainText(n.note),
    ),
  ];
}

export function useIncidentFilters({
  incidents,
  initialDetailId = null,
}: {
  incidents: IncidentDoc[];
  initialDetailId?: Id<"incidents"> | null;
}) {
  const [filter, setFilter] = useState<IncidentStatus | "all">("all");
  const [detailId, setDetailId] = useState<Id<"incidents"> | null>(
    initialDetailId ?? null,
  );
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<QueueSortId>("recent");
  const [compact, setCompact] = useState(false);

  const inQueueOrder = (items: IncidentDoc[]) =>
    [...items].sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        b.reportedAt - a.reportedAt,
    );

  const matched = incidents.filter((incident) =>
    matchesIncidentQuery(
      searchableFields(incident),
      incident.reference,
      search,
    ),
  );

  const filtered =
    filter === "all"
      ? matched
      : matched.filter((item) => item.status === filter);

  const counts: Record<IncidentStatus | "all", number> = {
    all: matched.length,
    reported: matched.filter((item) => item.status === "reported").length,
    assigned: matched.filter((item) => item.status === "assigned").length,
    workshop: matched.filter((item) => item.status === "workshop").length,
    waitingParts: matched.filter((item) => item.status === "waitingParts")
      .length,
    repairing: matched.filter((item) => item.status === "repairing").length,
    resolved: matched.filter((item) => item.status === "resolved").length,
    unresolved: matched.filter((item) => item.status === "unresolved").length,
  };

  const byDate = sort !== "queue";
  const ordered = byDate
    ? sortByDate(filtered, (incident) => incident.reportedAt, sort)
    : inQueueOrder(filtered);

  const { areaRef, rowsFit } = useRowsThatFit({
    shape: "cards",
    remeasureKey: compact,
  });

  const paging = useTablePagination({
    total: ordered.length,
    rowsFit,
    resetKey: `${search}|${sort}|${filter}`,
  });

  const visible = ordered.slice(paging.from - 1, paging.to);
  const sections = byDate
    ? groupByDate(visible, (incident) => incident.reportedAt)
    : [{ key: "queue", label: "", items: visible }];

  const detail = detailId
    ? (incidents.find((item) => item._id === detailId) ?? null)
    : null;

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
