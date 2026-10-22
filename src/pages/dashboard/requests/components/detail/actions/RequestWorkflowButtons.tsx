import { Button } from "@/components/ui/button";
import {
  Archive,
  Ban,
  Check,
  CirclePause,
  PackageCheck,
  RotateCcw,
  Trash2,
  Undo2,
  Wrench,
} from "lucide-react";
import type { RequestWorkflowButtonsProps } from "./types";

export function RequestWorkflowButtons({
  flags,
  onClose,
  onReject,
  onApprove,
  onAssociate,
  onIssue,
  onHold,
  onResume,
  resuming = false,
  onReturn,
  onCancel,
  archiving,
  onArchive,
  withdrawing,
  onOpenWithdraw,
}: RequestWorkflowButtonsProps) {
  return (
    <div className="flex w-full flex-wrap justify-end gap-2">
      <Button type="button" variant="ghost" onClick={onClose}>
        Cerrar
      </Button>

      {flags.canReject && (
        <Button type="button" variant="outline" onClick={onReject}>
          Rechazar
        </Button>
      )}

      {flags.canApprove &&
        (flags.needsAssociation ? (
          <Button type="button" className="gap-2" onClick={onAssociate}>
            <Wrench className="size-4" />
            Asociar repuesto
          </Button>
        ) : (
          <Button type="button" className="gap-2" onClick={onApprove}>
            <Check className="size-4" />
            Aprobar
          </Button>
        ))}

      {flags.canIssue && (
        <Button type="button" className="gap-2" onClick={onIssue}>
          <PackageCheck className="size-4" />
          Entregar material
        </Button>
      )}

      {flags.canHold && (
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={onHold}
        >
          <CirclePause className="size-4" />
          En espera
        </Button>
      )}

      {flags.canResume && (
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={resuming}
          onClick={onResume}
        >
          <RotateCcw className="size-4" />
          {resuming ? "Reanudando..." : "Reanudar"}
        </Button>
      )}

      {flags.canReturnMaterial && (
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={onReturn}
        >
          <Undo2 className="size-4" />
          Devolver material
        </Button>
      )}

      {flags.canCancel && (
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={onCancel}
        >
          <Ban className="size-4" />
          Cancelar petición
        </Button>
      )}

      {flags.canArchive && (
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={archiving}
          onClick={() => void onArchive()}
        >
          <Archive className="size-4" />
          Archivar
        </Button>
      )}

      {flags.canWithdraw && (
        <Button
          type="button"
          variant="outline"
          className="gap-2 text-destructive hover:text-destructive"
          disabled={withdrawing}
          onClick={onOpenWithdraw}
          title="Se guarda unos días en la papelera antes de borrarse de verdad"
        >
          <Trash2 className="size-4" />
          Retirar
        </Button>
      )}
    </div>
  );
}
