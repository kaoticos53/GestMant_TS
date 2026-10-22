import { FileDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { equipmentLabel } from "@/lib/workshop";
import { FILTERS, type EquipmentDoc, type RequestFilterId } from "../types";

export function RequestsHeaderBar({
  filter,
  onFilterChange,
  counts,
  equipmentFilter,
  onEquipmentFilterChange,
  equipment,
  filteredCount,
  onExport,
  onNewRequest,
}: {
  filter: RequestFilterId;
  onFilterChange: (filter: RequestFilterId) => void;
  counts: Record<RequestFilterId, number>;
  equipmentFilter: string;
  onEquipmentFilterChange: (value: string) => void;
  equipment: EquipmentDoc[];
  filteredCount: number;
  onExport: () => void;
  onNewRequest: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        {/* Una sola línea de filtros, con su estado anunciado */}
        <div
          role="group"
          aria-label="Filtrar peticiones por estado"
          className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5 rounded-lg border border-border/70 bg-card p-1 shadow-sm max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden"
        >
          {FILTERS.map((option) => (
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

        <Select
          value={equipmentFilter}
          onValueChange={onEquipmentFilterChange}
        >
          <SelectTrigger
            className="w-full sm:w-56"
            aria-label="Filtrar peticiones por equipo"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los equipos</SelectItem>
            {equipment.map((item) => (
              <SelectItem key={item._id} value={item._id}>
                {equipmentLabel(item)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={onExport}
          disabled={filteredCount === 0}
          title="Descarga en CSV las peticiones que se ven filtradas"
        >
          <FileDown className="size-4" />
          Exportar CSV ({filteredCount})
        </Button>
        <Button
          type="button"
          className="gap-2"
          onClick={onNewRequest}
        >
          <Plus className="size-4" />
          Nueva petición
        </Button>
      </div>
    </div>
  );
}
