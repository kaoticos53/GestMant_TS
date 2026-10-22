import type { EquipmentDoc, IncidentDoc } from "../../../types";

export interface IncidentEquipmentCardProps {
  incident: IncidentDoc;
  linkedEquipment: EquipmentDoc | null;
  canWork: boolean;
  inWorkshop: boolean;
  onCorrectEquipment: () => void;
  onCreateEquipment: () => void;
}

export interface IncidentNotificationSectionProps {
  incident: IncidentDoc;
  linkedEquipment: EquipmentDoc | null;
  canWork: boolean;
  onCorrectEquipment: () => void;
  onCreateEquipment: () => void;
}

export interface IncidentAssignmentSectionProps {
  incident: IncidentDoc;
  inWorkshop: boolean;
}

export interface IncidentExternalRepairSectionProps {
  incident: IncidentDoc;
}
