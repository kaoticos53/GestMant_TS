import { IncidentActionButtons } from "./actions/components/IncidentActionButtons";
import { IncidentActionsFootnote } from "./actions/components/IncidentActionsFootnote";
import { IncidentExportDropdown } from "./actions/components/IncidentExportDropdown";
import { IncidentTransitionDialogs } from "./actions/dialogs/IncidentTransitionDialogs";
import { WithdrawIncidentDialog } from "./actions/dialogs/WithdrawIncidentDialog";
import { useIncidentActions } from "./actions/hooks/useIncidentActions";
import type { IncidentActionsBarProps } from "./actions/types";

export type { IncidentActionsBarProps };

export function IncidentActionsBar(props: IncidentActionsBarProps) {
  const {
    incident,
    equipment,
    currentUserId,
    currentUserName,
    canWork,
    canCoordinate,
    canReassignWorkshop,
    inWorkshop,
    archived,
    withdrawn,
    trailPending,
    onClose,
  } = props;

  const {
    busy,
    exportState,
    assignTarget,
    setAssignTarget,
    withdrawOpen,
    setWithdrawOpen,
    withdrawReason,
    setWithdrawReason,
    verifyOpen,
    setVerifyOpen,
    closeOpen,
    setCloseOpen,
    sendExternalOpen,
    setSendExternalOpen,
    receiveExternalOpen,
    setReceiveExternalOpen,
    requestOpen,
    setRequestOpen,
    handleSelfAssign,
    handleArchive,
    handleWithdraw,
  } = useIncidentActions(props);

  return (
    <>
      <div className="sticky bottom-0 z-20 border-t border-border/70 bg-background/95 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="flex flex-wrap justify-end gap-2">
          <IncidentExportDropdown
            reference={incident.reference}
            trailPending={trailPending}
            preparingPdf={exportState.preparingPdf}
            preparingPackage={exportState.preparingPackage}
            onDownloadReport={exportState.handleDownloadReport}
            onDownloadReportPdf={() =>
              void exportState.handleDownloadReportPdf()
            }
            onDownloadReportPackage={() =>
              void exportState.handleDownloadReportPackage()
            }
          />

          <IncidentActionButtons
            incident={incident}
            status={incident.status}
            currentUserId={currentUserId}
            canWork={canWork}
            canCoordinate={canCoordinate}
            canReassignWorkshop={canReassignWorkshop}
            inWorkshop={inWorkshop}
            busy={busy}
            onClose={onClose}
            onSelfAssign={handleSelfAssign}
            onOpenAssign={setAssignTarget}
            onOpenVerify={() => setVerifyOpen(true)}
            onOpenRequest={() => setRequestOpen(true)}
            onArchive={() => void handleArchive()}
            onOpenWithdraw={() => setWithdrawOpen(true)}
            onOpenSendExternal={() => setSendExternalOpen(true)}
            onOpenReceiveExternal={() => setReceiveExternalOpen(true)}
            onOpenClose={() => setCloseOpen(true)}
          />
        </div>

        <IncidentActionsFootnote
          status={incident.status}
          withdrawn={withdrawn}
          archived={archived}
          canWork={canWork}
        />
      </div>

      <IncidentTransitionDialogs
        incident={incident}
        equipment={equipment}
        currentUserName={currentUserName}
        assignTarget={assignTarget}
        verifyOpen={verifyOpen}
        closeOpen={closeOpen}
        requestOpen={requestOpen}
        sendExternalOpen={sendExternalOpen}
        receiveExternalOpen={receiveExternalOpen}
        onCloseAssign={() => setAssignTarget(null)}
        onCloseVerify={() => setVerifyOpen(false)}
        onCloseClose={() => setCloseOpen(false)}
        onCloseRequest={() => setRequestOpen(false)}
        onCloseSendExternal={() => setSendExternalOpen(false)}
        onCloseReceiveExternal={() => setReceiveExternalOpen(false)}
      />

      {withdrawOpen && (
        <WithdrawIncidentDialog
          reference={incident.reference}
          reason={withdrawReason}
          busy={busy}
          onChangeReason={setWithdrawReason}
          onConfirm={() => void handleWithdraw()}
          onClose={() => {
            setWithdrawOpen(false);
            setWithdrawReason("");
          }}
        />
      )}
    </>
  );
}
