import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface HistoryFilterDrawerHeaderProps {
  filtrosActivosCount: number;
  onClearFilters: () => void;
}

/**
 * Cabecera del panel de filtros del histórico con contador de filtros activos y acción de restablecer.
 */
export function HistoryFilterDrawerHeader({
  filtrosActivosCount,
  onClearFilters,
}: HistoryFilterDrawerHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Filter className="size-3.5" />
        Filtros por campos específicos y fechas
      </span>
      {filtrosActivosCount > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-destructive hover:text-destructive"
          onClick={onClearFilters}
        >
          Restablecer todos
        </Button>
      )}
    </div>
  );
}
