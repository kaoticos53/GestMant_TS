import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  getSubmitButtonLabel,
  isSubmitDisabled,
  shouldShowSubmitIcon,
} from "../helpers";
import type { RequestDialogFooterProps } from "../types";

export function RequestDialogFooter({
  busy,
  isUploading,
  onClose,
  onSubmit,
}: RequestDialogFooterProps) {
  const submitDisabled = isSubmitDisabled(busy, isUploading);
  const submitLabel = getSubmitButtonLabel(busy, isUploading);
  const showIcon = shouldShowSubmitIcon(busy, isUploading);

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
        className="gap-2"
        onClick={onSubmit}
        disabled={submitDisabled}
      >
        {submitLabel}
        {showIcon && <ArrowRight className="size-4" />}
      </Button>
    </DialogFooter>
  );
}
