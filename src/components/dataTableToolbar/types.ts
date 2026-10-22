import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { Density } from "@/lib/density";

export interface DensityOption {
  id: "comfortable" | "compact";
  label: string;
  icon: LucideIcon;
  compactValue: boolean;
  description: string;
}

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

export interface DataTableToolbarSearchProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  debounceMs?: number;
}

export interface DataTableToolbarResetProps {
  onResetFilters: () => void;
  resetFiltersLabel?: string;
}

export interface DataTableToolbarDensityProps {
  isCompact: boolean;
  densityAriaLabel?: string;
  onToggleDensity: (makeCompact: boolean) => void;
}
