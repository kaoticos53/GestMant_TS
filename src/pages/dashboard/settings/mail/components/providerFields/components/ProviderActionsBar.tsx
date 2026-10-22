import { Button } from "@/components/ui/button";
import type { ProviderActionsBarProps } from "../types";

export function ProviderActionsBar({
  validation,
  saving,
  onSave,
}: ProviderActionsBarProps) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
      {!validation.ok && (
        <p className="mr-auto text-xs leading-5 text-destructive">
          {validation.error}
        </p>
      )}
      <Button
        type="button"
        disabled={saving || !validation.ok}
        onClick={onSave}
      >
        {saving ? "Guardando..." : "Guardar correo"}
      </Button>
    </div>
  );
}
