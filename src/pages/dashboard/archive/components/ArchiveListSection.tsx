import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListArea } from "@/components/ListArea";
import { TablePagination } from "@/components/TablePagination";
import { useRowsThatFit } from "@/hooks/use-rows-that-fit";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { groupByDate } from "@/lib/browse";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/workshop";
import { Archive, ArchiveRestore, Eye, SearchX } from "lucide-react";
import type { QueueSortId } from "../../QueueToolbar";
import { KIND_META, type ArchiveEntry, type ArchiveKind } from "../types";

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
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-sm">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
          {search !== "" ? (
            <SearchX className="size-5" />
          ) : (
            <Archive className="size-5" />
          )}
        </span>
        <p className="mt-4 text-base font-semibold tracking-tight">
          {search !== ""
            ? `Nada en el archivo coincide con «${search}»`
            : totalEntries === 0
              ? "El archivo está vacío"
              : "No hay fichas de ese tipo en el archivo"}
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
          {search !== ""
            ? "Prueba con otra referencia, otro equipo o el nombre de quien la notificó, o limpia la búsqueda."
            : totalEntries === 0
              ? "Aquí van las incidencias cerradas y las peticiones ya decididas cuando dejan de ser del día a día. Se archivan desde arriba o desde la ficha de cada una."
              : "Cambia el filtro para ver el resto del archivo."}
        </p>
        {search !== "" && (
          <Button
            type="button"
            variant="outline"
            className="mt-5"
            onClick={onClearSearch}
          >
            Limpiar la búsqueda
          </Button>
        )}
      </div>
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
            <section key={section.key} className="flex flex-col gap-3">
              <h2
                data-row-header
                className="flex items-center justify-between gap-2 rounded-md bg-background/85 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm lg:sticky lg:top-0 lg:z-10"
              >
                {section.label}
                <span className="tabular-nums opacity-70">
                  {section.items.length}
                </span>
              </h2>
              <div className={compact ? "grid gap-2" : "grid gap-3"}>
                {section.items.map((entry) => {
                  const kindMeta = KIND_META[entry.kind];
                  const canRestore =
                    entry.kind === "incident"
                      ? canArchiveIncidents
                      : canArchiveRequests;
                  return (
                    <article
                      key={`${entry.kind}-${entry.id}`}
                      data-row
                      className={cn(
                        "flex flex-wrap items-start gap-3 rounded-xl border border-border/70 bg-card shadow-sm transition-colors hover:border-signal/30",
                        compact ? "p-3" : "p-4",
                      )}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <kindMeta.icon className="size-4" />
                      </span>

                      <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-muted-foreground">
                            {entry.reference}
                          </span>
                          <Badge
                            variant="outline"
                            className={entry.statusClassName}
                          >
                            {entry.statusLabel}
                          </Badge>
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {kindMeta.label}
                          </span>
                        </div>
                        <p className="text-sm font-medium leading-5">
                          {entry.title}
                        </p>
                        {!compact && entry.subtitle !== "" && (
                          <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {entry.subtitle}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Archivada el {formatDateTime(entry.date)}
                          {entry.archivedBy ? ` por ${entry.archivedBy}` : ""}
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-2"
                        onClick={() =>
                          onOpenEntry({ kind: entry.kind, id: entry.id })
                        }
                      >
                        <Eye className="size-4" />
                        Ver ficha
                      </Button>
                      {canRestore && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          disabled={busyId === entry.id}
                          onClick={() => void onRestore(entry)}
                        >
                          <ArchiveRestore className="size-4" />
                          Recuperar
                        </Button>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
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
