import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
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
    <DestructiveConfirmDialog
      onClose={onClose}
      busy={isDeleting}
      hideConfirm={Boolean(cannotDeleteReason)}
      title={
        cannotDeleteReason
          ? "No se puede eliminar el modelo"
          : `¿Eliminar el modelo «${model.model}»?`
      }
      description={
        cannotDeleteReason ? (
          <span className="text-destructive font-medium block">
            {cannotDeleteReason}
          </span>
        ) : (
          <span>
            Esta acción eliminará la ficha técnica del modelo «{model.model}»
            del catálogo maestro. Si existen repuestos compatibles que citan
            este modelo, quedarán desvinculados automáticamente.
          </span>
        )
      }
      cancelLabel={cannotDeleteReason ? "Cerrar" : "Cancelar"}
      confirmLabel="Eliminar modelo"
      busyLabel="Eliminando..."
      onConfirm={onConfirm}
    />
  );
}
