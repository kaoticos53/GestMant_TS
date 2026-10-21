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
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useRowsThatFit } from "@/hooks/use-rows-that-fit";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { fallbackRoleMeta } from "@/lib/roles";
import { sortRows } from "@/lib/tableSort";
import { useQuery } from "convex/react";
import { Users } from "lucide-react";
import { useMemo, useState } from "react";
import { UserTableRow } from "./users/components/UserTableRow";
import { UsersHeader } from "./users/components/UsersHeader";
import { CreateUserDialog } from "./users/dialogs/CreateUserDialog";
import { DeactivateDialog } from "./users/dialogs/DeactivateDialog";
import { EditUserDialog } from "./users/dialogs/EditUserDialog";
import { useUsersOperations } from "./users/hooks/useUsersOperations";
import type { Member, RoleOption } from "./users/types";

/**
 * Vista de administración de usuarios del taller: lista ordenable y paginada,
 * gestión de roles, alta de credenciales y edición de perfiles.
 */
export function UsersView() {
  const users = useQuery(api.members.list);
  const rawRoleOptions = useQuery(api.permissions.listRoles);
  const roleOptions: RoleOption[] = useMemo(
    () => rawRoleOptions ?? [],
    [rawRoleOptions],
  );
  const { user: currentUser } = useAuth();

  const roleLabelOf = (key: string | null) =>
    roleOptions.find((option) => option.key === key)?.label ??
    fallbackRoleMeta(key ?? "").label;

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);

  const {
    deactivating,
    setDeactivating,
    handleChangeRole,
    handleToggleActive,
    handleConfirmDeactivate,
  } = useUsersOperations({ roleLabelOf });

  const columns = useMemo(
    () =>
      ({
        member: {
          label: "Usuario",
          value: (member: Member) => member.name ?? member.email ?? "",
        },
        position: {
          label: "Puesto y ubicación",
          value: (member: Member) => member.position ?? "",
        },
        role: {
          label: "Rol",
          value: (member: Member) => roleLabelOf(member.role),
        },
        state: {
          label: "Estado",
          value: (member: Member) => (member.active ? "Activo" : "De baja"),
        },
      }) as const,
    [roleOptions],
  );

  const [sort, setSort] = useTableSort({
    table: "users",
    columns,
    userId: currentUser?._id ?? null,
  });

  const { areaRef, rowsFit } = useRowsThatFit();
  const paging = useTablePagination({
    total: users?.length ?? 0,
    rowsFit,
  });

  if (users === undefined) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-6 shadow-sm">
        <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-24 rounded-lg bg-muted/60" />
      </div>
    );
  }

  const activeCount = users.filter((member) => member.active).length;
  const rows = sortRows(
    users,
    (member, column) => columns[column].value(member),
    sort,
  );
  const visible = rows.slice(paging.from - 1, paging.to);

  return (
    <div className="flex flex-col gap-4">
      <UsersHeader onCreateUser={() => setCreateOpen(true)} />

      <div className="rounded-xl border border-border/70 bg-card shadow-sm">
        <TableSortBar columns={columns} sort={sort} onSortChange={setSort} />
        <ListArea ref={areaRef} resetKey={paging.page}>
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <SortableTableHead
                  column="member"
                  label="Usuario"
                  sort={sort}
                  onSortChange={setSort}
                />
                <SortableTableHead
                  column="position"
                  label="Puesto y ubicación"
                  sort={sort}
                  onSortChange={setSort}
                  className="hidden md:table-cell"
                />
                <SortableTableHead
                  column="role"
                  label="Rol"
                  sort={sort}
                  onSortChange={setSort}
                  className="hidden sm:table-cell"
                />
                <SortableTableHead
                  column="state"
                  label="Estado"
                  sort={sort}
                  onSortChange={setSort}
                  align="right"
                  className="text-right"
                />
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((member) => (
                <UserTableRow
                  key={member._id}
                  member={member}
                  isSelf={member._id === currentUser?._id}
                  roleOptions={roleOptions}
                  roleLabelOf={roleLabelOf}
                  onChangeRole={handleChangeRole}
                  onEdit={setEditing}
                  onToggleActive={handleToggleActive}
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
              {activeCount} con acceso · el administrador no puede cambiar su
              propio rol ni darse de baja
            </span>
          }
        />
      </div>

      {createOpen && <CreateUserDialog onClose={() => setCreateOpen(false)} />}
      {editing && (
        <EditUserDialog member={editing} onClose={() => setEditing(null)} />
      )}
      {deactivating && (
        <DeactivateDialog
          member={deactivating}
          onConfirm={handleConfirmDeactivate}
          onClose={() => setDeactivating(null)}
        />
      )}
    </div>
  );
}
