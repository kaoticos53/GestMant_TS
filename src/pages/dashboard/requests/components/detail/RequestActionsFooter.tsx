import { SheetFooter } from "@/components/ui/sheet";
import {
  RequestWithdrawDialog,
  RequestWorkflowButtons,
  computeRequestActionFlags,
} from "./actions";
import type { RequestActionsFooterProps } from "./actions";

export type { RequestActionsFooterProps };

export function RequestActionsFooter({
  request,
  readOnly,
  reference,
  noReference,
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
  withdrawOpen,
  setWithdrawOpen,
  withdrawReason,
  setWithdrawReason,
  onWithdraw,
}: RequestActionsFooterProps) {
  const flags = computeRequestActionFlags(
    request.status,
    noReference,
    readOnly,
  );

  return (
    <>
      <SheetFooter className="sticky bottom-0 z-20 border-t border-border/70 bg-background/95 px-4 py-4 backdrop-blur-sm sm:px-6">
        <RequestWorkflowButtons
          request={request}
          flags={flags}
          onClose={onClose}
          onReject={onReject}
          onApprove={onApprove}
          onAssociate={onAssociate}
          onIssue={onIssue}
          onHold={onHold}
          onResume={onResume}
          resuming={resuming}
          onReturn={onReturn}
          onCancel={onCancel}
          archiving={archiving}
          onArchive={onArchive}
          withdrawing={withdrawing}
          onOpenWithdraw={() => setWithdrawOpen(true)}
        />
      </SheetFooter>

      <RequestWithdrawDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        reference={reference}
        withdrawReason={withdrawReason}
        onWithdrawReasonChange={setWithdrawReason}
        withdrawing={withdrawing}
        onWithdraw={onWithdraw}
      />
    </>
  );
}
