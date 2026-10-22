import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import type { DecisionDialogFooterProps } from "../types";

export function DecisionDialogFooter({
  busy,
  blocked,
  disabledConfirm,
  confirmLabel,
  DecisionIcon,
  onClose,
  onConfirm,
}: DecisionDialogFooterProps) {
  return (
    <DialogFooter>
      <Button
        type="button"
        variant="outline"
        onClick={onClose}
        disabled={busy}
      >
        Cancelar
      </Button>
      <Button
        type="button"
        onClick={onConfirm}
        disabled={busy || blocked || disabledConfirm}
        className="gap-2"
      >
        <DecisionIcon className="size-4" />
        {confirmLabel}
      </Button>
    </DialogFooter>
  );
}
