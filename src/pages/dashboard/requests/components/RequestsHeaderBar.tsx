import { FileDown, Plus, UserCheck } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { equipmentLabel } from "@/lib/workshop";
import { FILTERS, type EquipmentDoc, type RequestFilterId } from "../types";

export function RequestsHeaderBar({
  filter,
  onFilterChange,
  counts,
  canFilterMine = false,
  mineOnly = false,
  onMineOnlyChange,
  mineCount = 0,
  canCreate = true,
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
  canFilterMine?: boolean;
  mineOnly?: boolean;
  onMineOnlyChange?: (value: boolean) => void;
  mineCount?: number;
  canCreate?: boolean;
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

        <SearchableSelect
          value={equipmentFilter}
          onValueChange={onEquipmentFilterChange}
          options={[
            { value: "all", label: "Todos los equipos" },
            ...equipment.map((item) => ({
              value: item._id,
              label: equipmentLabel(item),
              keywords: `${item.code ?? ""} ${item.brand ?? ""} ${item.serialNumber ?? ""}`,
            })),
          ]}
          placeholder="Todos los equipos"
          searchPlaceholder="Buscar equipo…"
          emptyMessage="Ningún equipo coincide"
          ariaLabel="Filtrar peticiones por equipo"
          className="w-full sm:w-56"
        />

        {canFilterMine && onMineOnlyChange && (
          <Button
            type="button"
            variant={mineOnly ? "default" : "outline"}
            size="sm"
            aria-pressed={mineOnly}
            className="gap-1.5"
            onClick={() => onMineOnlyChange(!mineOnly)}
          >
            <UserCheck className="size-4" />
            Mis peticiones
            <span className="text-xs tabular-nums opacity-75">
              {mineCount}
            </span>
          </Button>
        )}
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
        {canCreate && (
          <Button
            type="button"
            className="gap-2"
            onClick={onNewRequest}
          >
            <Plus className="size-4" />
            Nueva petición
          </Button>
        )}
      </div>
    </div>
  );
}
