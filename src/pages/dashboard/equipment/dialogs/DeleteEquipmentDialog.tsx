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
import type { EquipmentDoc } from "../types";

interface DeleteEquipmentDialogProps {
  item: EquipmentDoc | null;
  onClose: () => void;
}

/**
 * Diálogo modal accesible para confirmar la eliminación de un equipo del inventario.
 */
export function DeleteEquipmentDialog({
  item,
  onClose,
}: DeleteEquipmentDialogProps) {
  const removeEquipment = useMutation(api.equipment.remove);

  if (!item) return null;

  const handleDelete = async () => {
    try {
      await removeEquipment({ id: item._id });
      toast.success(`${equipmentLabel(item)} borrado del inventario`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      onClose();
    }
  };

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            ¿Borrar {equipmentLabel(item)}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Se borrará del inventario. Las peticiones que lo mencionen
            conservan su texto, pero dejarán de estar vinculadas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={() => void handleDelete()}
          >
            Borrar equipo
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
