import type { Id } from "@/convex/_generated/dataModel";
import type { IncidentDoc } from "../../../../types";
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
  /** La ficha: las reglas de autorización se preguntan por ella. */
  incident: IncidentDoc;
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
  onArchive: () => void;
  onOpenWithdraw: () => void;
}
