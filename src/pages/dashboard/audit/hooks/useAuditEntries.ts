import { useState } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  AUDIT_ACTIONS,
  EMPTY_AUDIT_FILTERS,
  applyAuditPreset,
  auditActionCount,
  auditCsvTable,
  auditFilterCount,
  auditPresetOf,
  auditQueryArgs,
  auditRange,
  summarizeAudit,
  type AuditFilters,
  type AuditPresetId,
} from "@/lib/audit";
import {
  groupByDate,
  matchesQuery,
  sortByDate,
  type DateSortId,
} from "@/lib/browse";
import { csvFilename, downloadCsv, toCsv } from "@/lib/export";
import { documentTrailLabel } from "@/lib/workshop";
import { useRowsThatFit } from "@/hooks/use-rows-that-fit";
import { useTablePagination } from "@/hooks/use-table-pagination";
import type { QueueSortId } from "../../QueueToolbar";
import type { AuditEntry, AuditQueryResult } from "../types";

/** Filtra entradas de auditoría por búsqueda de texto (referencia, título, actor, nombre, etiqueta). */
export function filterAuditEntries(
  entries: AuditEntry[],
  search: string,
): AuditEntry[] {
  return entries.filter((entry) =>
    matchesQuery(
      [
        entry.reference,
        entry.title,
        entry.by,
        entry.name,
        entry.previousName,
        documentTrailLabel(entry),
      ],
      search,
    ),
  );
}

/** Ordena entradas de auditoría por fecha (más reciente o más antiguo). */
export function sortAuditEntries(
  entries: AuditEntry[],
  sort: QueueSortId,
): AuditEntry[] {
  const direction: DateSortId = sort === "oldest" ? "oldest" : "recent";
  return sortByDate(entries, (entry) => entry.at, direction);
}

/** Hook que gestiona el rastro documental, filtros, ordenación, paginación y exportación CSV. */
export function useAuditEntries() {
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<QueueSortId>("recent");
  const [compact, setCompact] = useState(false);

  const audit = useQuery(
    api.incidents.documentAudit,
    auditQueryArgs(filters),
  ) as AuditQueryResult | undefined;

  const rango = auditRange(filters);
  const activePreset = auditPresetOf(rango);
  const filterCount = auditFilterCount(filters);
  const entries: AuditEntry[] = audit?.entries ?? [];

  const applyFilters = (
    next: AuditFilters | ((current: AuditFilters) => AuditFilters),
  ) => {
    setFilters(next);
  };

  const handleApplyPreset = (presetId: Exclude<AuditPresetId, "custom">) => {
    setFilters((current) => applyAuditPreset(current, presetId));
  };

  const resetFilters = () => {
    setFilters(EMPTY_AUDIT_FILTERS);
    setSearch("");
  };

  const searched = filterAuditEntries(entries, search);
  const sorted = sortAuditEntries(searched, sort);

  const { areaRef, rowsFit } = useRowsThatFit({
    shape: "cards",
    remeasureKey: compact,
  });

  const listKey = `${search}|${sort}|${filters.userId ?? ""}|${filters.from}|${filters.to}|${filters.action}`;
  const paging = useTablePagination({
    total: sorted.length,
    rowsFit,
    resetKey: listKey,
  });

  const visible = sorted.slice(paging.from - 1, paging.to);
  const groups = groupByDate(visible, (entry) => entry.at);
  const summary = summarizeAudit(searched);
  const breakdown = AUDIT_ACTIONS.filter(
    (action) => summary.byAction[action.id] > 0,
  ).map((action) => auditActionCount(action.id, summary.byAction[action.id]));

  const handleExport = () => {
    const { header, rows } = auditCsvTable(sorted);
    downloadCsv(csvFilename("auditoria"), toCsv(header, rows));
    toast.success(`Auditoría exportada: ${rows.length} movimientos`);
  };

  return {
    filters,
    search,
    sort,
    compact,
    setSearch,
    setSort,
    setCompact,
    applyFilters,
    handleApplyPreset,
    resetFilters,
    handleExport,
    audit,
    rango,
    activePreset,
    filterCount,
    searched,
    sorted,
    visible,
    groups,
    summary,
    breakdown,
    paging,
    areaRef,
    listKey,
  };
}
