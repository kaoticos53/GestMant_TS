import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
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
    <DestructiveConfirmDialog
      onClose={onCancel}
      busy={removingNote}
      title="¿Retirar la nota?"
      description={`Sale del cuaderno de ${reference}, pero no se pierde: podrás recuperarla desde la propia ficha si te has equivocado. El resto de notas y el historial de estados no cambian.`}
      confirmLabel="Retirar nota"
      busyLabel="Retirando..."
      onConfirm={onConfirm}
    />
  );
}
