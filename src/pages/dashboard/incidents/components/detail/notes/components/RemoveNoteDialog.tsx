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
import type { RemoveNoteDialogProps } from "../types";

export function RemoveNoteDialog({
  open,
  reference,
  removingNote,
  onCancel,
  onConfirm,
}: RemoveNoteDialogProps) {
  if (!open) return null;

  return (
    <AlertDialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen && !removingNote) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Retirar la nota?</AlertDialogTitle>
          <AlertDialogDescription>
            Sale del cuaderno de {reference}, pero no se pierde: podrás
            recuperarla desde la propia ficha si te has equivocado. El resto de
            notas y el historial de estados no cambian.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={removingNote} onClick={onCancel}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={removingNote}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {removingNote ? "Retirando..." : "Retirar nota"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
