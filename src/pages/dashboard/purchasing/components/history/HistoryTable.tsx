import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useVirtualRows } from "@/hooks/use-virtual-rows";
import type {
  PurchaseHistoryColumn,
  PurchaseHistoryRow,
} from "@/lib/purchasing";
import type { TableSort } from "@/lib/tableSort";
import { HistoryTableHead } from "./HistoryTableHead";
import { HistoryTableRow } from "./HistoryTableRow";
import { HistoryTableFooter } from "./HistoryTableFooter";

export function HistoryTable({
  rows,
  allRowsCount,
  sort,
  onSortChange,
  areAllSelected,
  onToggleAll,
  isRowSelected,
  isSelected,
  onToggleRow,
  onToggleCell,
  onOpenOrder,
  selectedCount,
}: {
  rows: PurchaseHistoryRow[];
  allRowsCount: number;
  sort: TableSort<PurchaseHistoryColumn> | null;
  onSortChange: (sort: TableSort<PurchaseHistoryColumn> | null) => void;
  areAllSelected: boolean;
  onToggleAll: () => void;
  isRowSelected: (rowId: string) => boolean;
  isSelected: (rowId: string, column: PurchaseHistoryColumn) => boolean;
  onToggleRow: (rowId: string) => void;
  onToggleCell: (rowId: string, column: PurchaseHistoryColumn) => void;
  onOpenOrder?: (orderReference: string) => void;
  selectedCount: number;
}) {
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );
  const virtual = useVirtualRows({ count: rows.length, scrollElement });

  return (
    <Card className="overflow-hidden border-border/80 shadow-xs">
      <div
        ref={setScrollElement}
        className="max-h-[70vh] overflow-auto select-none"
      >
        <Table className="border-collapse text-xs">
          <HistoryTableHead
            areAllSelected={areAllSelected}
            onToggleAll={onToggleAll}
            sort={sort}
            onSortChange={onSortChange}
          />

          <TableBody className="divide-y divide-border/60 font-sans">
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={12}
                  className="py-10 text-center text-muted-foreground"
                >
                  No se encontraron líneas con los filtros actuales.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {virtual.active && virtual.paddingTop > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={12} style={{ height: virtual.paddingTop }} />
                  </tr>
                )}
                {virtual.indices.map((index) => {
                  const row = rows[index];
                  if (!row) return null;
                  return (
                    <HistoryTableRow
                      key={row.id}
                      rowIndex={virtual.active ? index : undefined}
                      rowRef={virtual.active ? virtual.measureElement : undefined}
                      row={row}
                      isRowSelected={isRowSelected(row.id)}
                      isSelected={(column) => isSelected(row.id, column)}
                      onToggleRow={onToggleRow}
                      onToggleCell={onToggleCell}
                      onOpenOrder={onOpenOrder}
                    />
                  );
                })}
                {virtual.active && virtual.paddingBottom > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={12} style={{ height: virtual.paddingBottom }} />
                  </tr>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      <HistoryTableFooter
        visibleCount={rows.length}
        allRowsCount={allRowsCount}
        selectedCount={selectedCount}
      />
    </Card>
  );
}
