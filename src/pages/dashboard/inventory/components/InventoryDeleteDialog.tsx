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
import type { PartDoc } from "../types";

export interface InventoryDeleteDialogProps {
  part: PartDoc | null;
  onClose: () => void;
  onConfirm: (part: PartDoc) => void;
}

export function InventoryDeleteDialog({
  part,
  onClose,
  onConfirm,
}: InventoryDeleteDialogProps) {
  if (!part) return null;

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Borrar {part.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Se quitará del catálogo ({part.code}). Las peticiones históricas
            conservan su código y su nombre.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={() => onConfirm(part)}
          >
            Borrar repuesto
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
