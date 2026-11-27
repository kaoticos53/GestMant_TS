import { BookOpen, FileDown, FileUp } from "lucide-react";
import { DataTableToolbar } from "@/components/DataTableToolbar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MANUAL_TYPES } from "@/lib/manuals";
import { equipmentLabel } from "@/lib/workshop";
import {
  MANUAL_KIND_FILTER_OPTIONS,
  NO_EQUIPMENT_FILTER,
  type ManualKindFilter,
} from "../hooks/useManualsListState";
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
  kind?: ManualKindFilter;
  onKindChange?: (value: ManualKindFilter) => void;
  /** Sin usuario identificado no se ofrece «Mis notas». */
  canFilterMine?: boolean;
  brands: string[];
  models: string[];
  equipment: EquipmentDoc[];
  canManage?: boolean;
  canWriteNotes?: boolean;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
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
  kind = "all",
  onKindChange,
  canFilterMine = false,
  brands,
  models,
  equipment,
  canManage = false,
  canWriteNotes = canManage,
  hasActiveFilters = false,
  onClearFilters,
  onExportCsv,
  onNewManual,
}: ManualsFilterBarProps) {
  return (
    <div className="flex flex-col border-b border-border/70">
      <DataTableToolbar
        className="border-b-0 pb-3"
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Buscar por título, marca, modelo o nota"
        searchAriaLabel="Buscar manual"
        hasActiveFilters={hasActiveFilters}
        onResetFilters={onClearFilters}
        actions={
          <>
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
            {canManage ? (
              <Button
                type="button"
                className="gap-2"
                onClick={onNewManual}
              >
                <FileUp className="size-4" />
                Subir manual
              </Button>
            ) : (
              canWriteNotes && (
                <Button
                  type="button"
                  className="gap-2"
                  onClick={onNewManual}
                >
                  <BookOpen className="size-4" />
                  Escribir nota
                </Button>
              )
            )}
          </>
        }
      />

      <div
        className={
          onKindChange
            ? "grid gap-2 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-5"
            : "grid gap-2 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-4"
        }
      >
        {onKindChange && (
          <Select
            value={kind}
            onValueChange={(value) => onKindChange(value as ManualKindFilter)}
          >
            <SelectTrigger aria-label="Filtrar por clase de documento">
              <SelectValue placeholder="PDF y notas" />
            </SelectTrigger>
            <SelectContent>
              {MANUAL_KIND_FILTER_OPTIONS.filter(
                (option) => option.value !== "mine" || canFilterMine,
              ).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

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
