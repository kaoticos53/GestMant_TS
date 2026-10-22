import { AssociateDialog } from "../dialogs/AssociateDialog";
import { DecisionDialog } from "../dialogs/DecisionDialog";
import { NewRequestDialog } from "../dialogs/NewRequestDialog";
import { RequestDetailSheet } from "./RequestDetailSheet";
import type {
  DecisionMode,
  EquipmentDoc,
  PartDoc,
  RequestDoc,
} from "../types";

export function RequestsDialogs({
  decision,
  onCloseDecision,
  associateTarget,
  onCloseAssociate,
  openRequest,
  onCloseDetail,
  onOpenAssociate,
  onOpenDecision,
  onResumeRequest,
  resumingId,
  newOpen,
  onCloseNew,
  parts,
  equipment,
  canManage,
  canPurchase,
}: {
  decision: { request: RequestDoc; mode: DecisionMode } | null;
  onCloseDecision: () => void;
  associateTarget: RequestDoc | null;
  onCloseAssociate: () => void;
  openRequest: RequestDoc | null;
  onCloseDetail: () => void;
  onOpenAssociate: (request: RequestDoc) => void;
  onOpenDecision: (request: RequestDoc, mode: DecisionMode) => void;
  onResumeRequest: (request: RequestDoc) => void;
  resumingId: string | null;
  newOpen: boolean;
  onCloseNew: () => void;
  parts: PartDoc[];
  equipment: EquipmentDoc[];
  canManage: boolean;
  canPurchase: boolean;
}) {
  return (
    <>
      {decision && (
        <DecisionDialog
          request={decision.request}
          mode={decision.mode}
          parts={parts}
          canPurchase={canPurchase}
          onClose={onCloseDecision}
        />
      )}

      {associateTarget && (
        <AssociateDialog
          key={associateTarget._id}
          request={associateTarget}
          parts={parts}
          equipment={equipment}
          onClose={onCloseAssociate}
        />
      )}

      {openRequest && (
        <RequestDetailSheet
          request={openRequest}
          parts={parts}
          // Lo archivado se abre en solo lectura: su trabajo terminó y sus pasos
          // ya no se dan desde la cola. Quien quiera volver a tramitarla la
          // recupera desde Archivo, que es donde vive.
          canManage={canManage && openRequest.archivedAt === undefined}
          onClose={onCloseDetail}
          onAssociate={() => onOpenAssociate(openRequest)}
          onApprove={() => onOpenDecision(openRequest, "approve")}
          onReject={() => onOpenDecision(openRequest, "reject")}
          onIssue={() => onOpenDecision(openRequest, "issue")}
          onHold={() => onOpenDecision(openRequest, "hold")}
          onReturn={() => onOpenDecision(openRequest, "return")}
          onCancel={() => onOpenDecision(openRequest, "cancel")}
          onResume={() => onResumeRequest(openRequest)}
          resuming={resumingId === openRequest._id}
        />
      )}

      {newOpen && (
        <NewRequestDialog
          parts={parts}
          equipment={equipment}
          onClose={onCloseNew}
        />
      )}
    </>
  );
}
