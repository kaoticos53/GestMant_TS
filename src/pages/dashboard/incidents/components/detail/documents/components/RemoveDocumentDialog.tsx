import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
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
    <DestructiveConfirmDialog
      onClose={onCancel}
      busy={removingDoc}
      title={`¿Quitar «${deletingDocument.name}» del expediente?`}
      description={`Dejará de estar en la ficha de ${reference}. El rastro de cambios conserva quién lo quitó, cuándo y con qué nombre estaba.`}
      confirmLabel="Quitar documento"
      busyLabel="Quitando..."
      onConfirm={onConfirm}
    />
  );
}
