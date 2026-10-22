import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { getMaintenanceSubmitLabel } from "../helpers";
import type { MaintenanceDialogFooterProps } from "../types";

export function MaintenanceDialogFooter({
  busy,
  isEdit,
  onClose,
  onSubmit,
}: MaintenanceDialogFooterProps) {
  const submitLabel = getMaintenanceSubmitLabel(busy, isEdit);

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
      <Button type="button" onClick={onSubmit} disabled={busy}>
        {submitLabel}
      </Button>
    </DialogFooter>
  );
}
