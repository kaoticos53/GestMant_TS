import { useCallback, useState } from "react";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListArea } from "@/components/ListArea";
import { useVirtualRows } from "@/hooks/use-virtual-rows";
import { SortableTableHead, TableSortBar } from "@/components/TableSort";
import type { TableSort } from "@/lib/tableSort";
import type { EquipmentModelDoc, PartDoc } from "../types";
import type { INVENTORY_SORT_COLUMNS } from "../helpers";
import { PartRow } from "./PartRow";

export interface InventoryTableProps {
  columns: typeof INVENTORY_SORT_COLUMNS;
  sort: TableSort<keyof typeof INVENTORY_SORT_COLUMNS> | null;
  onSortChange: (
    sort: TableSort<keyof typeof INVENTORY_SORT_COLUMNS> | null,
  ) => void;
  areaRef: (element: HTMLDivElement | null) => void;
  page: number;
  visibleParts: PartDoc[];
  canManage: boolean;
  catalogModels: EquipmentModelDoc[];
  onQuickAdjust: (part: PartDoc, delta: number) => void;
  onEdit: (part: PartDoc) => void;
  onStockAdjust: (part: PartDoc) => void;
  onDelete: (part: PartDoc) => void;
  onPrintLabel: (part: PartDoc) => void;
}

export function InventoryTable({
  columns,
  sort,
  onSortChange,
  areaRef,
  page,
  visibleParts,
  canManage,
  catalogModels,
  onQuickAdjust,
  onEdit,
  onStockAdjust,
  onDelete,
  onPrintLabel,
}: InventoryTableProps) {
  // Igual que en equipos: se virtualiza la página, no la tabla entera. La caja
  // que desplaza es la de `ListArea` y su referencia se comparte.
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );
  const keepArea = useCallback(
    (node: HTMLDivElement | null) => {
      setScrollElement(node);
      areaRef(node);
    },
    [areaRef],
  );
  const virtual = useVirtualRows({ count: visibleParts.length, scrollElement });

  return (
    <>
      <TableSortBar columns={columns} sort={sort} onSortChange={onSortChange} />
      <ListArea ref={keepArea} resetKey={page}>
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <SortableTableHead
                column="part"
                label="Repuesto"
                sort={sort}
                onSortChange={onSortChange}
              />
              <SortableTableHead
                column="category"
                label="Categoría"
                sort={sort}
                onSortChange={onSortChange}
                className="hidden md:table-cell"
              />
              <SortableTableHead
                column="location"
                label="Ubicación"
                sort={sort}
                onSortChange={onSortChange}
                className="hidden lg:table-cell"
              />
              <SortableTableHead
                column="stock"
                label="Stock"
                sort={sort}
                onSortChange={onSortChange}
              />
              <SortableTableHead
                column="minStock"
                label="Mínimo"
                sort={sort}
                onSortChange={onSortChange}
                align="right"
                className="hidden sm:table-cell text-right"
              />
              <SortableTableHead
                column="price"
                label="Precio"
                sort={sort}
                onSortChange={onSortChange}
                align="right"
                className="hidden xl:table-cell text-right"
              />
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {virtual.active && virtual.paddingTop > 0 && (
              <tr aria-hidden="true">
                <td colSpan={7} style={{ height: virtual.paddingTop }} />
              </tr>
            )}
            {virtual.indices.map((index) => {
              const part = visibleParts[index];
              if (!part) return null;
              return (
                <PartRow
                  key={part._id}
                  rowIndex={virtual.active ? index : undefined}
                  rowRef={virtual.active ? virtual.measureElement : undefined}
                  part={part}
                  canManage={canManage}
                  catalogModels={catalogModels}
                  onQuickAdjust={onQuickAdjust}
                  onEdit={onEdit}
                  onStockAdjust={onStockAdjust}
                  onDelete={onDelete}
                  onPrintLabel={onPrintLabel}
                />
              );
            })}
            {virtual.active && virtual.paddingBottom > 0 && (
              <tr aria-hidden="true">
                <td colSpan={7} style={{ height: virtual.paddingBottom }} />
              </tr>
            )}
          </TableBody>
        </Table>
      </ListArea>
    </>
  );
}
