import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !deleteBusy) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            ¿Borrar el rol «{deleting.label}»?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {deleting.userCount > 0
              ? `Tienen este rol ${deleting.userCount} ${
                  deleting.userCount === 1 ? "persona" : "personas"
                }. Reasígnalas desde el módulo de usuarios antes de borrarlo.`
              : "Se borrarán sus permisos y dejará de aparecer en la lista de roles. Esta acción no se puede deshacer."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteBusy}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={deleteBusy}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {deleteBusy ? "Borrando..." : "Borrar rol"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
