import { Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface InventoryEmptyCatalogProps {
  canManage: boolean;
  onNewPart: () => void;
}

export function InventoryEmptyCatalog({
  canManage,
  onNewPart,
}: InventoryEmptyCatalogProps) {
  return (
    <div className="p-10 text-center">
      <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
        <Package className="size-5" />
      </span>
      <p className="mt-4 text-base font-semibold tracking-tight">
        El catálogo está vacío
      </p>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
        Da de alta el primer repuesto con su código, ubicación y stock mínimo
        para empezar a controlar el almacén.
      </p>
      {canManage && (
        <Button type="button" className="mt-5 gap-2" onClick={onNewPart}>
          <Plus className="size-4" />
          Nuevo repuesto
        </Button>
      )}
    </div>
  );
}

export interface InventoryNoResultsProps {
  searchFilter: string;
  categoryFilter: string;
  onResetFilters: () => void;
}

export function InventoryNoResults({
  searchFilter,
  categoryFilter,
  onResetFilters,
}: InventoryNoResultsProps) {
  return (
    <div className="p-10 text-center">
      <p className="text-base font-semibold tracking-tight">Sin resultados</p>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
        No hay repuestos que coincidan con «{searchFilter || categoryFilter}».
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-4"
        onClick={onResetFilters}
      >
        Limpiar filtros
      </Button>
    </div>
  );
}
