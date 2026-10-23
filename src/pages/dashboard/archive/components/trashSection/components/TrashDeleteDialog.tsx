import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
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
    <DestructiveConfirmDialog
      open={deletingRow !== null}
      onClose={onClose}
      busy={busyId !== null}
      title={`¿Borrar ${deletingRow?.item.reference} definitivamente?`}
      description={getTrashDeleteDialogDescription(deletingRow?.kind)}
      confirmIcon={<Trash2 className="size-4" />}
      confirmLabel="Borrar definitivamente"
      onConfirm={onConfirmDelete}
    />
  );
}
