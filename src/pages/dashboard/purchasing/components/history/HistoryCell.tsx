import React, { memo } from "react";
import { TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { PurchaseHistoryColumn } from "@/lib/purchasing";

export interface HistoryCellProps {
  rowId: string;
  column: PurchaseHistoryColumn;
  isSelected: boolean;
  onToggle: (rowId: string, column: PurchaseHistoryColumn) => void;
  className?: string;
  title?: string;
  children: React.ReactNode;
}

/**
 * Celda interactiva de la tabla de histórico de compras.
 * Memoizada con React.memo para evitar re-renderizados innecesarios al alternar otras celdas.
 */
export const HistoryCell = memo(function HistoryCell({
  rowId,
  column,
  isSelected,
  onToggle,
  className,
  title,
  children,
}: HistoryCellProps) {
  const handleClick = () => onToggle(rowId, column);

  return (
    <TableCell
      onClick={handleClick}
      title={title ?? "Haz clic para señalar/deseleccionar esta celda"}
      className={cn(
        "cursor-pointer select-text transition-colors",
        isSelected
          ? "bg-primary/20 font-semibold text-foreground shadow-xs ring-2 ring-primary ring-inset"
          : "hover:bg-muted/60",
        className,
      )}
    >
      {children}
    </TableCell>
  );
});
