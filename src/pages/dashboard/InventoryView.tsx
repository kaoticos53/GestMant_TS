import { useState } from "react";
import { DataTableToolbar } from "@/components/DataTableToolbar";
import { ListViewSkeleton } from "@/components/ListViewSkeleton";
import { PrintBatchLabelsDialog } from "@/components/PrintBatchLabelsDialog";
import { PrintLabelDialog } from "@/components/PrintLabelDialog";
import { TablePagination } from "@/components/TablePagination";
import { PartFormDialog } from "./inventory/dialogs/PartFormDialog";
import { StockDialog } from "./inventory/dialogs/StockDialog";
import { StockMovementsDialog } from "./inventory/dialogs/StockMovementsDialog";
import { InventoryCountDialog } from "./inventory/dialogs/InventoryCountDialog";
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
import { PartDetailSheet } from "./inventory/components/PartDetailSheet";
import { useInventoryState } from "./inventory/hooks/useInventoryState";
import { findExactCodeMatch } from "@/lib/codeLookup";
import { partLabel as buildPartLabel } from "@/lib/labelGenerator";
import type { Id } from "@/convex/_generated/dataModel";
import type { PartDoc, InventoryViewProps } from "./inventory/types";

export type { InventoryViewProps } from "./inventory/types";

export function InventoryView({
  canManage = false,
  canPurchase = false,
  currentUserId = null,
  initialSearch = "",
  initialCategory = "all",
  initialLowStockOnly = false,
  onOpenEquipmentModel,
}: InventoryViewProps) {
  const [labelTarget, setLabelTarget] = useState<PartDoc | null>(null);
  const [batchLabelsOpen, setBatchLabelsOpen] = useState(false);
  const [detailId, setDetailId] = useState<Id<"spareParts"> | null>(null);
  // Un código exacto al entrar (QR, pistola o buscador) abre la ficha directa.
  const [dismissedInitialDetail, setDismissedInitialDetail] = useState(false);
  const [movementsOpen, setMovementsOpen] = useState(false);
  const [countOpen, setCountOpen] = useState(false);
  const origin =
    typeof window === "undefined" ? "" : window.location.origin;

  const {
    parts,
    loading,
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
    initialCategory,
    initialLowStockOnly,
  });

  const categories = Array.from(
    new Set(
      parts
        .map((part) => part.category.trim())
        .filter((cat) => cat.length > 0),
    ),
  );

  const detailTarget =
    detailId !== null
      ? (parts.find((part) => part._id === detailId) ?? null)
      : !dismissedInitialDetail
        ? findExactCodeMatch(parts, initialSearch, (part) => [
            part.code,
            part.partNumber,
          ])
        : null;
  const closeDetail = () => {
    setDetailId(null);
    setDismissedInitialDetail(true);
  };

  if (loading) {
    return <ListViewSkeleton />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border/70 bg-card shadow-sm">
        <DataTableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar por código, ref. fabricante, nombre, ubicación o proveedor"
          searchAriaLabel="Buscar repuesto"
          hasActiveFilters={filtering}
          onResetFilters={handleResetFilters}
          resetFiltersLabel="Limpiar filtros"
          filters={
            <InventoryToolbarFilters
              category={category}
              onCategoryChange={setCategory}
              categories={categories}
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
              onOpenMovements={() => setMovementsOpen(true)}
              onOpenCount={() => setCountOpen(true)}
              onOpenBatchLabels={() => setBatchLabelsOpen(true)}
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
            onOpenDetail={(part) => setDetailId(part._id)}
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

      <PrintBatchLabelsDialog
        open={batchLabelsOpen}
        onClose={() => setBatchLabelsOpen(false)}
        kind="part"
        labels={filtered.map((part) => buildPartLabel(part, origin))}
      />

      <PartDetailSheet
        part={detailTarget}
        parts={parts}
        canManage={canManage}
        canPurchase={canPurchase}
        catalogModels={catalogModels}
        onClose={closeDetail}
        onEdit={(part) => setFormTarget({ part })}
        onStockAdjust={setStockTarget}
        onPrintLabel={setLabelTarget}
        onSelectModel={onOpenEquipmentModel}
        onSelectPart={(id) => setDetailId(id)}
      />

      {movementsOpen && (
        <StockMovementsDialog
          open={movementsOpen}
          onClose={() => setMovementsOpen(false)}
        />
      )}

      {countOpen && (
        <InventoryCountDialog
          open={countOpen}
          onClose={() => setCountOpen(false)}
          parts={parts}
        />
      )}
    </div>
  );
}
