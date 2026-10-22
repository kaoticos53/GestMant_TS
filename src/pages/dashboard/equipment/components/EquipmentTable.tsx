import { ListArea } from "@/components/ListArea";
import { SortableTableHead, TableSortBar } from "@/components/TableSort";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  onDuplicate,
  onEdit,
  onDelete,
}: EquipmentTableProps) {
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
            {visible.map((item) => {
              const review = reviewOf(item);
              const docs = manualsOf(item);
              return (
                <EquipmentTableRow
                  key={item._id}
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
                  onDuplicate={onDuplicate}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              );
            })}
          </TableBody>
        </Table>
      </ListArea>
    </>
  );
}
