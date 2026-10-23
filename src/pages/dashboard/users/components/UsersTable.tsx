import type { Ref } from "react";
import { Users } from "lucide-react";
import { ListArea } from "@/components/ListArea";
import { TablePagination } from "@/components/TablePagination";
import { SortableTableHead, TableSortBar } from "@/components/TableSort";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TableSort } from "@/lib/tableSort";
import type { Paging } from "@/lib/pagination";
import type { Id } from "@/convex/_generated/dataModel";
import { UserTableRow } from "./UserTableRow";
import type { Member, RoleOption } from "../types";
import {
  formatActiveUsersDetail,
  type UserColumnKey,
  type UserTableColumns,
} from "../helpers";

export interface UsersTableProps {
  columns: UserTableColumns;
  sort: TableSort<UserColumnKey> | null;
  onSortChange: (sort: TableSort<UserColumnKey> | null) => void;
  areaRef?: Ref<HTMLDivElement>;
  paging: Paging & { setPage: (page: number) => void };
  visibleMembers: Member[];
  currentUserId: Id<"users"> | null | undefined;
  roleOptions: RoleOption[];
  roleLabelOf: (key: string | null) => string;
  activeCount: number;
  onChangeRole: (userId: Id<"users">, role: string) => Promise<void>;
  onEdit: (member: Member) => void;
  onToggleActive: (member: Member) => Promise<void>;
}

/**
 * Tabla ordenable y paginada de usuarios con cabeceras interactivas y recuento de estado.
 */
export function UsersTable({
  columns,
  sort,
  onSortChange,
  areaRef,
  paging,
  visibleMembers,
  currentUserId,
  roleOptions,
  roleLabelOf,
  activeCount,
  onChangeRole,
  onEdit,
  onToggleActive,
}: UsersTableProps) {
  return (
    <div className="rounded-xl border border-border/70 bg-card shadow-sm">
      <TableSortBar columns={columns} sort={sort} onSortChange={onSortChange} />
      <ListArea ref={areaRef} resetKey={paging.page}>
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <SortableTableHead
                column="member"
                label="Usuario"
                sort={sort}
                onSortChange={onSortChange}
              />
              <SortableTableHead
                column="position"
                label="Puesto y ubicación"
                sort={sort}
                onSortChange={onSortChange}
                className="hidden md:table-cell"
              />
              <SortableTableHead
                column="role"
                label="Rol"
                sort={sort}
                onSortChange={onSortChange}
                className="hidden sm:table-cell"
              />
              <SortableTableHead
                column="state"
                label="Estado"
                sort={sort}
                onSortChange={onSortChange}
                align="right"
                className="text-right"
              />
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleMembers.map((member) => (
              <UserTableRow
                key={member._id}
                member={member}
                isSelf={member._id === currentUserId}
                roleOptions={roleOptions}
                roleLabelOf={roleLabelOf}
                onChangeRole={onChangeRole}
                onEdit={onEdit}
                onToggleActive={onToggleActive}
              />
            ))}
          </TableBody>
        </Table>
      </ListArea>

      <TablePagination
        paging={paging}
        singular="usuario"
        plural="usuarios"
        detail={
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5" aria-hidden="true" />
            {formatActiveUsersDetail(activeCount)}
          </span>
        }
      />
    </div>
  );
}
