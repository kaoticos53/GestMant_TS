import { FileDown, FileUp, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MANUAL_TYPES } from "@/lib/manuals";
import { equipmentLabel } from "@/lib/workshop";
import { NO_EQUIPMENT_FILTER } from "../hooks/useManualsListState";
import type { EquipmentDoc } from "../types";

export interface ManualsFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  type: string;
  onTypeChange: (value: string) => void;
  brand: string;
  onBrandChange: (value: string) => void;
  model: string;
  onModelChange: (value: string) => void;
  equipmentFilter: string;
  onEquipmentFilterChange: (value: string) => void;
  brands: string[];
  models: string[];
  equipment: EquipmentDoc[];
  canManage?: boolean;
  onExportCsv: () => void;
  onNewManual: () => void;
}

/**
 * Barra superior de controles del catálogo de manuales:
 * buscador en texto libre, exportación a CSV, alta y filtros select en cascada.
 */
export function ManualsFilterBar({
  search,
  onSearchChange,
  type,
  onTypeChange,
  brand,
  onBrandChange,
  model,
  onModelChange,
  equipmentFilter,
  onEquipmentFilterChange,
  brands,
  models,
  equipment,
  canManage = false,
  onExportCsv,
  onNewManual,
}: ManualsFilterBarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/70 p-4">
      <div className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar por título, marca, modelo o nota"
            className="pl-9"
            aria-label="Buscar manual"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={onExportCsv}
          >
            <FileDown className="size-4" />
            CSV
          </Button>
          {canManage && (
            <Button
              type="button"
              className="gap-2"
              onClick={onNewManual}
            >
              <FileUp className="size-4" />
              Subir manual
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Select value={type} onValueChange={onTypeChange}>
          <SelectTrigger aria-label="Filtrar por tipo">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {MANUAL_TYPES.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={brand} onValueChange={onBrandChange}>
          <SelectTrigger aria-label="Filtrar por marca">
            <SelectValue placeholder="Marca" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las marcas</SelectItem>
            {brands.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={model} onValueChange={onModelChange}>
          <SelectTrigger aria-label="Filtrar por modelo">
            <SelectValue placeholder="Modelo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los modelos</SelectItem>
            {models.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={equipmentFilter} onValueChange={onEquipmentFilterChange}>
          <SelectTrigger aria-label="Filtrar por equipo">
            <SelectValue placeholder="Equipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Cualquier equipo</SelectItem>
            <SelectItem value={NO_EQUIPMENT_FILTER}>
              Sin equipo asignado
            </SelectItem>
            {equipment.map((item) => (
              <SelectItem key={item._id} value={item._id}>
                {equipmentLabel(item)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
