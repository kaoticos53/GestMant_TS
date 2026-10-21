import { useEffect, useState, type ReactNode } from "react";
import { LayoutList, RotateCcw, Rows3, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Density } from "@/lib/density";
import { cn } from "@/lib/utils";

export interface DataTableToolbarProps {
  /** Valor de la búsqueda de texto */
  search: string;
  /** Callback al cambiar la búsqueda */
  onSearchChange: (value: string) => void;
  /** Texto de placeholder en el campo de búsqueda */
  searchPlaceholder?: string;
  /** Etiqueta accesible para lectores de pantalla */
  searchAriaLabel?: string;
  /**
   * Milisegundos para retrasar la emisión de `onSearchChange` al teclear.
   * Si es 0 o no se define, se emite de forma inmediata.
   */
  debounceMs?: number;
  /** Filtros facetados, selectores de estado, categoría o etiquetas */
  filters?: ReactNode;
  /** Indica si hay filtros o búsquedas activas */
  hasActiveFilters?: boolean;
  /** Callback para limpiar filtros y búsqueda */
  onResetFilters?: () => void;
  /** Texto del botón de reset */
  resetFiltersLabel?: string;
  /** Densidad actual ('comfortable' o 'compact') */
  density?: Density;
  /** Callback para cambiar la densidad */
  onDensityChange?: (density: Density) => void;
  /** Modo compacto booleano alternativo */
  compact?: boolean;
  /** Callback booleano alternativo para compact */
  onCompactChange?: (compact: boolean) => void;
  /** Etiqueta accesible del selector de densidad */
  densityAriaLabel?: string;
  /** Botones de acción principales (ej: "Exportar CSV", "Nuevo equipo") */
  actions?: ReactNode;
  /** Clases CSS adicionales para el contenedor principal */
  className?: string;
}

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
  // Manejo de debounce local si debounceMs > 0
  const [localSearch, setLocalSearch] = useState(search);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  useEffect(() => {
    if (debounceMs <= 0) return;
    if (localSearch === search) return;

    const timer = setTimeout(() => {
      onSearchChange(localSearch);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [localSearch, debounceMs, onSearchChange, search]);

  const handleSearchInput = (value: string) => {
    if (debounceMs > 0) {
      setLocalSearch(value);
    } else {
      setLocalSearch(value);
      onSearchChange(value);
    }
  };

  const handleClearSearch = () => {
    setLocalSearch("");
    onSearchChange("");
  };

  // Normalización del estado de densidad
  const isCompact =
    compact !== undefined
      ? compact
      : density !== undefined
        ? density === "compact"
        : undefined;

  const handleToggleDensity = (makeCompact: boolean) => {
    if (onCompactChange) {
      onCompactChange(makeCompact);
    }
    if (onDensityChange) {
      onDensityChange(makeCompact ? "compact" : "comfortable");
    }
  };

  const showDensity = isCompact !== undefined && (Boolean(onCompactChange) || Boolean(onDensityChange));

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border/70 p-4 lg:flex-row lg:items-center lg:justify-between",
        className,
      )}
    >
      {/* Zona izquierda: Buscador + Filtros facetados + Reset */}
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[14rem] flex-1 sm:max-w-md">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={localSearch}
            onChange={(event) => handleSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && debounceMs > 0) {
                onSearchChange(localSearch);
              }
            }}
            placeholder={searchPlaceholder}
            aria-label={searchAriaLabel}
            className="pl-9 pr-9"
          />
          {localSearch !== "" && (
            <button
              type="button"
              onClick={handleClearSearch}
              aria-label="Limpiar búsqueda"
              title="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {filters}

        {hasActiveFilters && onResetFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="h-9 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            title={resetFiltersLabel}
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {resetFiltersLabel}
          </Button>
        )}
      </div>

      {/* Zona derecha: Densidad + Acciones principales */}
      <div className="flex flex-wrap items-center gap-2">
        {showDensity && (
          <div
            role="group"
            aria-label={densityAriaLabel}
            className="inline-flex items-center rounded-md border border-border/70 bg-card p-0.5 shadow-xs"
          >
            {(
              [
                { id: "comfortable", label: "Cómoda", icon: LayoutList, compactValue: false },
                { id: "compact", label: "Compacta", icon: Rows3, compactValue: true },
              ] as const
            ).map((option) => {
              const active = isCompact === option.compactValue;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleToggleDensity(option.compactValue)}
                  title={
                    option.compactValue
                      ? "Fichas o filas más compactas"
                      : "Fichas o filas cómodas con espaciado amplio"
                  }
                  className={cn(
                    "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <option.icon className="size-3.5" aria-hidden="true" />
                  {option.label}
                </button>
              );
            })}
          </div>
        )}

        {actions}
      </div>
    </div>
  );
}
