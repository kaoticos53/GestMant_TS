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
import { Trash2 } from "lucide-react";
import { getTrashDeleteDialogDescription } from "../helpers";
import type { TrashDeleteDialogProps } from "../types";

export function TrashDeleteDialog({
  deletingRow,
  busyId,
  onClose,
  onConfirmDelete,
}: TrashDeleteDialogProps) {
  return (
    <AlertDialog
      open={deletingRow !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            ¿Borrar {deletingRow?.item.reference} definitivamente?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {getTrashDeleteDialogDescription(deletingRow?.kind)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busyId !== null}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={busyId !== null}
            className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(event) => {
              event.preventDefault();
              void onConfirmDelete();
            }}
          >
            <Trash2 className="size-4" />
            {busyId !== null ? "Borrando..." : "Borrar definitivamente"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
