import { CircleAlert, ClipboardCheck, FileDown, History, Plus, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PART_CATEGORIES, equipmentLabel } from "@/lib/workshop";
import type { EquipmentDoc } from "../types";

export interface InventoryToolbarFiltersProps {
  category: string;
  onCategoryChange: (value: string) => void;
  categories?: string[];
  equipmentFilter: string;
  onEquipmentFilterChange: (value: string) => void;
  equipment: EquipmentDoc[];
  lowStockOnly: boolean;
  onToggleLowStockOnly: () => void;
  lowStockCount: number;
}

export interface InventoryToolbarActionsProps {
  canManage: boolean;
  filteredCount: number;
  onExport: () => void;
  onNewPart: () => void;
  onOpenMovements?: () => void;
  onOpenCount?: () => void;
  onOpenBatchLabels?: () => void;
}

export function InventoryToolbarFilters({
  category,
  onCategoryChange,
  categories,
  equipmentFilter,
  onEquipmentFilterChange,
  equipment,
  lowStockOnly,
  onToggleLowStockOnly,
  lowStockCount,
}: InventoryToolbarFiltersProps) {
  const categoryOptions = Array.from(
    new Set([
      ...PART_CATEGORIES,
      ...(categories ?? []),
      ...(category !== "all" ? [category] : []),
    ]),
  );

  return (
    <>
      <Select value={category} onValueChange={onCategoryChange}>
        <SelectTrigger
          className="w-full sm:w-44"
          aria-label="Filtrar por categoría"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las categorías</SelectItem>
          {categoryOptions.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={equipmentFilter} onValueChange={onEquipmentFilterChange}>
        <SelectTrigger
          className="w-full sm:w-52"
          aria-label="Filtrar por equipo"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los equipos</SelectItem>
          {equipment.map((item) => (
            <SelectItem key={item._id} value={item._id}>
              {equipmentLabel(item)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <button
        type="button"
        onClick={onToggleLowStockOnly}
        aria-pressed={lowStockOnly}
        title="Muestra solo los repuestos por debajo del stock mínimo"
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
          lowStockOnly
            ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
            : "border-border/70 bg-card text-muted-foreground hover:text-foreground",
        )}
      >
        <CircleAlert className="size-4" />
        Solo stock bajo
        <span className="text-xs tabular-nums opacity-70">
          {lowStockCount}
        </span>
      </button>
    </>
  );
}

export function InventoryToolbarActions({
  canManage,
  filteredCount,
  onExport,
  onNewPart,
  onOpenMovements,
  onOpenCount,
  onOpenBatchLabels,
}: InventoryToolbarActionsProps) {
  return (
    <>
      {canManage && onOpenCount && (
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={onOpenCount}
          title="Introducir recuento físico de almacén en lote"
        >
          <ClipboardCheck className="size-4" />
          Recuento físico
        </Button>
      )}
      {onOpenMovements && (
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={onOpenMovements}
          title="Ver historial de movimientos de stock del almacén"
        >
          <History className="size-4" />
          Movimientos
        </Button>
      )}
      {onOpenBatchLabels && (
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={onOpenBatchLabels}
          disabled={filteredCount === 0}
          title="Imprimir lote de etiquetas QR de los repuestos filtrados"
        >
          <Tags className="size-4" />
          Etiquetas ({filteredCount})
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        className="gap-2"
        onClick={onExport}
        disabled={filteredCount === 0}
        title="Descarga en CSV los repuestos que se ven filtrados"
      >
        <FileDown className="size-4" />
        Exportar CSV ({filteredCount})
      </Button>
      {canManage && (
        <Button type="button" className="gap-2" onClick={onNewPart}>
          <Plus className="size-4" />
          Nuevo repuesto
        </Button>
      )}
    </>
  );
}
