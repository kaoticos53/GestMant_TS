import {
  Check,
  Copy,
  Download,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PurchaseHistoryFilters } from "@/lib/purchasing";

export interface HistoryToolbarProps {
  filters: PurchaseHistoryFilters;
  setFilters: React.Dispatch<React.SetStateAction<PurchaseHistoryFilters>>;
  proveedores: readonly string[];
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
  filtrosActivosCount: number;
  onClearFilters: () => void;
  selectedCount: number;
  onClearSelection: () => void;
  isCopied: boolean;
  onCopy: () => void;
  onDownloadCsv: () => void;
  totalVisibleRows: number;
  children?: React.ReactNode;
}

/**
 * Barra superior de controles, búsqueda rápida y exportación para el histórico de compras.
 */
export function HistoryToolbar({
  filters,
  setFilters,
  proveedores,
  advancedOpen,
  onToggleAdvanced,
  filtrosActivosCount,
  onClearFilters,
  selectedCount,
  onClearSelection,
  isCopied,
  onCopy,
  onDownloadCsv,
  totalVisibleRows,
  children,
}: HistoryToolbarProps) {
  return (
    <Card>
      <CardContent className="grid gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filters.query ?? ""}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, query: e.target.value }))
                }
                placeholder="Buscar en todos los campos..."
                className="h-9 pl-8 text-sm"
              />
            </div>

            {proveedores.length > 1 && (
              <select
                value={filters.proveedor ?? "todos"}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    proveedor: e.target.value,
                  }))
                }
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="todos">Todos los proveedores</option>
                {proveedores.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            )}

            <Button
              type="button"
              variant={
                advancedOpen || filtrosActivosCount > 0 ? "secondary" : "outline"
              }
              size="sm"
              className="gap-2"
              onClick={onToggleAdvanced}
            >
              <SlidersHorizontal className="size-4" />
              Filtros avanzados
              {filtrosActivosCount > 0 && (
                <Badge
                  variant="default"
                  className="size-5 justify-center rounded-full p-0 text-[10px]"
                >
                  {filtrosActivosCount}
                </Badge>
              )}
            </Button>

            {filtrosActivosCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-xs text-destructive hover:text-destructive"
                onClick={onClearFilters}
              >
                <X className="size-3.5" />
                Limpiar filtros
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                onClick={onClearSelection}
              >
                <X className="size-3.5" />
                Deseleccionar ({selectedCount})
              </Button>
            )}

            <Button
              type="button"
              variant={selectedCount > 0 ? "default" : "secondary"}
              size="sm"
              className="gap-2"
              onClick={onCopy}
            >
              {isCopied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              {isCopied
                ? "¡Copiado a Excel!"
                : selectedCount > 0
                  ? `Copiar selección (${selectedCount} celdas)`
                  : `Copiar visibles (${totalVisibleRows} filas)`}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={onDownloadCsv}
            >
              <Download className="size-4" />
              CSV
            </Button>
          </div>
        </div>

        {children}
      </CardContent>
    </Card>
  );
}
