import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { api } from "@/convex/_generated/api";
import { equipmentLabel, getErrorMessage } from "@/lib/workshop";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import type { EquipmentDoc, RecordDoc } from "../../types";

interface DeleteInterventionDialogProps {
  item: EquipmentDoc;
  target: RecordDoc | null;
  onClose: () => void;
}

/**
 * Diálogo modal accesible para confirmar la eliminación irreversible de una intervención de mantenimiento.
 */
export function DeleteInterventionDialog({
  item,
  target,
  onClose,
}: DeleteInterventionDialogProps) {
  const removeRecord = useMutation(api.maintenance.remove);

  if (!target) return null;

  const handleDelete = async () => {
    try {
      await removeRecord({ id: target._id });
      toast.success("Intervención borrada del historial");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      onClose();
    }
  };

  return (
    <DestructiveConfirmDialog
      onClose={onClose}
      title="¿Borrar esta intervención?"
      description={`Se borrará del historial de ${equipmentLabel(item)}. Esta acción no se puede deshacer.`}
      confirmLabel="Borrar intervención"
      onConfirm={handleDelete}
    />
  );
}
