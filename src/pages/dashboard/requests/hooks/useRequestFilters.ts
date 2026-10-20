import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { groupByDate, matchesQuery, sortByDate } from "@/lib/browse";
import { requestMatchesEquipment } from "@/lib/workshop";
import { useRowsThatFit } from "@/hooks/use-rows-that-fit";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { initialQueueDensity, writeDensity, type Density } from "@/lib/density";
import { safeLocalStorage } from "@/lib/sidebar";
import type { QueueSortId } from "../../QueueToolbar";
import type { EquipmentDoc, RequestDoc, RequestFilterId } from "../types";
import { countByStatus, inQueueOrder, searchableFields } from "../helpers";

export function useRequestFilters({
  requests,
  equipment,
  equipmentFilter = "all",
  initialFilter = "all",
  initialDetailId = null,
}: {
  requests: RequestDoc[];
  equipment: EquipmentDoc[];
  equipmentFilter?: string;
  initialFilter?: RequestFilterId;
  initialDetailId?: Id<"partRequests"> | null;
}) {
  const [filter, setFilter] = useState<RequestFilterId>(initialFilter);
  const [detailId, setDetailId] = useState<Id<"partRequests"> | null>(
    initialDetailId ?? null,
  );
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<QueueSortId>("recent");
  // Misma preferencia que la cola de incidencias: la vista se recuerda y abre en
  // compacta, que es la que deja más peticiones a la vista.
  const [density, setDensity] = useState<Density>(() =>
    initialQueueDensity(safeLocalStorage()),
  );
  const compact = density === "compact";
  const setCompact = (value: boolean) => {
    const next: Density = value ? "compact" : "comfortable";
    setDensity(next);
    writeDensity(safeLocalStorage(), next);
  };

  const filterEquipment = equipment.find(
    (item) => item._id === equipmentFilter,
  );
  const byEquipment = requests.filter((request) =>
    requestMatchesEquipment(request, filterEquipment),
  );
  const matched = byEquipment.filter((request) =>
    matchesQuery(searchableFields(request), search),
  );
  const filtered =
    filter === "all"
      ? matched
      : matched.filter((request) => request.status === filter);

  const byDate = sort !== "queue";
  const ordered = byDate
    ? sortByDate(filtered, (request) => request.createdAt, sort)
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
    ? groupByDate(visible, (request) => request.createdAt)
    : [{ key: "queue", label: "", items: visible }];

  const counts = countByStatus(matched);
  const emptyByEquipment = Boolean(filterEquipment) && byEquipment.length === 0;
  const detailRequest = detailId
    ? (requests.find((request) => request._id === detailId) ?? null)
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
    filterEquipment,
    byEquipment,
    matched,
    filtered,
    ordered,
    paging,
    areaRef,
    sections,
    counts,
    emptyByEquipment,
    detailRequest,
  };
}
