import { Plus, RotateCcw, Save, ShieldCheck, Workflow, X } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { ADMIN_KEY } from "@/lib/permissionsDraft";

import { DeleteRoleDialog } from "./permissions/components/DeleteRoleDialog";
import { PermissionsStats } from "./permissions/components/PermissionsStats";
import { PermissionsTable } from "./permissions/components/PermissionsTable";
import { RoleDialog } from "./permissions/components/RoleDialog";
import { usePermissionsMatrix } from "./permissions/hooks/usePermissionsMatrix";
import { useRoleManagement } from "./permissions/hooks/useRoleManagement";
import type { DialogState, RoleInfo } from "./permissions/types";

export type { RoleInfo, DialogState };

/**
 * Roles y permisos (solo administrador): matriz de qué puede ver y modificar
 * cada rol, más el alta, renombrado, duplicado y borrado de roles. Los
 * cambios se aplican de inmediato en el menú y en las acciones del backend.
 */
export function PermissionsView({
  onOpenMachines,
  onOpenRoleUsers,
}: {
  onOpenMachines?: () => void;
  onOpenRoleUsers?: (roleKey: string) => void;
} = {}) {
  const roles = useQuery(api.permissions.listRoles);
  const setManyRolePermissions = useMutation(
    api.permissions.setManyRolePermissions,
  );
  const deleteRole = useMutation(api.permissions.deleteRole);

  const matrix = usePermissionsMatrix({
    roles,
    setManyRolePermissions,
  });

  const roleMgmt = useRoleManagement({
    deleteRoleMutation: deleteRole,
    onRoleDeleted: matrix.removeRoleFromDraft,
  });

  useUnsavedChangesGuard(matrix.dirty);
  // La columna del administrador no se edita: se puede plegar para ganar sitio.
  const [showAdminColumn, setShowAdminColumn] = useState(true);

  if (!matrix.current || !roles) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-6 shadow-sm">
        <div className="h-8 w-56 animate-pulse rounded bg-muted" />
        <div className="mt-4 space-y-2">
          <div className="h-10 rounded-lg bg-muted/60" />
          <div className="h-10 rounded-lg bg-muted/60" />
          <div className="h-10 rounded-lg bg-muted/60" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Crea los roles del taller y decide en la matriz qué ve y qué puede
          modificar cada uno. Los cambios se aplican al instante en el menú y en
          las acciones del backend.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {onOpenMachines && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground"
              onClick={onOpenMachines}
            >
              <Workflow className="size-4" />
              Flujos y estados
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={matrix.restoreDefaults}
            disabled={matrix.saving || !matrix.canRestore}
          >
            <RotateCcw className="size-4" />
            Restaurar sistema
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => roleMgmt.openNewRole()}
            disabled={matrix.saving}
          >
            <Plus className="size-4" />
            Nuevo rol
          </Button>
          <Button
            type="button"
            className="gap-2"
            onClick={matrix.saveChanges}
            disabled={!matrix.dirty || matrix.saving}
          >
            <Save className="size-4" />
            {matrix.saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-signal/25 bg-signal/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-medium text-signal">
            <ShieldCheck className="size-4" />
            El administrador siempre tiene todas las capacidades
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            aria-pressed={showAdminColumn}
            onClick={() => setShowAdminColumn((prev) => !prev)}
          >
            {showAdminColumn
              ? "Ocultar columna de Administrador"
              : "Mostrar columna de Administrador"}
          </Button>
        </div>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Los roles del sistema (Administrador, Responsable y Técnico) no se
          borran ni se renombran, pero puedes duplicarlos como punto de partida
          de un rol personalizado. Las capacidades con candado solo las tiene el
          administrador. Las de modificar se comprueban en el backend de cada
          módulo; las de «ver» deciden qué módulos aparecen en el menú y en el
          resumen.
        </p>
      </div>

      <PermissionsTable
        roles={
          showAdminColumn
            ? roles
            : roles.filter((role) => role.key !== ADMIN_KEY)
        }
        current={matrix.current}
        saved={matrix.saved}
        saving={matrix.saving}
        onToggle={matrix.toggle}
        onEditRole={roleMgmt.openEditRole}
        onDuplicateRole={(role) => roleMgmt.openNewRole(role)}
        onDeleteRole={roleMgmt.openDeleteRole}
        onOpenRoleUsers={onOpenRoleUsers}
      />

      <PermissionsStats roles={roles} current={matrix.current} />

      {matrix.dirty && (
        <div
          role="region"
          aria-label="Cambios de permisos sin guardar"
          className="sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-signal/30 bg-background/95 px-4 py-3 shadow-lg backdrop-blur-sm"
        >
          <p className="text-sm font-medium">
            {matrix.dirtyCount === 1
              ? "1 cambio sin guardar en los permisos"
              : `${matrix.dirtyCount} cambios sin guardar en los permisos`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={matrix.discardChanges}
              disabled={matrix.saving}
            >
              <X className="size-4" />
              Descartar
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={matrix.saveChanges}
              disabled={matrix.saving}
            >
              <Save className="size-4" />
              {matrix.saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </div>
      )}

      {roleMgmt.dialog && (
        <RoleDialog
          state={roleMgmt.dialog}
          roles={roles}
          onClose={roleMgmt.closeDialog}
        />
      )}

      {roleMgmt.deleting && (
        <DeleteRoleDialog
          deleting={roleMgmt.deleting}
          deleteBusy={roleMgmt.deleteBusy}
          onCancel={roleMgmt.closeDeleteDialog}
          onConfirm={roleMgmt.confirmDelete}
        />
      )}
    </div>
  );
}
