import { AssignDialog } from "../../../../dialogs/AssignDialog";
import { CloseDialog } from "../../../../dialogs/CloseDialog";
import { IncidentRequestDialog } from "../../../../dialogs/IncidentRequestDialog";
import { ReceiveFromExternalDialog } from "../../../../dialogs/ReceiveFromExternalDialog";
import { SendToExternalDialog } from "../../../../dialogs/SendToExternalDialog";
import { VerifyDialog } from "../../../../dialogs/VerifyDialog";
import type { EquipmentDoc, IncidentDoc } from "../../../../types";
import type { AssignTargetMode } from "../types";


interface IncidentTransitionDialogsProps {
  incident: IncidentDoc;
  equipment: EquipmentDoc[];
  currentUserName: string;
  assignTarget: AssignTargetMode;
  verifyOpen: boolean;
  closeOpen: boolean;
  requestOpen: boolean;
  sendExternalOpen: boolean;
  receiveExternalOpen: boolean;
  onCloseAssign: () => void;
  onCloseVerify: () => void;
  onCloseClose: () => void;
  onCloseRequest: () => void;
  onCloseSendExternal: () => void;
  onCloseReceiveExternal: () => void;
}

export function IncidentTransitionDialogs({
  incident,
  equipment,
  currentUserName,
  assignTarget,
  verifyOpen,
  closeOpen,
  requestOpen,
  sendExternalOpen,
  receiveExternalOpen,
  onCloseAssign,
  onCloseVerify,
  onCloseClose,
  onCloseRequest,
  onCloseSendExternal,
  onCloseReceiveExternal,
}: IncidentTransitionDialogsProps) {
  return (
    <>
      {assignTarget && (
        <AssignDialog
          incident={incident}
          mode={assignTarget}
          onClose={onCloseAssign}
        />
      )}

      {verifyOpen && (
        <VerifyDialog
          incident={incident}
          equipment={equipment}
          onClose={onCloseVerify}
        />
      )}

      {closeOpen && (
        <CloseDialog
          incident={incident}
          equipment={equipment}
          onClose={onCloseClose}
        />
      )}

      {requestOpen && (
        <IncidentRequestDialog
          incident={incident}
          currentUserName={currentUserName}
          onClose={onCloseRequest}
        />
      )}

      {sendExternalOpen && (
        <SendToExternalDialog
          incident={incident}
          onClose={onCloseSendExternal}
        />
      )}

      {receiveExternalOpen && (
        <ReceiveFromExternalDialog
          incident={incident}
          onClose={onCloseReceiveExternal}
        />
      )}
    </>
  );
}
