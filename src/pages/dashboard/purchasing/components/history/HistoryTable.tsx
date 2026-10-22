import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import type {
  PurchaseHistoryColumn,
  PurchaseHistoryRow,
  PurchaseHistorySortColumn,
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
  selectedCount,
}: {
  rows: PurchaseHistoryRow[];
  allRowsCount: number;
  sort: TableSort<PurchaseHistorySortColumn> | null;
  onSortChange: (column: PurchaseHistorySortColumn) => void;
  areAllSelected: boolean;
  onToggleAll: () => void;
  isRowSelected: (rowId: string) => boolean;
  isSelected: (rowId: string, column: PurchaseHistoryColumn) => boolean;
  onToggleRow: (rowId: string) => void;
  onToggleCell: (rowId: string, column: PurchaseHistoryColumn) => void;
  selectedCount: number;
}) {
  return (
    <Card className="overflow-hidden border-border/80 shadow-xs">
      <div className="max-h-[70vh] overflow-auto select-none">
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
              rows.map((row) => (
                <HistoryTableRow
                  key={row.id}
                  row={row}
                  isRowSelected={isRowSelected(row.id)}
                  isSelected={(column) => isSelected(row.id, column)}
                  onToggleRow={onToggleRow}
                  onToggleCell={onToggleCell}
                />
              ))
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
