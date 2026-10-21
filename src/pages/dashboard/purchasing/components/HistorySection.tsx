import { CheckSquare, FileSpreadsheet, Square } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableTableHead } from "@/components/TableSort";
import {
  PURCHASE_HISTORY_COLUMNS,
  type PurchaseOrderDoc,
} from "@/lib/purchasing";
import type { ReceptionDoc } from "../types";
import { useCellSelection } from "../hooks/useCellSelection";
import { useHistoryExport } from "../hooks/useHistoryExport";
import { useHistoryFilters } from "../hooks/useHistoryFilters";
import { HistoryCell } from "./history/HistoryCell";
import { HistoryFilterDrawer } from "./history/HistoryFilterDrawer";
import { HistoryToolbar } from "./history/HistoryToolbar";

export interface HistorySectionProps {
  orders: PurchaseOrderDoc[];
  receptions: ReceptionDoc[];
}

/** Histórico de compras en formato tabla tipo Excel / Hoja de cálculo interactiva */
export function HistorySection({ orders, receptions }: HistorySectionProps) {
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
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-xs">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
          <FileSpreadsheet className="size-5" />
        </span>
        <p className="mt-4 text-base font-semibold tracking-tight">
          No hay compras en el histórico
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
          A medida que crees órdenes de compra y les asignes códigos de solicitud,
          se irán registrando aquí en formato tipo hoja de cálculo listo para copiar o exportar.
        </p>
      </div>
    );
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
      <Card className="overflow-hidden border-border/80 shadow-xs">
        <div className="max-h-[70vh] overflow-auto select-none">
          <Table className="border-collapse text-xs">
            <TableHeader className="sticky top-0 z-10 bg-primary/95 text-white backdrop-blur-xs">
              <TableRow className="border-b border-primary/20 hover:bg-transparent">
                {/* Selector global */}
                <TableHead className="w-[40px] px-2 text-center text-white">
                  <button
                    type="button"
                    onClick={toggleAll}
                    title={
                      areAllSelected
                        ? "Deseleccionar todas las celdas"
                        : "Seleccionar todas las celdas"
                    }
                    className="flex size-full items-center justify-center text-white hover:opacity-80"
                  >
                    {areAllSelected ? (
                      <CheckSquare className="size-4 text-white" />
                    ) : (
                      <Square className="size-4 text-white opacity-70" />
                    )}
                  </button>
                </TableHead>

                <SortableTableHead
                  column="orderReference"
                  label={PURCHASE_HISTORY_COLUMNS.orderReference.label}
                  sort={sort}
                  onSortChange={setSort}
                  className="w-[95px] text-white"
                  buttonClassName="text-white hover:text-white font-bold"
                />
                <SortableTableHead
                  column="solicitudeCode"
                  label={PURCHASE_HISTORY_COLUMNS.solicitudeCode.label}
                  sort={sort}
                  onSortChange={setSort}
                  className="w-[115px] text-white"
                  buttonClassName="text-white hover:text-white font-bold"
                />
                <SortableTableHead
                  column="position"
                  label={PURCHASE_HISTORY_COLUMNS.position.label}
                  sort={sort}
                  onSortChange={setSort}
                  align="right"
                  className="w-[75px] text-white"
                  buttonClassName="text-white hover:text-white font-bold"
                />
                <SortableTableHead
                  column="description"
                  label={PURCHASE_HISTORY_COLUMNS.description.label}
                  sort={sort}
                  onSortChange={setSort}
                  className="min-w-[220px] text-white"
                  buttonClassName="text-white hover:text-white font-bold"
                />
                <SortableTableHead
                  column="quantity"
                  label={PURCHASE_HISTORY_COLUMNS.quantity.label}
                  sort={sort}
                  onSortChange={setSort}
                  align="right"
                  className="w-[85px] text-white"
                  buttonClassName="text-white hover:text-white font-bold"
                />
                <SortableTableHead
                  column="receivedQuantity"
                  label={PURCHASE_HISTORY_COLUMNS.receivedQuantity.label}
                  sort={sort}
                  onSortChange={setSort}
                  align="right"
                  className="w-[85px] text-white"
                  buttonClassName="text-white hover:text-white font-bold"
                />
                <SortableTableHead
                  column="supplier"
                  label={PURCHASE_HISTORY_COLUMNS.supplier.label}
                  sort={sort}
                  onSortChange={setSort}
                  className="w-[130px] text-white"
                  buttonClassName="text-white hover:text-white font-bold"
                />
                <SortableTableHead
                  column="observations"
                  label={PURCHASE_HISTORY_COLUMNS.observations.label}
                  sort={sort}
                  onSortChange={setSort}
                  className="min-w-[150px] text-white"
                  buttonClassName="text-white hover:text-white font-bold"
                />
                <SortableTableHead
                  column="pendingQuantity"
                  label={PURCHASE_HISTORY_COLUMNS.pendingQuantity.label}
                  sort={sort}
                  onSortChange={setSort}
                  align="right"
                  className="w-[85px] text-white"
                  buttonClassName="text-white hover:text-white font-bold"
                />
                <SortableTableHead
                  column="orderedDate"
                  label={PURCHASE_HISTORY_COLUMNS.orderedDate.label}
                  sort={sort}
                  onSortChange={setSort}
                  className="w-[100px] text-white"
                  buttonClassName="text-white hover:text-white font-bold"
                />
                <SortableTableHead
                  column="receivedDate"
                  label={PURCHASE_HISTORY_COLUMNS.receivedDate.label}
                  sort={sort}
                  onSortChange={setSort}
                  className="w-[100px] text-white"
                  buttonClassName="text-white hover:text-white font-bold"
                />
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-border/60 font-sans">
              {filteredAndSortedRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={12}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No se encontraron líneas con los filtros actuales.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedRows.map((row) => {
                  const completado = row.pendingQuantity === 0;
                  const filaSeleccionada = isRowSelected(row.id);

                  return (
                    <TableRow
                      key={row.id}
                      className={`border-b border-border/40 transition-colors ${
                        filaSeleccionada
                          ? "bg-primary/10"
                          : "even:bg-muted/15 hover:bg-muted/30"
                      }`}
                    >
                      {/* Checkbox selector de fila */}
                      <TableCell className="w-[40px] px-2 text-center">
                        <button
                          type="button"
                          onClick={() => toggleRow(row.id)}
                          title={
                            filaSeleccionada
                              ? "Deseleccionar esta fila"
                              : "Seleccionar todas las celdas de esta fila"
                          }
                          className="flex size-full items-center justify-center text-muted-foreground hover:text-foreground"
                        >
                          {filaSeleccionada ? (
                            <CheckSquare className="size-4 text-primary" />
                          ) : (
                            <Square className="size-4 opacity-50" />
                          )}
                        </button>
                      </TableCell>

                      <HistoryCell
                        rowId={row.id}
                        column="orderReference"
                        isSelected={isSelected(row.id, "orderReference")}
                        onToggle={toggleCell}
                        className="font-mono font-semibold text-foreground"
                      >
                        {row.orderReference}
                      </HistoryCell>

                      <HistoryCell
                        rowId={row.id}
                        column="solicitudeCode"
                        isSelected={isSelected(row.id, "solicitudeCode")}
                        onToggle={toggleCell}
                      >
                        {row.solicitudeCode ? (
                          <span className="font-bold text-foreground">
                            {row.solicitudeCode}
                          </span>
                        ) : (
                          <span className="italic text-muted-foreground/60">—</span>
                        )}
                      </HistoryCell>

                      <HistoryCell
                        rowId={row.id}
                        column="position"
                        isSelected={isSelected(row.id, "position")}
                        onToggle={toggleCell}
                        className="text-right font-semibold text-foreground"
                      >
                        {row.position}
                      </HistoryCell>

                      <HistoryCell
                        rowId={row.id}
                        column="description"
                        isSelected={isSelected(row.id, "description")}
                        onToggle={toggleCell}
                        className="text-foreground"
                        title={row.description}
                      >
                        <span className="block max-w-[280px] truncate">
                          {row.description}
                        </span>
                      </HistoryCell>

                      <HistoryCell
                        rowId={row.id}
                        column="quantity"
                        isSelected={isSelected(row.id, "quantity")}
                        onToggle={toggleCell}
                        className="text-right font-bold text-foreground"
                      >
                        {row.quantity}
                      </HistoryCell>

                      <HistoryCell
                        rowId={row.id}
                        column="receivedQuantity"
                        isSelected={isSelected(row.id, "receivedQuantity")}
                        onToggle={toggleCell}
                        className="text-right font-bold text-foreground"
                      >
                        {row.receivedQuantity}
                      </HistoryCell>

                      <HistoryCell
                        rowId={row.id}
                        column="supplier"
                        isSelected={isSelected(row.id, "supplier")}
                        onToggle={toggleCell}
                        className="text-muted-foreground"
                      >
                        {row.supplier}
                      </HistoryCell>

                      <HistoryCell
                        rowId={row.id}
                        column="observations"
                        isSelected={isSelected(row.id, "observations")}
                        onToggle={toggleCell}
                        className="text-muted-foreground"
                        title={row.observations}
                      >
                        <span className="block max-w-[200px] truncate">
                          {row.observations || "—"}
                        </span>
                      </HistoryCell>

                      <HistoryCell
                        rowId={row.id}
                        column="pendingQuantity"
                        isSelected={isSelected(row.id, "pendingQuantity")}
                        onToggle={toggleCell}
                        className={`text-right font-semibold ${
                          completado
                            ? "text-muted-foreground/60"
                            : "font-bold text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {row.pendingQuantity}
                      </HistoryCell>

                      <HistoryCell
                        rowId={row.id}
                        column="orderedDate"
                        isSelected={isSelected(row.id, "orderedDate")}
                        onToggle={toggleCell}
                        className="text-muted-foreground"
                      >
                        {row.orderedDate}
                      </HistoryCell>

                      <HistoryCell
                        rowId={row.id}
                        column="receivedDate"
                        isSelected={isSelected(row.id, "receivedDate")}
                        onToggle={toggleCell}
                        className="font-medium text-foreground"
                      >
                        {row.receivedDate || "—"}
                      </HistoryCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pie de tabla informativo */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          <span>
            Mostrando <strong>{filteredAndSortedRows.length}</strong> de{" "}
            <strong>{allRows.length}</strong> líneas de compra
            {selectedCount > 0 && (
              <span className="ml-2 font-medium text-primary">
                ({selectedCount} celdas señaladas)
              </span>
            )}
          </span>
          <span className="italic">
            💡 Haz clic en cualquier celda para señalarla o usa la casilla de la izquierda para filas enteras. Pulsa en las cabeceras para ordenar.
          </span>
        </div>
      </Card>
    </div>
  );
}
