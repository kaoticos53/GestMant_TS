import { Input } from "@/components/ui/input";
import { ESTADO_ENTREGA_OPTIONS, type EstadoEntregaFilter } from "./helpers";

export interface HistoryFieldFiltersProps {
  pedido?: string;
  solicitud?: string;
  descripcion?: string;
  estado?: EstadoEntregaFilter;
  onChangePedido: (pedido: string) => void;
  onChangeSolicitud: (solicitud: string) => void;
  onChangeDescripcion: (descripcion: string) => void;
  onChangeEstado: (estado: EstadoEntregaFilter) => void;
}

/**
 * Sección de filtros por atributos específicos de compras (pedido, solicitud, descripción, estado de entrega).
 */
export function HistoryFieldFilters({
  pedido = "",
  solicitud = "",
  descripcion = "",
  estado = "todos",
  onChangePedido,
  onChangeSolicitud,
  onChangeDescripcion,
  onChangeEstado,
}: HistoryFieldFiltersProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Nº Pedido:
        </label>
        <Input
          value={pedido}
          onChange={(e) => onChangePedido(e.target.value)}
          placeholder="Ej. OC-0001"
          className="mt-1 h-8 text-xs"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Nº Solicitud:
        </label>
        <Input
          value={solicitud}
          onChange={(e) => onChangeSolicitud(e.target.value)}
          placeholder="Ej. 10034573"
          className="mt-1 h-8 text-xs"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Descripción / Repuesto:
        </label>
        <Input
          value={descripcion}
          onChange={(e) => onChangeDescripcion(e.target.value)}
          placeholder="Nombre o código"
          className="mt-1 h-8 text-xs"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Estado de entrega:
        </label>
        <select
          value={estado}
          onChange={(e) => onChangeEstado(e.target.value as EstadoEntregaFilter)}
          className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {ESTADO_ENTREGA_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
