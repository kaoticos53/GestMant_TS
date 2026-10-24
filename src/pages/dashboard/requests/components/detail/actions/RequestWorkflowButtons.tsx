import { Can } from "@/components/AbilityProvider";
import { Button } from "@/components/ui/button";
import { asRequest } from "@/lib/abilities";
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
  request,
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
        <Can I="decide" this={asRequest(request)}>
          <Button type="button" variant="outline" onClick={onReject}>
            Rechazar
          </Button>
        </Can>
      )}

      {flags.canApprove &&
        (flags.needsAssociation ? (
          // Asociar la ficha es corregirla, no decidirla: por eso pide «update».
          <Can I="update" this={asRequest(request)}>
            <Button type="button" className="gap-2" onClick={onAssociate}>
              <Wrench className="size-4" />
              Asociar repuesto
            </Button>
          </Can>
        ) : (
          <Can I="decide" this={asRequest(request)}>
            <Button type="button" className="gap-2" onClick={onApprove}>
              <Check className="size-4" />
              Aprobar
            </Button>
          </Can>
        ))}

      {flags.canIssue && (
        <Can I="update" this={asRequest(request)}>
          <Button type="button" className="gap-2" onClick={onIssue}>
            <PackageCheck className="size-4" />
            Entregar material
          </Button>
        </Can>
      )}

      {flags.canHold && (
        <Can I="update" this={asRequest(request)}>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={onHold}
          >
            <CirclePause className="size-4" />
            En espera
          </Button>
        </Can>
      )}

      {flags.canResume && (
        <Can I="update" this={asRequest(request)}>
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
        </Can>
      )}

      {flags.canReturnMaterial && (
        <Can I="update" this={asRequest(request)}>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={onReturn}
          >
            <Undo2 className="size-4" />
            Devolver material
          </Button>
        </Can>
      )}

      {flags.canCancel && (
        <Can I="cancel" this={asRequest(request)}>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={onCancel}
          >
            <Ban className="size-4" />
            Cancelar petición
          </Button>
        </Can>
      )}

      {flags.canArchive && (
        <Can I="archive" this={asRequest(request)}>
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
        </Can>
      )}

      {flags.canWithdraw && (
        <Can I="delete" this={asRequest(request)}>
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
        </Can>
      )}
    </div>
  );
}
