import { useCallback, useMemo, useState } from "react";
import type { PurchaseHistoryColumn, PurchaseHistoryRow } from "@/lib/purchasing";

export const DEFAULT_HISTORY_COLUMNS: readonly PurchaseHistoryColumn[] = [
  "orderReference",
  "solicitudeCode",
  "position",
  "description",
  "quantity",
  "receivedQuantity",
  "supplier",
  "observations",
  "pendingQuantity",
  "orderedDate",
  "receivedDate",
] as const;

export interface CellSelectionApi {
  selectedCells: ReadonlySet<string>;
  selectedCount: number;
  isSelected: (rowId: string, col: PurchaseHistoryColumn) => boolean;
  isRowSelected: (rowId: string) => boolean;
  areAllSelected: boolean;
  toggleCell: (rowId: string, col: PurchaseHistoryColumn) => void;
  toggleRow: (rowId: string) => void;
  toggleAll: () => void;
  clearSelection: () => void;
}

/**
 * Hook para la gestión de selección de celdas bidimensionales en tabla interactiva tipo hoja de cálculo.
 * Clave interna de cada celda: `"${rowId}:${colKey}"`.
 */
export function useCellSelection(
  rows: readonly PurchaseHistoryRow[],
  columns: readonly PurchaseHistoryColumn[] = DEFAULT_HISTORY_COLUMNS,
): CellSelectionApi {
  const [selectedCells, setSelectedCells] = useState<Set<string>>(() => new Set());

  const isSelected = useCallback(
    (rowId: string, col: PurchaseHistoryColumn): boolean => {
      return selectedCells.has(`${rowId}:${col}`);
    },
    [selectedCells],
  );

  const isRowSelected = useCallback(
    (rowId: string): boolean => {
      if (columns.length === 0) return false;
      return columns.every((col) => selectedCells.has(`${rowId}:${col}`));
    },
    [columns, selectedCells],
  );

  const areAllSelected = useMemo(() => {
    if (rows.length === 0 || selectedCells.size === 0) return false;
    return rows.every((row) =>
      columns.every((col) => selectedCells.has(`${row.id}:${col}`)),
    );
  }, [rows, columns, selectedCells]);

  const toggleCell = useCallback((rowId: string, col: PurchaseHistoryColumn) => {
    setSelectedCells((prev) => {
      const next = new Set(prev);
      const key = `${rowId}:${col}`;
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const toggleRow = useCallback(
    (rowId: string) => {
      setSelectedCells((prev) => {
        const next = new Set(prev);
        const rowKeys = columns.map((c) => `${rowId}:${c}`);
        const allChecked = rowKeys.every((k) => next.has(k));

        if (allChecked) {
          rowKeys.forEach((k) => next.delete(k));
        } else {
          rowKeys.forEach((k) => next.add(k));
        }
        return next;
      });
    },
    [columns],
  );

  const toggleAll = useCallback(() => {
    setSelectedCells((prev) => {
      if (prev.size > 0) {
        return new Set();
      }
      const all = new Set<string>();
      for (const row of rows) {
        for (const col of columns) {
          all.add(`${row.id}:${col}`);
        }
      }
      return all;
    });
  }, [rows, columns]);

  const clearSelection = useCallback(() => {
    setSelectedCells(new Set());
  }, []);

  return {
    selectedCells,
    selectedCount: selectedCells.size,
    isSelected,
    isRowSelected,
    areAllSelected,
    toggleCell,
    toggleRow,
    toggleAll,
    clearSelection,
  };
}
