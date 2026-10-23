import { Input } from "@/components/ui/input";
import { FECHA_TIPO_OPTIONS, type FechaTipoFilter } from "./helpers";

export interface HistoryDateFiltersProps {
  fechaTipo?: FechaTipoFilter;
  fechaDesde?: string;
  fechaHasta?: string;
  onChangeFechaTipo: (tipo: FechaTipoFilter) => void;
  onChangeFechaDesde: (desde: string) => void;
  onChangeFechaHasta: (hasta: string) => void;
}

/**
 * Sección de filtros por rango de fechas (desde, hasta) y criterio temporal (pedido, recepción, ambas).
 */
export function HistoryDateFilters({
  fechaTipo = "pedido",
  fechaDesde = "",
  fechaHasta = "",
  onChangeFechaTipo,
  onChangeFechaDesde,
  onChangeFechaHasta,
}: HistoryDateFiltersProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Filtrar fecha por:
        </label>
        <select
          value={fechaTipo}
          onChange={(e) => onChangeFechaTipo(e.target.value as FechaTipoFilter)}
          className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {FECHA_TIPO_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Fecha Desde:
        </label>
        <Input
          type="date"
          value={fechaDesde}
          onChange={(e) => onChangeFechaDesde(e.target.value)}
          className="mt-1 h-8 text-xs"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Fecha Hasta:
        </label>
        <Input
          type="date"
          value={fechaHasta}
          onChange={(e) => onChangeFechaHasta(e.target.value)}
          className="mt-1 h-8 text-xs"
        />
      </div>
    </div>
  );
}
