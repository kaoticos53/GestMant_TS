import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import type { WeeklyReportDialogFooterProps } from "../types";

export function WeeklyReportDialogFooter({
  sending,
  saving,
  settingsLoaded,
  rolesLoaded,
  onClose,
  onSendNow,
  onSave,
}: WeeklyReportDialogFooterProps) {
  return (
    <DialogFooter>
      <Button
        type="button"
        variant="outline"
        disabled={sending}
        onClick={onClose}
      >
        Cerrar
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="gap-2"
        disabled={sending || !settingsLoaded}
        onClick={onSendNow}
      >
        {sending ? "Enviando..." : "Enviar ahora"}
      </Button>
      <Button
        type="button"
        disabled={saving || !settingsLoaded || !rolesLoaded}
        onClick={onSave}
      >
        {saving ? "Guardando..." : "Guardar ajustes"}
      </Button>
    </DialogFooter>
  );
}
