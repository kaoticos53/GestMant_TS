import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PurchaseHistoryFilters } from "@/lib/purchasing";

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

      {/* Rango de fechas */}
      <div className="grid gap-2 sm:grid-cols-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Filtrar fecha por:
          </label>
          <select
            value={filters.fechaTipo ?? "pedido"}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                fechaTipo: e.target.value as "pedido" | "recepcion" | "ambas",
              }))
            }
            className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="pedido">Fecha de pedido (F. PEDIDO)</option>
            <option value="recepcion">Fecha de recepción (F. RECEP.)</option>
            <option value="ambas">Cualquiera de las dos</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Fecha Desde:
          </label>
          <Input
            type="date"
            value={filters.fechaDesde ?? ""}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                fechaDesde: e.target.value,
              }))
            }
            className="mt-1 h-8 text-xs"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Fecha Hasta:
          </label>
          <Input
            type="date"
            value={filters.fechaHasta ?? ""}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                fechaHasta: e.target.value,
              }))
            }
            className="mt-1 h-8 text-xs"
          />
        </div>
      </div>

      {/* Campos específicos */}
      <div className="grid gap-2 sm:grid-cols-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Nº Pedido:
          </label>
          <Input
            value={filters.pedido ?? ""}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                pedido: e.target.value,
              }))
            }
            placeholder="Ej. OC-0001"
            className="mt-1 h-8 text-xs"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Nº Solicitud:
          </label>
          <Input
            value={filters.solicitud ?? ""}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                solicitud: e.target.value,
              }))
            }
            placeholder="Ej. 10034573"
            className="mt-1 h-8 text-xs"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Descripción / Repuesto:
          </label>
          <Input
            value={filters.descripcion ?? ""}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                descripcion: e.target.value,
              }))
            }
            placeholder="Nombre o código"
            className="mt-1 h-8 text-xs"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Estado de entrega:
          </label>
          <select
            value={filters.estado ?? "todos"}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                estado: e.target.value as
                  | "todos"
                  | "pendientes"
                  | "recibidos"
                  | "parciales",
              }))
            }
            className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="todos">Todos los estados</option>
            <option value="pendientes">Pendientes (con piezas por recibir)</option>
            <option value="recibidos">Completados (todo recibido)</option>
            <option value="parciales">Recibidos parcialmente</option>
          </select>
        </div>
      </div>
    </div>
  );
}
