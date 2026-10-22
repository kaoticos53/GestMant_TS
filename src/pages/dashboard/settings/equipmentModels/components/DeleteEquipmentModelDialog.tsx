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
import type { EquipmentModelDoc } from "../types";

export interface DeleteEquipmentModelDialogProps {
  model: EquipmentModelDoc | null;
  cannotDeleteReason: string | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteEquipmentModelDialog({
  model,
  cannotDeleteReason,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteEquipmentModelDialogProps) {
  if (!model) return null;

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {cannotDeleteReason
              ? "No se puede eliminar el modelo"
              : `¿Eliminar el modelo «${model.model}»?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {cannotDeleteReason ? (
              <span className="text-destructive font-medium block">
                {cannotDeleteReason}
              </span>
            ) : (
              <span>
                Esta acción eliminará la ficha técnica del modelo «{model.model}»
                del catálogo maestro. Si existen repuestos compatibles que citan
                este modelo, quedarán desvinculados automáticamente.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting} onClick={onClose}>
            {cannotDeleteReason ? "Cerrar" : "Cancelar"}
          </AlertDialogCancel>
          {!cannotDeleteReason && (
            <AlertDialogAction
              onClick={onConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Eliminando..." : "Eliminar modelo"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
