import type { Id } from "@/convex/_generated/dataModel";
import type { AssignTargetMode } from "../types";

export interface IncidentAssignmentActionsProps {
  showSelfAssign: boolean;
  canCoordinate: boolean;
  canReassignWorkshop: boolean;
  busy: boolean;
  currentUserId: Id<"users"> | null;
  onSelfAssign: () => void;
  onOpenAssign: (mode: AssignTargetMode) => void;
}

export interface IncidentWorkflowActionsProps {
  showVerify: boolean;
  showCloseResolved: boolean;
  canCoordinate: boolean;
  onOpenAssign: (mode: AssignTargetMode) => void;
  onOpenVerify: () => void;
  onOpenClose: () => void;
}

export interface IncidentLogisticsActionsProps {
  showPartRequests: boolean;
  showSendExternal: boolean;
  showReturnExternal: boolean;
  onOpenRequest: () => void;
  onOpenSendExternal: () => void;
  onOpenReceiveExternal: () => void;
}

export interface IncidentLifecycleActionsProps {
  showArchive: boolean;
  canCoordinate: boolean;
  busy: boolean;
  onClose: () => void;
  onArchive: () => void;
  onOpenWithdraw: () => void;
}
