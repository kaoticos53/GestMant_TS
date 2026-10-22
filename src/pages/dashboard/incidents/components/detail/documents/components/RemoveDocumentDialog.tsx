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
import type { RemoveDocumentDialogProps } from "../types";

export function RemoveDocumentDialog({
  deletingDocument,
  reference,
  removingDoc,
  onCancel,
  onConfirm,
}: RemoveDocumentDialogProps) {
  if (!deletingDocument) return null;

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !removingDoc) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            ¿Quitar «{deletingDocument.name}» del expediente?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Dejará de estar en la ficha de {reference}. El rastro de
            cambios conserva quién lo quitó, cuándo y con qué nombre estaba.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={removingDoc} onClick={onCancel}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={removingDoc}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {removingDoc ? "Quitando..." : "Quitar documento"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
