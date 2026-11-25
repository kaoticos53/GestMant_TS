import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import type { PurchaseOrderDoc } from "@/lib/purchasing";
import type { ReceptionDoc } from "../types";
import { OrderSheet } from "../dialogs/OrderSheet";
import { useOrderActionDialogs } from "../hooks/useOrderActionDialogs";
import { useCellSelection } from "../hooks/useCellSelection";
import { useHistoryExport } from "../hooks/useHistoryExport";
import { useHistoryFilters } from "../hooks/useHistoryFilters";
import { OrderActionDialogs } from "./orders";
import { HistoryEmptyState } from "./history/HistoryEmptyState";
import { HistoryFilterDrawer } from "./history/HistoryFilterDrawer";
import { HistoryTable } from "./history/HistoryTable";
import { HistoryToolbar } from "./history/HistoryToolbar";

export interface HistorySectionProps {
  orders: PurchaseOrderDoc[];
  receptions: ReceptionDoc[];
  canManage?: boolean;
  onOpenRequest?: (id: Id<"partRequests">) => void;
}

/** Histórico de compras en formato tabla tipo Excel / Hoja de cálculo interactiva */
export function HistorySection({
  orders,
  receptions,
  canManage = false,
  onOpenRequest,
}: HistorySectionProps) {
  const [openOrder, setOpenOrder] = useState<PurchaseOrderDoc | null>(null);
  const dialogs = useOrderActionDialogs();
  const actualOrder = openOrder
    ? (orders.find((o) => o._id === openOrder._id) ?? openOrder)
    : null;
  const {
    filters,
    setFilters,
    advancedOpen,
    toggleAdvancedOpen,
    sort,
    setSort,
    allRows,
    proveedores,
    filtrosActivosCount,
    limpiarFiltros,
    filteredAndSortedRows,
  } = useHistoryFilters(orders, receptions);

  const {
    selectedCells,
    selectedCount,
    isSelected,
    isRowSelected,
    areAllSelected,
    toggleCell,
    toggleRow,
    toggleAll,
    clearSelection,
  } = useCellSelection(filteredAndSortedRows);

  const { isCopied, copyToClipboard, downloadCsv } = useHistoryExport(
    filteredAndSortedRows,
    selectedCells,
  );

  if (allRows.length === 0) {
    return <HistoryEmptyState />;
  }

  return (
    <div className="grid gap-4">
      {/* Barra de herramientas y filtros */}
      <HistoryToolbar
        filters={filters}
        setFilters={setFilters}
        proveedores={proveedores}
        advancedOpen={advancedOpen}
        onToggleAdvanced={toggleAdvancedOpen}
        filtrosActivosCount={filtrosActivosCount}
        onClearFilters={limpiarFiltros}
        selectedCount={selectedCount}
        onClearSelection={clearSelection}
        isCopied={isCopied}
        onCopy={() => void copyToClipboard()}
        onDownloadCsv={() => downloadCsv()}
        totalVisibleRows={filteredAndSortedRows.length}
      >
        <HistoryFilterDrawer
          open={advancedOpen}
          filters={filters}
          setFilters={setFilters}
          filtrosActivosCount={filtrosActivosCount}
          onClearFilters={limpiarFiltros}
        />
      </HistoryToolbar>

      {/* Tabla interactiva estilo Hoja de Cálculo */}
      <HistoryTable
        rows={filteredAndSortedRows}
        allRowsCount={allRows.length}
        sort={sort}
        onSortChange={setSort}
        areAllSelected={areAllSelected}
        onToggleAll={toggleAll}
        isRowSelected={isRowSelected}
        isSelected={isSelected}
        onToggleRow={toggleRow}
        onToggleCell={toggleCell}
        onOpenOrder={(orderRef) => {
          const match = orders.find((o) => o.reference === orderRef);
          if (match) setOpenOrder(match);
        }}
        selectedCount={selectedCount}
      />

      {actualOrder && (
        <OrderSheet
          order={actualOrder}
          receptions={receptions.filter(
            (row) => row.orderId === actualOrder._id,
          )}
          canManage={canManage}
          onClose={() => setOpenOrder(null)}
          onReceive={() => {
            dialogs.setRecibiendo(actualOrder);
            setOpenOrder(null);
          }}
          onCancel={() => {
            dialogs.startCancel(actualOrder);
            setOpenOrder(null);
          }}
          onOpenRequest={onOpenRequest}
        />
      )}

      <OrderActionDialogs
        recibiendo={dialogs.recibiendo}
        onCloseReceive={() => dialogs.setRecibiendo(null)}
        anulando={dialogs.anulando}
        onCloseCancel={dialogs.closeCancel}
        motivo={dialogs.motivo}
        onMotivoChange={dialogs.setMotivo}
        guardando={dialogs.guardando}
        onConfirmCancel={dialogs.confirmCancel}
      />
    </div>
  );
}
