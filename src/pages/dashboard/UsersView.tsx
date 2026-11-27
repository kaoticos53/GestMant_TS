import { DataTableToolbar } from "@/components/DataTableToolbar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useRowsThatFit } from "@/hooks/use-rows-that-fit";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { sortRows } from "@/lib/tableSort";
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { UserDetailSheet } from "./users/components/UserDetailSheet";
import {
  UsersDialogs,
  UsersHeader,
  UsersSkeleton,
  UsersTable,
} from "./users/components";
import {
  createUserColumns,
  formatMemberRoles,
  getMemberRoleKeys,
  getRoleLabel,
} from "./users/helpers";
import { useUsersOperations } from "./users/hooks/useUsersOperations";
import type { Member, RoleOption } from "./users/types";

export interface UsersViewProps {
  initialRoleFilter?: string;
}

/**
 * Vista de administración de usuarios del taller: lista ordenable y paginada,
 * gestión de roles, alta de credenciales y edición de perfiles.
 */
export function UsersView({ initialRoleFilter = "all" }: UsersViewProps = {}) {
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
  const [resetTarget, setResetTarget] = useState<Member | null>(null);
  const [detailTarget, setDetailTarget] = useState<Member | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState(initialRoleFilter);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const {
    deactivating,
    setDeactivating,
    handleChangeRoles,
    handleToggleActive,
    handleConfirmDeactivate,
  } = useUsersOperations({ roleLabelOf });

  const columns = useMemo(() => createUserColumns(roleOptions), [roleOptions]);

  const [sort, setSort] = useTableSort({
    table: "users",
    columns,
    userId: currentUser?._id ?? null,
  });

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    const needle = search.trim().toLowerCase();
    return users.filter((member) => {
      if (
        roleFilter !== "all" &&
        !getMemberRoleKeys(member).includes(roleFilter)
      ) {
        return false;
      }
      if (statusFilter === "active" && !member.active) return false;
      if (statusFilter === "inactive" && member.active) return false;
      if (!needle) return true;
      return (
        (member.name ?? "").toLowerCase().includes(needle) ||
        (member.email ?? "").toLowerCase().includes(needle) ||
        (member.position ?? "").toLowerCase().includes(needle) ||
        (member.location ?? "").toLowerCase().includes(needle) ||
        formatMemberRoles(roleOptions, member).toLowerCase().includes(needle)
      );
    });
  }, [users, search, roleFilter, statusFilter, roleOptions]);

  const hasActiveFilters =
    search.trim() !== "" || roleFilter !== "all" || statusFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
  };

  const { areaRef, rowsFit } = useRowsThatFit();
  const paging = useTablePagination({
    total: filteredUsers.length,
    rowsFit,
    resetKey: `${search}|${roleFilter}|${statusFilter}`,
  });

  if (users === undefined) {
    return <UsersSkeleton />;
  }

  const activeCount = users.filter((member) => member.active).length;
  const rows = sortRows(
    filteredUsers,
    (member, column) => columns[column].value(member),
    sort,
  );
  const visible = rows.slice(paging.from - 1, paging.to);

  return (
    <div className="flex flex-col gap-4">
      <UsersHeader onCreateUser={() => setCreateOpen(true)} />

      <DataTableToolbar
        className="rounded-xl border border-border/70 bg-card shadow-sm"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nombre, correo, puesto o ubicación…"
        searchAriaLabel="Buscar usuarios"
        filters={
          <>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger
                className="w-full sm:w-44"
                aria-label="Filtrar por rol"
              >
                <SelectValue placeholder="Rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                {roleOptions.map((role) => (
                  <SelectItem key={role.key} value={role.key}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as "all" | "active" | "inactive")
              }
            >
              <SelectTrigger
                className="w-full sm:w-40"
                aria-label="Filtrar por estado"
              >
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        hasActiveFilters={hasActiveFilters}
        onResetFilters={clearFilters}
      />

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
        onChangeRoles={handleChangeRoles}
        onOpenDetail={setDetailTarget}
        onEdit={setEditing}
        onToggleActive={handleToggleActive}
        onResetPassword={setResetTarget}
      />

      <UserDetailSheet
        member={detailTarget}
        isSelf={detailTarget?._id === currentUser?._id}
        roleLabelOf={roleLabelOf}
        onClose={() => setDetailTarget(null)}
        onEdit={setEditing}
        onToggleActive={handleToggleActive}
        onResetPassword={setResetTarget}
      />

      <UsersDialogs
        createOpen={createOpen}
        onCreateClose={() => setCreateOpen(false)}
        editing={editing}
        onEditClose={() => setEditing(null)}
        roleOptions={roleOptions}
        currentUserId={currentUser?._id}
        deactivating={deactivating}
        onDeactivateClose={() => setDeactivating(null)}
        onConfirmDeactivate={handleConfirmDeactivate}
        resetting={resetTarget}
        onResetClose={() => setResetTarget(null)}
      />
    </div>
  );
}
