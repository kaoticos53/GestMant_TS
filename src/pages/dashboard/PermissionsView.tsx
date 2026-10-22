import { Plus, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";

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
export function PermissionsView() {
  const roles = useQuery(api.permissions.listRoles);
  const setRolePermissions = useMutation(api.permissions.setRolePermissions);
  const deleteRole = useMutation(api.permissions.deleteRole);

  const matrix = usePermissionsMatrix({
    roles,
    setRolePermissions,
  });

  const roleMgmt = useRoleManagement({
    deleteRoleMutation: deleteRole,
    onRoleDeleted: matrix.removeRoleFromDraft,
  });

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
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <ShieldCheck className="size-5 text-signal" />
            Roles y permisos
          </h2>
          <p className="text-sm text-muted-foreground">
            Crea los roles del taller y decide en la matriz qué ve y qué puede
            modificar cada uno. Los cambios se aplican al instante en el menú y
            en las acciones del backend.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        <p className="flex items-center gap-2 text-sm font-medium text-signal">
          <ShieldCheck className="size-4" />
          El administrador siempre tiene todas las capacidades
        </p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Los roles del sistema (Administrador, Responsable y Técnico) no se
          borran ni se renombran; los personalizados sí. Las capacidades con
          candado solo las tiene el administrador y un rol nuevo parte de la
          plantilla que elijas. Las de modificar se comprueban en el backend de
          cada módulo; las de «ver» deciden qué módulos aparecen en el menú y en
          el resumen.
        </p>
      </div>

      <PermissionsTable
        roles={roles}
        current={matrix.current}
        saving={matrix.saving}
        onToggle={matrix.toggle}
        onEditRole={roleMgmt.openEditRole}
        onDuplicateRole={(role) => roleMgmt.openNewRole(role)}
        onDeleteRole={roleMgmt.openDeleteRole}
      />

      <PermissionsStats roles={roles} current={matrix.current} />

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
