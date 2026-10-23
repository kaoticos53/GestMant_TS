import { Button } from "@/components/ui/button";
import { Archive, Trash2 } from "lucide-react";
import type { IncidentLifecycleActionsProps } from "./actionButtonsTypes";

export function IncidentLifecycleActions({
  showArchive,
  canCoordinate,
  busy,
  onArchive,
  onOpenWithdraw,
}: IncidentLifecycleActionsProps) {
  return (
    <>
      {showArchive && (
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={busy}
          onClick={onArchive}
        >
          <Archive className="size-4" />
          Archivar
        </Button>
      )}

      {canCoordinate && (
        <Button
          type="button"
          variant="outline"
          className="gap-2 text-destructive hover:text-destructive"
          disabled={busy}
          onClick={onOpenWithdraw}
          title="Se guarda unos días en la papelera antes de borrarse de verdad"
        >
          <Trash2 className="size-4" />
          Retirar
        </Button>
      )}
    </>
  );
}
