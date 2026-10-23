import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SignaturePadFooterProps {
  onConfirm: () => void;
  canConfirm: boolean;
}

/**
 * Pie con botón de confirmación de firma y exportación de archivo.
 */
export function SignaturePadFooter({
  onConfirm,
  canConfirm,
}: SignaturePadFooterProps) {
  return (
    <div className="flex justify-end pt-1">
      <Button
        type="button"
        size="sm"
        onClick={onConfirm}
        disabled={!canConfirm}
        className="gap-1.5"
      >
        <Check className="size-4" />
        Confirmar firma
      </Button>
    </div>
  );
}
