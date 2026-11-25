import { Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListArea } from "@/components/ListArea";
import { TablePagination } from "@/components/TablePagination";
import type { Id } from "@/convex/_generated/dataModel";
import type { useTablePagination } from "@/hooks/use-table-pagination";
import { RequestCard } from "./RequestCard";
import type { DecisionMode, RequestDoc, RequestSection } from "../types";

export function RequestsList({
  sections,
  compact,
  archivingId,
  selectedIds,
  bulkArchiving = false,
  areaRef,
  resetKey,
  paging,
  onOpen,
  onAssociate,
  onDecision,
  onArchive,
  onToggleSelect,
  onClearSelection,
  onBulkArchive,
}: {
  sections: RequestSection[];
  compact: boolean;
  archivingId: string | null;
  selectedIds?: Set<Id<"partRequests">>;
  bulkArchiving?: boolean;
  areaRef: (element: HTMLDivElement | null) => void;
  resetKey: string;
  paging: ReturnType<typeof useTablePagination>;
  onOpen: (request: RequestDoc) => void;
  onAssociate: (request: RequestDoc) => void;
  onDecision: (request: RequestDoc, mode: DecisionMode) => void;
  onArchive: (request: RequestDoc) => void;
  onToggleSelect?: (id: Id<"partRequests">) => void;
  onClearSelection?: () => void;
  onBulkArchive?: () => void;
}) {
  const selectedCount = selectedIds?.size ?? 0;

  return (
    <div className="flex flex-col gap-5">
      {selectedCount > 0 && onBulkArchive && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-signal/30 bg-signal/5 px-4 py-2.5 text-sm">
          <span className="font-medium tabular-nums">
            {selectedCount === 1
              ? "1 petición seleccionada"
              : `${selectedCount} peticiones seleccionadas`}
          </span>
          <div className="flex items-center gap-2">
            {onClearSelection && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
                disabled={bulkArchiving}
              >
                Limpiar selección
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={onBulkArchive}
              disabled={bulkArchiving}
            >
              <Archive className="size-3.5" />
              {bulkArchiving ? "Archivando…" : "Archivar seleccionadas"}
            </Button>
          </div>
        </div>
      )}

      <ListArea ref={areaRef} resetKey={resetKey}>
        <div className="flex flex-col gap-5">
          {sections.map((section) => (
            <section key={section.key} className="flex flex-col gap-3">
              {section.label !== "" && (
                <h2
                  data-row-header
                  className="flex items-center justify-between gap-2 rounded-md bg-background/85 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm lg:sticky lg:top-0 lg:z-10"
                >
                  {section.label}
                  <span className="tabular-nums opacity-70">
                    {section.items.length}
                  </span>
                </h2>
              )}
              <div className={compact ? "grid gap-2" : "grid gap-4"}>
                {section.items.map((request) => (
                  <RequestCard
                    key={request._id}
                    request={request}
                    compact={compact}
                    selected={selectedIds?.has(request._id) ?? false}
                    onToggleSelect={
                      onToggleSelect
                        ? () => onToggleSelect(request._id)
                        : undefined
                    }
                    onOpen={() => onOpen(request)}
                    onAssociate={() => onAssociate(request)}
                    onApprove={() => onDecision(request, "approve")}
                    onReject={() => onDecision(request, "reject")}
                    onIssue={() => onDecision(request, "issue")}
                    onArchive={() => onArchive(request)}
                    archiving={archivingId === request._id}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </ListArea>

      <TablePagination
        paging={paging}
        singular="petición"
        plural="peticiones"
        className="rounded-xl border border-border/70 bg-card shadow-sm"
      />
    </div>
  );
}
