import {
  DataTableToolbarDensity,
  DataTableToolbarSearch,
} from "@/components/dataTableToolbar/index";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DateSortId } from "@/lib/browse";

/** Órdenes de una cola: por fecha (creación o modificación), prioridad o el orden de trabajo. */
export type QueueSortId =
  | DateSortId
  | "updatedRecent"
  | "updatedOldest"
  | "queue"
  | "priority";

export interface QueueSortOption {
  id: QueueSortId;
  label: string;
}

/**
 * Barra común a las colas largas (incidencias, peticiones y archivo): buscador,
 * orden y vista compacta o cómoda. Comparte los subcomponentes de búsqueda y
 * densidad con `DataTableToolbar` para mantener consistencia visual y de teclado.
 */
export function QueueToolbar({
  search,
  onSearchChange,
  placeholder,
  sort,
  onSortChange,
  sortOptions,
  compact = false,
  onCompactChange,
  noun,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  placeholder: string;
  sort: QueueSortId;
  onSortChange: (value: QueueSortId) => void;
  sortOptions: QueueSortOption[];
  compact?: boolean;
  onCompactChange: (value: boolean) => void;
  /** Cómo se llama lo listado, en plural y minúscula («incidencias»). */
  noun: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-3 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DataTableToolbarSearch
          search={search}
          onSearchChange={onSearchChange}
          searchPlaceholder={placeholder}
          searchAriaLabel={placeholder}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={sort}
            onValueChange={(value) => onSortChange(value as QueueSortId)}
          >
            <SelectTrigger
              className="w-full sm:w-60"
              aria-label={`Ordenar ${noun}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DataTableToolbarDensity
            isCompact={compact}
            densityAriaLabel={`Vista de ${noun}`}
            onToggleDensity={onCompactChange}
          />
        </div>
      </div>
    </div>
  );
}
