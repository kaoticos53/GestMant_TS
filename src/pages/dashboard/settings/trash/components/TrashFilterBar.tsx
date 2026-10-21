import { cn } from "@/lib/utils";
import type { TrashFilter } from "../types";

interface TrashFilterBarProps {
  filter: TrashFilter;
  onFilterChange: (filter: TrashFilter) => void;
  totalItems: number;
  incidentsCount: number;
  requestsCount: number;
  storageCount: number;
  canManageIncidents?: boolean;
  canDecideRequests?: boolean;
}

/**
 * Barra de filtros por píldoras para alternar entre categorías de la papelera.
 */
export function TrashFilterBar({
  filter,
  onFilterChange,
  totalItems,
  incidentsCount,
  requestsCount,
  storageCount,
  canManageIncidents = true,
  canDecideRequests = true,
}: TrashFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 pb-3">
      <button
        type="button"
        onClick={() => onFilterChange("all")}
        className={cn(
          "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
          filter === "all"
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:text-foreground",
        )}
      >
        Todo
        <span className="ml-1 opacity-75 tabular-nums">({totalItems})</span>
      </button>

      {canManageIncidents && incidentsCount > 0 && (
        <button
          type="button"
          onClick={() => onFilterChange("incidents")}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            filter === "incidents"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          Incidencias
          <span className="ml-1 opacity-75 tabular-nums">
            ({incidentsCount})
          </span>
        </button>
      )}

      {canDecideRequests && requestsCount > 0 && (
        <button
          type="button"
          onClick={() => onFilterChange("requests")}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            filter === "requests"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          Peticiones
          <span className="ml-1 opacity-75 tabular-nums">
            ({requestsCount})
          </span>
        </button>
      )}

      {storageCount > 0 && (
        <button
          type="button"
          onClick={() => onFilterChange("storage")}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            filter === "storage"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          Archivos del almacén
          <span className="ml-1 opacity-75 tabular-nums">
            ({storageCount})
          </span>
        </button>
      )}
    </div>
  );
}
