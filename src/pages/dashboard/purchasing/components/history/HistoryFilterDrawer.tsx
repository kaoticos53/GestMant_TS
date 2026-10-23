import type { PurchaseHistoryFilters } from "@/lib/purchasing";
import {
  HistoryDateFilters,
  HistoryFieldFilters,
  HistoryFilterDrawerHeader,
  type EstadoEntregaFilter,
  type FechaTipoFilter,
} from "./drawer";

export interface HistoryFilterDrawerProps {
  open: boolean;
  filters: PurchaseHistoryFilters;
  setFilters: React.Dispatch<React.SetStateAction<PurchaseHistoryFilters>>;
  filtrosActivosCount: number;
  onClearFilters: () => void;
}

/**
 * Panel desplegable de filtros avanzados y por fecha para el histórico de compras.
 */
export function HistoryFilterDrawer({
  open,
  filters,
  setFilters,
  filtrosActivosCount,
  onClearFilters,
}: HistoryFilterDrawerProps) {
  if (!open) return null;

  return (
    <div className="mt-2 grid gap-4 rounded-lg border border-border/80 bg-muted/20 p-4">
      <HistoryFilterDrawerHeader
        filtrosActivosCount={filtrosActivosCount}
        onClearFilters={onClearFilters}
      />

      <HistoryDateFilters
        fechaTipo={filters.fechaTipo as FechaTipoFilter | undefined}
        fechaDesde={filters.fechaDesde}
        fechaHasta={filters.fechaHasta}
        onChangeFechaTipo={(tipo) =>
          setFilters((prev) => ({ ...prev, fechaTipo: tipo }))
        }
        onChangeFechaDesde={(desde) =>
          setFilters((prev) => ({ ...prev, fechaDesde: desde }))
        }
        onChangeFechaHasta={(hasta) =>
          setFilters((prev) => ({ ...prev, fechaHasta: hasta }))
        }
      />

      <HistoryFieldFilters
        pedido={filters.pedido}
        solicitud={filters.solicitud}
        descripcion={filters.descripcion}
        estado={filters.estado as EstadoEntregaFilter | undefined}
        onChangePedido={(pedido) =>
          setFilters((prev) => ({ ...prev, pedido }))
        }
        onChangeSolicitud={(solicitud) =>
          setFilters((prev) => ({ ...prev, solicitud }))
        }
        onChangeDescripcion={(descripcion) =>
          setFilters((prev) => ({ ...prev, descripcion }))
        }
        onChangeEstado={(estado) =>
          setFilters((prev) => ({ ...prev, estado }))
        }
      />
    </div>
  );
}
