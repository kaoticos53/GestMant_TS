import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useRowsThatFit } from "@/hooks/use-rows-that-fit";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { sortRows } from "@/lib/tableSort";
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import {
  UsersDialogs,
  UsersHeader,
  UsersSkeleton,
  UsersTable,
} from "./users/components";
import { createUserColumns, getRoleLabel } from "./users/helpers";
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

  const roleLabelOf = (key: string | null) => getRoleLabel(roleOptions, key);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);

  const {
    deactivating,
    setDeactivating,
    handleChangeRole,
    handleToggleActive,
    handleConfirmDeactivate,
  } = useUsersOperations({ roleLabelOf });

  const columns = useMemo(() => createUserColumns(roleOptions), [roleOptions]);

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
    return <UsersSkeleton />;
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

      <UsersTable
        columns={columns}
        sort={sort}
        onSortChange={setSort}
        areaRef={areaRef}
        paging={paging}
        visibleMembers={visible}
        currentUserId={currentUser?._id}
        roleOptions={roleOptions}
        roleLabelOf={roleLabelOf}
        activeCount={activeCount}
        onChangeRole={handleChangeRole}
        onEdit={setEditing}
        onToggleActive={handleToggleActive}
      />

      <UsersDialogs
        createOpen={createOpen}
        onCreateClose={() => setCreateOpen(false)}
        editing={editing}
        onEditClose={() => setEditing(null)}
        deactivating={deactivating}
        onDeactivateClose={() => setDeactivating(null)}
        onConfirmDeactivate={handleConfirmDeactivate}
      />
    </div>
  );
}
