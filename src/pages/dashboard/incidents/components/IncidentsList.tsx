import { ListArea } from "@/components/ListArea";
import { TablePagination } from "@/components/TablePagination";
import type { useTablePagination } from "@/hooks/use-table-pagination";
import { IncidentCard } from "./IncidentCard";
import type { IncidentDoc, IncidentSection } from "../types";

export function IncidentsList({
  sections,
  compact,
  canAssign,
  archivingId,
  areaRef,
  resetKey,
  paging,
  onOpen,
  onArchive,
}: {
  sections: IncidentSection[];
  compact: boolean;
  canAssign: boolean;
  archivingId: string | null;
  areaRef: (element: HTMLDivElement | null) => void;
  resetKey: string;
  paging: ReturnType<typeof useTablePagination>;
  onOpen: (incident: IncidentDoc) => void;
  onArchive: (incident: IncidentDoc) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
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
                    archiving={archivingId === incident._id}
                    onOpen={() => onOpen(incident)}
                    onArchive={() => onArchive(incident)}
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
