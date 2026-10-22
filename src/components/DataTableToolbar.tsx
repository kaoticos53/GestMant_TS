import { cn } from "@/lib/utils";
import {
  DataTableToolbarDensity,
  DataTableToolbarReset,
  DataTableToolbarSearch,
  resolveIsCompact,
  shouldShowDensity,
  type DataTableToolbarProps,
} from "./dataTableToolbar/index";

export type { DataTableToolbarProps };

/**
 * Barra de control y filtrado estándar para tablas y listados.
 * Unifica buscador con limpieza rápida 'X', debounce opcional,
 * filtros facetados, botón de reset general, selector de densidad y acciones.
 */
export function DataTableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  searchAriaLabel = "Buscar",
  debounceMs = 0,
  filters,
  hasActiveFilters = false,
  onResetFilters,
  resetFiltersLabel = "Limpiar filtros",
  density,
  onDensityChange,
  compact,
  onCompactChange,
  densityAriaLabel = "Densidad de la tabla",
  actions,
  className,
}: DataTableToolbarProps) {
  const isCompact = resolveIsCompact(compact, density);
  const hasDensityCallback = Boolean(onCompactChange) || Boolean(onDensityChange);
  const showDensity = shouldShowDensity(isCompact, hasDensityCallback);

  const handleToggleDensity = (makeCompact: boolean) => {
    if (onCompactChange) {
      onCompactChange(makeCompact);
    }
    if (onDensityChange) {
      onDensityChange(makeCompact ? "compact" : "comfortable");
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border/70 p-4 lg:flex-row lg:items-center lg:justify-between",
        className,
      )}
    >
      {/* Zona izquierda: Buscador + Filtros facetados + Reset */}
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <DataTableToolbarSearch
          search={search}
          onSearchChange={onSearchChange}
          searchPlaceholder={searchPlaceholder}
          searchAriaLabel={searchAriaLabel}
          debounceMs={debounceMs}
        />

        {filters}

        {hasActiveFilters && onResetFilters && (
          <DataTableToolbarReset
            onResetFilters={onResetFilters}
            resetFiltersLabel={resetFiltersLabel}
          />
        )}
      </div>

      {/* Zona derecha: Densidad + Acciones principales */}
      <div className="flex flex-wrap items-center gap-2">
        {showDensity && isCompact !== undefined && (
          <DataTableToolbarDensity
            isCompact={isCompact}
            densityAriaLabel={densityAriaLabel}
            onToggleDensity={handleToggleDensity}
          />
        )}

        {actions}
      </div>
    </div>
  );
}
