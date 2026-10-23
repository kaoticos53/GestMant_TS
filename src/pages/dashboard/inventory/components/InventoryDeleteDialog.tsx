import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import type { PartDoc } from "../types";

export interface InventoryDeleteDialogProps {
  part: PartDoc | null;
  onClose: () => void;
  onConfirm: (part: PartDoc) => void | Promise<unknown>;
}

export function InventoryDeleteDialog({
  part,
  onClose,
  onConfirm,
}: InventoryDeleteDialogProps) {
  if (!part) return null;

  return (
    <DestructiveConfirmDialog
      onClose={onClose}
      title={`¿Borrar ${part.name}?`}
      description={`Se quitará del catálogo (${part.code}). Las peticiones históricas conservan su código y su nombre.`}
      confirmLabel="Borrar repuesto"
      onConfirm={() => onConfirm(part)}
    />
  );
}
