import {
  IncidentAssignmentSection,
  IncidentExternalRepairSection,
  IncidentNotificationSection,
} from "./equipment";
import type { IncidentEquipmentCardProps } from "./equipment";

export type { IncidentEquipmentCardProps };

export function IncidentEquipmentCard({
  incident,
  linkedEquipment,
  canWork,
  inWorkshop,
  onCorrectEquipment,
  onCreateEquipment,
}: IncidentEquipmentCardProps) {
  return (
    <div className="space-y-4">
      <IncidentNotificationSection
        incident={incident}
        linkedEquipment={linkedEquipment}
        canWork={canWork}
        onCorrectEquipment={onCorrectEquipment}
        onCreateEquipment={onCreateEquipment}
      />

      <IncidentAssignmentSection
        incident={incident}
        inWorkshop={inWorkshop}
      />

      <IncidentExternalRepairSection incident={incident} />
    </div>
  );
}
