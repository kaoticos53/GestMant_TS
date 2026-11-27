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
import type { TableSort } from "@/lib/tableSort";
import type { ManualColumnId, ManualsColumns } from "../helpers/columns";
import type { EquipmentDoc, ManualDoc } from "../types";
import { ManualsTableRow } from "./ManualsTableRow";

export interface ManualsTableProps {
  columns: ManualsColumns;
  sort: TableSort<ManualColumnId> | null;
  onSortChange: (sort: TableSort<ManualColumnId> | null) => void;
  areaRef?: React.Ref<HTMLDivElement>;
  resetKey: number;
  visibleManuals: ManualDoc[];
  equipmentOf: (manual: ManualDoc) => EquipmentDoc | undefined;
  rights: { manage: boolean; userId: string | null };
  onOpenDetail: (manual: ManualDoc) => void;
  onEdit: (manual: ManualDoc) => void;
  onDelete: (manual: ManualDoc) => void;
}

/**
 * Entrega el nodo a una ref recibida por props, sea de función o de objeto.
 * Vive fuera del componente: asignar `.current` de una prop dentro del render
 * o de un callback del componente lo prohíbe la regla de inmutabilidad.
 */
function assignRef<T>(ref: React.Ref<T> | undefined, node: T | null): void {
  if (typeof ref === "function") {
    ref(node);
  } else if (ref && "current" in ref) {
    (ref as { current: T | null }).current = node;
  }
}

export function ManualsTable({
  columns,
  sort,
  onSortChange,
  areaRef,
  resetKey,
  visibleManuals,
  equipmentOf,
  rights,
  onOpenDetail,
  onEdit,
  onDelete,
}: ManualsTableProps) {
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );
  const keepArea = useCallback(
    (node: HTMLDivElement | null) => {
      setScrollElement(node);
      assignRef(areaRef, node);
    },
    [areaRef],
  );
  const virtual = useVirtualRows({ count: visibleManuals.length, scrollElement });

  return (
    <>
      <TableSortBar
        columns={columns}
        sort={sort}
        onSortChange={onSortChange}
      />
      <ListArea ref={keepArea} resetKey={resetKey}>
        <Table className="w-full">
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <SortableTableHead
                column="manual"
                label="Manual"
                sort={sort}
                onSortChange={onSortChange}
              />
              <SortableTableHead
                column="type"
                label="Tipo"
                sort={sort}
                onSortChange={onSortChange}
                className="hidden lg:table-cell"
              />
              <SortableTableHead
                column="brandModel"
                label="Marca y modelo"
                sort={sort}
                onSortChange={onSortChange}
                className="hidden md:table-cell"
              />
              <SortableTableHead
                column="equipment"
                label="Equipo"
                sort={sort}
                onSortChange={onSortChange}
                className="hidden xl:table-cell"
              />
              <SortableTableHead
                column="updated"
                label="Actualizado"
                sort={sort}
                onSortChange={onSortChange}
                className="hidden xl:table-cell"
              />
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {virtual.active && virtual.paddingTop > 0 && (
              <tr aria-hidden="true">
                <td colSpan={6} style={{ height: virtual.paddingTop }} />
              </tr>
            )}
            {virtual.indices.map((index) => {
              const manual = visibleManuals[index];
              if (!manual) return null;
              return (
                <ManualsTableRow
                  key={manual._id}
                  rowIndex={virtual.active ? index : undefined}
                  rowRef={virtual.active ? virtual.measureElement : undefined}
                  manual={manual}
                  linkedEquipment={equipmentOf(manual)}
                  rights={rights}
                  onOpenDetail={onOpenDetail}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              );
            })}
            {virtual.active && virtual.paddingBottom > 0 && (
              <tr aria-hidden="true">
                <td colSpan={6} style={{ height: virtual.paddingBottom }} />
              </tr>
            )}
          </TableBody>
        </Table>
      </ListArea>
    </>
  );
}
