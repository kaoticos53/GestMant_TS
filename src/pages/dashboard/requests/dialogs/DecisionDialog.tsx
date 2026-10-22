import { CircleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DecisionDialogFooter } from "./decisionDialog/components/DecisionDialogFooter";
import { DecisionIssueBatchPanel } from "./decisionDialog/components/DecisionIssueBatchPanel";
import { DecisionNoteField } from "./decisionDialog/components/DecisionNoteField";
import { DecisionStockApprovalPanel } from "./decisionDialog/components/DecisionStockApprovalPanel";
import { useDecisionDialogState } from "./decisionDialog/hooks/useDecisionDialogState";
import type { DecisionDialogProps } from "./decisionDialog/types";

export function DecisionDialog({
  request,
  mode,
  parts,
  canPurchase,
  onClose,
}: DecisionDialogProps) {
  const {
    note,
    setNote,
    entrega,
    handleChangeDelivery,
    busy,
    error,
    meta,
    DecisionIcon,
    partById,
    shortages,
    isApprove,
    isIssue,
    entregandoAhora,
    missingReference,
    blocked,
    compradas,
    handlePurchase,
    handleConfirm,
  } = useDecisionDialogState({
    request,
    mode,
    parts,
    canPurchase,
    onClose,
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{meta.title}</DialogTitle>
          <DialogDescription>
            {request.reference} · {request.requesterName}
            {request.requesterTeam ? ` · ${request.requesterTeam}` : ""}
          </DialogDescription>
        </DialogHeader>

        {missingReference ? (
          <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2.5 text-sm leading-6 text-amber-800">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            Esta petición no tiene ningún repuesto asociado. Asocia el repuesto
            (del catálogo o creando uno nuevo) antes de aprobar.
          </p>
        ) : isApprove ? (
          <DecisionStockApprovalPanel
            lines={request.lines}
            partById={partById}
            shortages={shortages}
            compradas={compradas}
            canPurchase={canPurchase}
            busy={busy}
            onPurchase={() => void handlePurchase()}
          />
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            {meta.description}
          </p>
        )}

        {isIssue && (
          <DecisionIssueBatchPanel
            lines={request.lines}
            requestStatus={request.status}
            entrega={entrega}
            busy={busy}
            onChangeDelivery={handleChangeDelivery}
          />
        )}

        <DecisionNoteField
          label={meta.label}
          placeholder={meta.placeholder}
          value={note}
          busy={busy}
          onChange={setNote}
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DecisionDialogFooter
          busy={busy}
          blocked={blocked}
          disabledConfirm={isIssue && entregandoAhora === 0}
          confirmLabel={meta.confirm}
          DecisionIcon={DecisionIcon}
          onClose={onClose}
          onConfirm={() => void handleConfirm()}
        />
      </DialogContent>
    </Dialog>
  );
}
