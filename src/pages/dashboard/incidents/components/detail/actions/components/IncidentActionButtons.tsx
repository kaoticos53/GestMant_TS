import { Button } from "@/components/ui/button";
import type { Id } from "@/convex/_generated/dataModel";
import type { IncidentStatus } from "@/lib/workshop";
import { computeIncidentActionStates } from "../helpers";
import type { AssignTargetMode } from "../types";
import { IncidentAssignmentActions } from "./IncidentAssignmentActions";
import { IncidentLifecycleActions } from "./IncidentLifecycleActions";
import { IncidentLogisticsActions } from "./IncidentLogisticsActions";
import { IncidentWorkflowActions } from "./IncidentWorkflowActions";

export interface IncidentActionButtonsProps {
  status: IncidentStatus;
  currentUserId: Id<"users"> | null;
  canWork: boolean;
  canCoordinate: boolean;
  canReassignWorkshop: boolean;
  inWorkshop: boolean;
  busy: boolean;
  onClose: () => void;
  onSelfAssign: () => void;
  onOpenAssign: (mode: AssignTargetMode) => void;
  onOpenVerify: () => void;
  onOpenRequest: () => void;
  onArchive: () => void;
  onOpenWithdraw: () => void;
  onOpenSendExternal: () => void;
  onOpenReceiveExternal: () => void;
  onOpenClose: () => void;
}

export function IncidentActionButtons({
  status,
  currentUserId,
  canWork,
  canCoordinate,
  canReassignWorkshop,
  inWorkshop,
  busy,
  onClose,
  onSelfAssign,
  onOpenAssign,
  onOpenVerify,
  onOpenRequest,
  onArchive,
  onOpenWithdraw,
  onOpenSendExternal,
  onOpenReceiveExternal,
  onOpenClose,
}: IncidentActionButtonsProps) {
  const states = computeIncidentActionStates({
    status,
    canWork,
    canCoordinate,
    inWorkshop,
  });

  return (
    <>
      <Button type="button" variant="ghost" onClick={onClose}>
        Cerrar
      </Button>

      <IncidentAssignmentActions
        showSelfAssign={states.showSelfAssign}
        canCoordinate={canCoordinate}
        canReassignWorkshop={canReassignWorkshop}
        busy={busy}
        currentUserId={currentUserId}
        onSelfAssign={onSelfAssign}
        onOpenAssign={onOpenAssign}
      />

      <IncidentWorkflowActions
        showVerify={states.showVerify}
        showCloseResolved={states.showCloseResolved}
        canCoordinate={canCoordinate}
        onOpenAssign={onOpenAssign}
        onOpenVerify={onOpenVerify}
        onOpenClose={onOpenClose}
      />

      <IncidentLogisticsActions
        showPartRequests={states.showPartRequests}
        showSendExternal={states.showSendExternal}
        showReturnExternal={states.showReturnExternal}
        onOpenRequest={onOpenRequest}
        onOpenSendExternal={onOpenSendExternal}
        onOpenReceiveExternal={onOpenReceiveExternal}
      />

      <IncidentLifecycleActions
        showArchive={states.showArchive}
        canCoordinate={canCoordinate}
        busy={busy}
        onArchive={onArchive}
        onOpenWithdraw={onOpenWithdraw}
      />
    </>
  );
}
