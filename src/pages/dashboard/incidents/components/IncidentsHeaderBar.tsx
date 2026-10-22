import { Link } from "react-router";
import { FileDown, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { INCIDENT_FILTERS } from "@/lib/workshop";
import type { IncidentFilterId } from "../types";

export function IncidentsHeaderBar({
  filter,
  onFilterChange,
  counts,
  onOpenReports,
}: {
  filter: IncidentFilterId;
  onFilterChange: (id: IncidentFilterId) => void;
  counts: Record<IncidentFilterId, number>;
  onOpenReports: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Los filtros en una sola línea: en pantallas estrechas se recorren en
          horizontal, y cada uno dice si está puesto (`aria-pressed`). */}
      <div
        role="group"
        aria-label="Filtrar incidencias por estado"
        className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5 rounded-lg border border-border/70 bg-card p-1 shadow-sm max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden"
      >
        {INCIDENT_FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={filter === option.id}
            onClick={() => onFilterChange(option.id)}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              filter === option.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
            <span className="ml-1.5 text-xs tabular-nums opacity-70">
              {counts[option.id]}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={onOpenReports}
          title="Descarga en un solo archivo el informe de las incidencias de un periodo"
        >
          <FileDown className="size-4" />
          Informes del periodo
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <Link to="/reportar" target="_blank">
            <Siren className="size-4" />
            Notificar incidencia
          </Link>
        </Button>
      </div>
    </div>
  );
}
