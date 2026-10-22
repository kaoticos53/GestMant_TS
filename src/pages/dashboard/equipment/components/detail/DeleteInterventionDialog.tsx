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

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Borrar esta intervención?</AlertDialogTitle>
          <AlertDialogDescription>
            Se borrará del historial de {equipmentLabel(item)}. Esta acción no se
            puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={async () => {
              try {
                await removeRecord({ id: target._id });
                toast.success("Intervención borrada del historial");
              } catch (error) {
                toast.error(getErrorMessage(error));
              } finally {
                onClose();
              }
            }}
          >
            Borrar intervención
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
