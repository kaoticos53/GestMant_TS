import { CircleAlert, FileDown, Plus } from "lucide-react";
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
}

export function InventoryToolbarFilters({
  category,
  onCategoryChange,
  equipmentFilter,
  onEquipmentFilterChange,
  equipment,
  lowStockOnly,
  onToggleLowStockOnly,
  lowStockCount,
}: InventoryToolbarFiltersProps) {
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
          {PART_CATEGORIES.map((option) => (
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
}: InventoryToolbarActionsProps) {
  return (
    <>
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
