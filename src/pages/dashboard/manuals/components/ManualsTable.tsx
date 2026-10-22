import { ListArea } from "@/components/ListArea";
import { SortableTableHead, TableSortBar } from "@/components/TableSort";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  return (
    <>
      <TableSortBar
        columns={columns}
        sort={sort}
        onSortChange={onSortChange}
      />
      <ListArea ref={areaRef} resetKey={resetKey}>
        <Table>
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
            {visibleManuals.map((manual) => (
              <ManualsTableRow
                key={manual._id}
                manual={manual}
                linkedEquipment={equipmentOf(manual)}
                rights={rights}
                onOpenDetail={onOpenDetail}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </TableBody>
        </Table>
      </ListArea>
    </>
  );
}
