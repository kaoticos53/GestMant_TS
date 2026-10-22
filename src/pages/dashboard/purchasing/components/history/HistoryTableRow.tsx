import { CheckSquare, Square } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import type { PurchaseHistoryColumn, PurchaseHistoryRow } from "@/lib/purchasing";
import { HistoryCell } from "./HistoryCell";

export function HistoryTableRow({
  row,
  isRowSelected,
  isSelected,
  onToggleRow,
  onToggleCell,
}: {
  row: PurchaseHistoryRow;
  isRowSelected: boolean;
  isSelected: (column: PurchaseHistoryColumn) => boolean;
  onToggleRow: (rowId: string) => void;
  onToggleCell: (rowId: string, column: PurchaseHistoryColumn) => void;
}) {
  const completado = row.pendingQuantity === 0;

  return (
    <TableRow
      className={`border-b border-border/40 transition-colors ${
        isRowSelected
          ? "bg-primary/10"
          : "even:bg-muted/15 hover:bg-muted/30"
      }`}
    >
      {/* Checkbox selector de fila */}
      <TableCell className="w-[40px] px-2 text-center">
        <button
          type="button"
          onClick={() => onToggleRow(row.id)}
          title={
            isRowSelected
              ? "Deseleccionar esta fila"
              : "Seleccionar todas las celdas de esta fila"
          }
          className="flex size-full items-center justify-center text-muted-foreground hover:text-foreground"
        >
          {isRowSelected ? (
            <CheckSquare className="size-4 text-primary" />
          ) : (
            <Square className="size-4 opacity-50" />
          )}
        </button>
      </TableCell>

      <HistoryCell
        rowId={row.id}
        column="orderReference"
        isSelected={isSelected("orderReference")}
        onToggle={onToggleCell}
        className="font-mono font-semibold text-foreground"
      >
        {row.orderReference}
      </HistoryCell>

      <HistoryCell
        rowId={row.id}
        column="solicitudeCode"
        isSelected={isSelected("solicitudeCode")}
        onToggle={onToggleCell}
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
        isSelected={isSelected("position")}
        onToggle={onToggleCell}
        className="text-right font-semibold text-foreground"
      >
        {row.position}
      </HistoryCell>

      <HistoryCell
        rowId={row.id}
        column="description"
        isSelected={isSelected("description")}
        onToggle={onToggleCell}
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
        isSelected={isSelected("quantity")}
        onToggle={onToggleCell}
        className="text-right font-bold text-foreground"
      >
        {row.quantity}
      </HistoryCell>

      <HistoryCell
        rowId={row.id}
        column="receivedQuantity"
        isSelected={isSelected("receivedQuantity")}
        onToggle={onToggleCell}
        className="text-right font-bold text-foreground"
      >
        {row.receivedQuantity}
      </HistoryCell>

      <HistoryCell
        rowId={row.id}
        column="supplier"
        isSelected={isSelected("supplier")}
        onToggle={onToggleCell}
        className="text-muted-foreground"
      >
        {row.supplier}
      </HistoryCell>

      <HistoryCell
        rowId={row.id}
        column="observations"
        isSelected={isSelected("observations")}
        onToggle={onToggleCell}
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
        isSelected={isSelected("pendingQuantity")}
        onToggle={onToggleCell}
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
        isSelected={isSelected("orderedDate")}
        onToggle={onToggleCell}
        className="text-muted-foreground"
      >
        {row.orderedDate}
      </HistoryCell>

      <HistoryCell
        rowId={row.id}
        column="receivedDate"
        isSelected={isSelected("receivedDate")}
        onToggle={onToggleCell}
        className="font-medium text-foreground"
      >
        {row.receivedDate || "—"}
      </HistoryCell>
    </TableRow>
  );
}
