import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getErrorMessage } from "@/lib/workshop";
import { EquipmentFormDialog } from "@/pages/dashboard/equipment/dialogs/EquipmentFormDialog";
import { CorrectEquipmentDialog } from "@/pages/dashboard/incidents/dialogs/CorrectEquipmentDialog";
import type { IncidentDoc } from "@/pages/dashboard/incidents/types";

export interface IncidentEquipmentModalsProps {
  incident: IncidentDoc;
  equipmentOpen: boolean;
  createEquipmentOpen: boolean;
  onCloseEquipment: () => void;
  onCloseCreateEquipment: () => void;
}

export function IncidentEquipmentModals({
  incident,
  equipmentOpen,
  createEquipmentOpen,
  onCloseEquipment,
  onCloseCreateEquipment,
}: IncidentEquipmentModalsProps) {
  const updateEquipment = useMutation(api.incidents.updateEquipment);

  return (
    <>
      {equipmentOpen && (
        <CorrectEquipmentDialog
          incident={incident}
          onClose={onCloseEquipment}
        />
      )}

      {createEquipmentOpen && (
        <EquipmentFormDialog
          item={null}
          initialValues={{
            model: incident.model,
            serialNumber: incident.serialNumber,
            location: incident.location,
          }}
          onSuccess={async (createdId: Id<"equipment">) => {
            try {
              await updateEquipment({
                incidentId: incident._id,
                equipmentId: createdId,
                model: incident.model,
                serialNumber: incident.serialNumber,
                expectedUpdatedAt: incident.updatedAt,
              });
              toast.success(
                `Equipo vinculado a la incidencia ${incident.reference}`,
              );
            } catch (err) {
              toast.error(getErrorMessage(err));
            }
          }}
          onClose={onCloseCreateEquipment}
        />
      )}
    </>
  );
}
