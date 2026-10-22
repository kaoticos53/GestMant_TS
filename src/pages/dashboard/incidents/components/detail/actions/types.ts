import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { EquipmentDoc, IncidentDoc } from "../../../types";


export type AssignTargetMode = "assign" | "workshop" | null;

export interface IncidentActionsBarProps {
  incident: IncidentDoc;
  equipment: EquipmentDoc[];
  linkedEquipment: EquipmentDoc | null;
  linkedRequests: Doc<"partRequests">[];
  trail: Doc<"incidentDocumentLog">[] | undefined;
  currentUserId: Id<"users"> | null;
  currentUserName: string;
  canWork: boolean;
  canCoordinate: boolean;
  canReassignWorkshop: boolean;
  inWorkshop: boolean;
  archived: boolean;
  withdrawn: boolean;
  trailPending: boolean;
  onClose: () => void;
}
