import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import type { RoleInfo } from "../types";

export interface DeleteRoleDialogProps {
  deleting: RoleInfo | null;
  deleteBusy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Diálogo de confirmación accesible para eliminar un rol personalizado
 * con aviso de prevención si tiene personas asignadas.
 */
export function DeleteRoleDialog({
  deleting,
  deleteBusy,
  onCancel,
  onConfirm,
}: DeleteRoleDialogProps) {
  if (!deleting) return null;

  return (
    <DestructiveConfirmDialog
      onClose={onCancel}
      busy={deleteBusy}
      title={`¿Borrar el rol «${deleting.label}»?`}
      description={
        deleting.userCount > 0
          ? `Tienen este rol ${deleting.userCount} ${
              deleting.userCount === 1 ? "persona" : "personas"
            }. Reasígnalas desde el módulo de usuarios antes de borrarlo.`
          : "Se borrarán sus permisos y dejará de aparecer en la lista de roles. Esta acción no se puede deshacer."
      }
      confirmLabel="Borrar rol"
      onConfirm={onConfirm}
    />
  );
}
