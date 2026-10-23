import { ListArea } from "@/components/ListArea";
import { TablePagination } from "@/components/TablePagination";
import { useRowsThatFit } from "@/hooks/use-rows-that-fit";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { groupByDate } from "@/lib/browse";
import type { QueueSortId } from "../../QueueToolbar";
import type { ArchiveEntry, ArchiveKind } from "../types";
import { ArchiveDateSection, ArchiveEmptyState } from "./list";

export interface ArchiveListSectionProps {
  search: string;
  onClearSearch: () => void;
  totalEntries: number;
  filteredEntries: ArchiveEntry[];
  sort: QueueSortId;
  kind: ArchiveKind;
  compact: boolean;
  canArchiveIncidents: boolean;
  canArchiveRequests: boolean;
  busyId: string | null;
  onOpenEntry: (entry: { kind: "incident" | "request"; id: string }) => void;
  onRestore: (entry: ArchiveEntry) => Promise<void>;
}

export function ArchiveListSection({
  search,
  onClearSearch,
  totalEntries,
  filteredEntries,
  sort,
  kind,
  compact,
  canArchiveIncidents,
  canArchiveRequests,
  busyId,
  onOpenEntry,
  onRestore,
}: ArchiveListSectionProps) {
  const { areaRef, rowsFit } = useRowsThatFit({
    shape: "cards",
    remeasureKey: compact,
  });

  const paging = useTablePagination({
    total: filteredEntries.length,
    rowsFit,
    resetKey: `${search}|${sort}|${kind}`,
  });

  const visible = filteredEntries.slice(paging.from - 1, paging.to);
  const sections = groupByDate(visible, (entry) => entry.date);

  if (filteredEntries.length === 0) {
    return (
      <ArchiveEmptyState
        search={search}
        totalEntries={totalEntries}
        onClearSearch={onClearSearch}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <ListArea
        ref={areaRef}
        resetKey={`${search}|${sort}|${kind}|${paging.page}`}
      >
        <div className="flex flex-col gap-5">
          {sections.map((section) => (
            <ArchiveDateSection
              key={section.key}
              section={section}
              compact={compact}
              canArchiveIncidents={canArchiveIncidents}
              canArchiveRequests={canArchiveRequests}
              busyId={busyId}
              onOpenEntry={onOpenEntry}
              onRestore={onRestore}
            />
          ))}
        </div>
      </ListArea>

      <TablePagination
        paging={paging}
        singular="ficha archivada"
        plural="fichas archivadas"
        className="rounded-xl border border-border/70 bg-card shadow-sm"
      />
    </div>
  );
}
