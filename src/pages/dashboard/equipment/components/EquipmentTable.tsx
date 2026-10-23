import { useCallback, useState } from "react";
import { ListArea } from "@/components/ListArea";
import { SortableTableHead, TableSortBar } from "@/components/TableSort";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useVirtualRows } from "@/hooks/use-virtual-rows";
import type { EquipmentTableProps } from "../types";
import { EquipmentTableRow } from "./EquipmentTableRow";

export function EquipmentTable({
  columns,
  sort,
  onSortChange,
  areaRef,
  resetKey,
  visible,
  canManage,
  reviewOf,
  manualsOf,
  compatibleCount,
  onViewDetail,
  onPrintLabel,
  onDuplicate,
  onEdit,
  onDelete,
}: EquipmentTableProps) {
  // La caja que desplaza es la de `ListArea`; de sus medidas sale qué filas
  // asoman. La referencia se comparte con quien mide la tabla para paginar.
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );
  const keepArea = useCallback(
    (node: HTMLDivElement | null) => {
      setScrollElement(node);
      // La referencia es de quien mide la tabla: solo se le pasa el nodo.
      areaRef(node);
    },
    [areaRef],
  );
  const virtual = useVirtualRows({ count: visible.length, scrollElement });
  const indices = virtual.indices;

  return (
    <>
      <TableSortBar columns={columns} sort={sort} onSortChange={onSortChange} />
      <ListArea ref={keepArea} resetKey={resetKey}>
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <SortableTableHead
                column="equipment"
                label="Equipo"
                sort={sort}
                onSortChange={onSortChange}
              />
              <SortableTableHead
                column="brand"
                label="Marca"
                sort={sort}
                onSortChange={onSortChange}
                className="hidden md:table-cell"
              />
              <SortableTableHead
                column="serial"
                label="Nº de serie"
                sort={sort}
                onSortChange={onSortChange}
                className="hidden xl:table-cell"
              />
              <SortableTableHead
                column="location"
                label="Ubicación"
                sort={sort}
                onSortChange={onSortChange}
                className="hidden lg:table-cell"
              />
              <SortableTableHead
                column="manuals"
                label="Manuales"
                sort={sort}
                onSortChange={onSortChange}
                align="right"
                className="text-right"
              />
              <SortableTableHead
                column="parts"
                label="Repuestos compatibles"
                sort={sort}
                onSortChange={onSortChange}
                align="right"
                className="text-right"
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
            {indices.map((index) => {
              const item = visible[index];
              if (!item) return null;
              const review = reviewOf(item);
              const docs = manualsOf(item);
              return (
                <EquipmentTableRow
                  key={item._id}
                  rowIndex={virtual.active ? index : undefined}
                  rowRef={virtual.active ? virtual.measureElement : undefined}
                  item={item}
                  canManage={canManage}
                  reviewOverdue={review.state === "overdue"}
                  manualsCount={{
                    assigned: docs.assigned.length,
                    byModel: docs.byModel.length,
                    total: docs.assigned.length + docs.byModel.length,
                  }}
                  compatibleCount={compatibleCount(item)}
                  onViewDetail={onViewDetail}
                  onPrintLabel={onPrintLabel}
                  onDuplicate={onDuplicate}
                  onEdit={onEdit}
                  onDelete={onDelete}
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
