import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
        <Select
          value={estado}
          onValueChange={(value) =>
            onChangeEstado(value as EstadoEntregaFilter)
          }
        >
          <SelectTrigger
            className="mt-1 h-8 w-full text-xs"
            aria-label="Estado de entrega"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ESTADO_ENTREGA_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
