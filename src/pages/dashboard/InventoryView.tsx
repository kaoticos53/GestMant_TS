import { useState } from "react";
import { DataTableToolbar } from "@/components/DataTableToolbar";
import { PrintLabelDialog } from "@/components/PrintLabelDialog";
import { TablePagination } from "@/components/TablePagination";
import { PartFormDialog } from "./inventory/dialogs/PartFormDialog";
import { StockDialog } from "./inventory/dialogs/StockDialog";
import {
  InventoryToolbarActions,
  InventoryToolbarFilters,
} from "./inventory/components/InventoryToolbarFilters";
import {
  InventoryEmptyCatalog,
  InventoryNoResults,
} from "./inventory/components/InventoryEmptyState";
import { InventoryTable } from "./inventory/components/InventoryTable";
import { InventoryDeleteDialog } from "./inventory/components/InventoryDeleteDialog";
import { useInventoryState } from "./inventory/hooks/useInventoryState";
import { partLabel as buildPartLabel } from "@/lib/labelGenerator";
import type { PartDoc } from "./inventory/types";
import type { InventoryViewProps } from "./inventory/types";

export type { InventoryViewProps } from "./inventory/types";

export function InventoryView({
  canManage = false,
  currentUserId = null,
  initialSearch = "",
  initialLowStockOnly = false,
}: InventoryViewProps) {
  const [labelTarget, setLabelTarget] = useState<PartDoc | null>(null);
  const origin =
    typeof window === "undefined" ? "" : window.location.origin;

  const {
    parts,
    equipment,
    catalogModels,
    search,
    setSearch,
    category,
    setCategory,
    equipmentFilter,
    setEquipmentFilter,
    lowStockOnly,
    handleToggleLowStockOnly,
    lowStockCount,
    filtered,
    filtering,
    columns,
    sort,
    setSort,
    areaRef,
    paging,
    visible,
    formTarget,
    setFormTarget,
    stockTarget,
    setStockTarget,
    deleteTarget,
    setDeleteTarget,
    handleQuickAdjust,
    handleDelete,
    handleExport,
    handleResetFilters,
  } = useInventoryState({
    currentUserId,
    initialSearch,
    initialLowStockOnly,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border/70 bg-card shadow-sm">
        <DataTableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar por código, nombre, ubicación o proveedor"
          searchAriaLabel="Buscar repuesto"
          hasActiveFilters={filtering}
          onResetFilters={handleResetFilters}
          resetFiltersLabel="Limpiar filtros"
          filters={
            <InventoryToolbarFilters
              category={category}
              onCategoryChange={setCategory}
              equipmentFilter={equipmentFilter}
              onEquipmentFilterChange={setEquipmentFilter}
              equipment={equipment}
              lowStockOnly={lowStockOnly}
              onToggleLowStockOnly={handleToggleLowStockOnly}
              lowStockCount={lowStockCount}
            />
          }
          actions={
            <InventoryToolbarActions
              canManage={canManage}
              filteredCount={filtered.length}
              onExport={handleExport}
              onNewPart={() => setFormTarget({ part: null })}
            />
          }
        />

        {parts.length === 0 ? (
          <InventoryEmptyCatalog
            canManage={canManage}
            onNewPart={() => setFormTarget({ part: null })}
          />
        ) : filtered.length === 0 ? (
          <InventoryNoResults
            searchFilter={search}
            categoryFilter={category}
            onResetFilters={handleResetFilters}
          />
        ) : (
          <InventoryTable
            columns={columns}
            sort={sort}
            onSortChange={setSort}
            areaRef={areaRef}
            page={paging.page}
            visibleParts={visible}
            canManage={canManage}
            catalogModels={catalogModels}
            onQuickAdjust={handleQuickAdjust}
            onEdit={(part) => setFormTarget({ part })}
            onStockAdjust={setStockTarget}
            onDelete={setDeleteTarget}
            onPrintLabel={setLabelTarget}
          />
        )}

        {filtered.length > 0 && (
          <TablePagination
            paging={paging}
            singular="repuesto"
            plural="repuestos"
            detail={filtering ? `${parts.length} en el catálogo` : undefined}
          />
        )}
      </div>

      {formTarget && (
        <PartFormDialog
          key={formTarget.part?._id ?? "new"}
          part={formTarget.part}
          catalogModels={catalogModels}
          onClose={() => setFormTarget(null)}
        />
      )}

      {stockTarget && (
        <StockDialog
          part={stockTarget}
          onClose={() => setStockTarget(null)}
        />
      )}

      <InventoryDeleteDialog
        part={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      <PrintLabelDialog
        label={labelTarget === null ? null : buildPartLabel(labelTarget, origin)}
        onClose={() => setLabelTarget(null)}
      />
    </div>
  );
}
