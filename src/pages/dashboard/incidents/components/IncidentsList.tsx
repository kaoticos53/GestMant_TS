import { Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListArea } from "@/components/ListArea";
import { TablePagination } from "@/components/TablePagination";
import type { Id } from "@/convex/_generated/dataModel";
import type { useTablePagination } from "@/hooks/use-table-pagination";
import { IncidentCard } from "./IncidentCard";
import type { IncidentDoc, IncidentSection } from "../types";

export function IncidentsList({
  sections,
  compact,
  canAssign,
  canSelfAssign = false,
  archivingId,
  selfAssigningId = null,
  selectedIds,
  bulkArchiving = false,
  areaRef,
  resetKey,
  paging,
  onOpen,
  onSelfAssign,
  onArchive,
  onToggleSelect,
  onClearSelection,
  onBulkArchive,
}: {
  sections: IncidentSection[];
  compact: boolean;
  canAssign: boolean;
  canSelfAssign?: boolean;
  archivingId: string | null;
  selfAssigningId?: string | null;
  selectedIds?: Set<Id<"incidents">>;
  bulkArchiving?: boolean;
  areaRef: (element: HTMLDivElement | null) => void;
  resetKey: string;
  paging: ReturnType<typeof useTablePagination>;
  onOpen: (incident: IncidentDoc) => void;
  onSelfAssign?: (incident: IncidentDoc) => void;
  onArchive: (incident: IncidentDoc) => void;
  onToggleSelect?: (id: Id<"incidents">) => void;
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
              ? "1 incidencia seleccionada"
              : `${selectedCount} incidencias seleccionadas`}
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

      {/* El alto de las fichas queda acotado a la pantalla, así que se
          recorren con la barra del propio listado y el rótulo del día se
          queda pegado arriba. El pie con la paginación va fuera: sigue a la
          vista sin tener que bajar hasta el final. */}
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
                {section.items.map((incident) => (
                  <IncidentCard
                    key={incident._id}
                    incident={incident}
                    compact={compact}
                    canAssign={canAssign}
                    canSelfAssign={canSelfAssign}
                    archiving={archivingId === incident._id}
                    selfAssigning={selfAssigningId === incident._id}
                    selected={selectedIds?.has(incident._id) ?? false}
                    onOpen={() => onOpen(incident)}
                    onSelfAssign={
                      onSelfAssign ? () => onSelfAssign(incident) : undefined
                    }
                    onArchive={() => onArchive(incident)}
                    onToggleSelect={
                      onToggleSelect
                        ? () => onToggleSelect(incident._id)
                        : undefined
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </ListArea>

      <TablePagination
        paging={paging}
        singular="incidencia"
        plural="incidencias"
        className="rounded-xl border border-border/70 bg-card shadow-sm"
      />
    </div>
  );
}
