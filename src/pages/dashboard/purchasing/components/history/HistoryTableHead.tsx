import { CheckSquare, Square } from "lucide-react";
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableTableHead } from "@/components/TableSort";
import {
  PURCHASE_HISTORY_COLUMNS,
  type PurchaseHistoryColumn,
} from "@/lib/purchasing";
import type { TableSort } from "@/lib/tableSort";

export function HistoryTableHead({
  areAllSelected,
  onToggleAll,
  sort,
  onSortChange,
}: {
  areAllSelected: boolean;
  onToggleAll: () => void;
  sort: TableSort<PurchaseHistoryColumn> | null;
  onSortChange: (sort: TableSort<PurchaseHistoryColumn> | null) => void;
}) {
  return (
    <TableHeader className="sticky top-0 z-10 bg-primary/95 text-white backdrop-blur-xs">
      <TableRow className="border-b border-primary/20 hover:bg-transparent">
        {/* Selector global */}
        <TableHead className="w-[40px] px-2 text-center text-white">
          <button
            type="button"
            onClick={onToggleAll}
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
          onSortChange={onSortChange}
          className="w-[95px] text-white"
          buttonClassName="text-white hover:text-white font-bold"
        />
        <SortableTableHead
          column="solicitudeCode"
          label={PURCHASE_HISTORY_COLUMNS.solicitudeCode.label}
          sort={sort}
          onSortChange={onSortChange}
          className="w-[115px] text-white"
          buttonClassName="text-white hover:text-white font-bold"
        />
        <SortableTableHead
          column="position"
          label={PURCHASE_HISTORY_COLUMNS.position.label}
          sort={sort}
          onSortChange={onSortChange}
          align="right"
          className="w-[75px] text-white"
          buttonClassName="text-white hover:text-white font-bold"
        />
        <SortableTableHead
          column="description"
          label={PURCHASE_HISTORY_COLUMNS.description.label}
          sort={sort}
          onSortChange={onSortChange}
          className="min-w-[220px] text-white"
          buttonClassName="text-white hover:text-white font-bold"
        />
        <SortableTableHead
          column="quantity"
          label={PURCHASE_HISTORY_COLUMNS.quantity.label}
          sort={sort}
          onSortChange={onSortChange}
          align="right"
          className="w-[85px] text-white"
          buttonClassName="text-white hover:text-white font-bold"
        />
        <SortableTableHead
          column="receivedQuantity"
          label={PURCHASE_HISTORY_COLUMNS.receivedQuantity.label}
          sort={sort}
          onSortChange={onSortChange}
          align="right"
          className="w-[85px] text-white"
          buttonClassName="text-white hover:text-white font-bold"
        />
        <SortableTableHead
          column="supplier"
          label={PURCHASE_HISTORY_COLUMNS.supplier.label}
          sort={sort}
          onSortChange={onSortChange}
          className="w-[130px] text-white"
          buttonClassName="text-white hover:text-white font-bold"
        />
        <SortableTableHead
          column="observations"
          label={PURCHASE_HISTORY_COLUMNS.observations.label}
          sort={sort}
          onSortChange={onSortChange}
          className="min-w-[150px] text-white"
          buttonClassName="text-white hover:text-white font-bold"
        />
        <SortableTableHead
          column="pendingQuantity"
          label={PURCHASE_HISTORY_COLUMNS.pendingQuantity.label}
          sort={sort}
          onSortChange={onSortChange}
          align="right"
          className="w-[85px] text-white"
          buttonClassName="text-white hover:text-white font-bold"
        />
        <SortableTableHead
          column="orderedDate"
          label={PURCHASE_HISTORY_COLUMNS.orderedDate.label}
          sort={sort}
          onSortChange={onSortChange}
          className="w-[100px] text-white"
          buttonClassName="text-white hover:text-white font-bold"
        />
        <SortableTableHead
          column="receivedDate"
          label={PURCHASE_HISTORY_COLUMNS.receivedDate.label}
          sort={sort}
          onSortChange={onSortChange}
          className="w-[100px] text-white"
          buttonClassName="text-white hover:text-white font-bold"
        />
      </TableRow>
    </TableHeader>
  );
}
