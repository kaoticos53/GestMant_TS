import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
        <Select
          value={fechaTipo}
          onValueChange={(value) => onChangeFechaTipo(value as FechaTipoFilter)}
        >
          <SelectTrigger
            className="mt-1 h-8 w-full text-xs"
            aria-label="Filtrar fecha por"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FECHA_TIPO_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
