import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { equipmentLabel } from "@/lib/workshop";
import type { MaintenanceDialogProps } from "../types";
import {
  getMaintenanceDialogTitle,
  MaintenanceDialogFooter,
  MaintenanceFormFields,
  useMaintenanceForm,
} from "./maintenance";

export function MaintenanceDialog({
  item,
  record,
  requests,
  onClose,
}: MaintenanceDialogProps) {
  const form = useMaintenanceForm({
    item,
    record,
    onClose,
  });

  const dialogTitle = getMaintenanceDialogTitle(form.isEdit);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            {equipmentLabel(item)} · queda registrada en su historial de
            mantenimiento.
          </DialogDescription>
        </DialogHeader>

        <MaintenanceFormFields
          kind={form.kind}
          onKindChange={form.setKind}
          date={form.date}
          onDateChange={form.setDate}
          title={form.title}
          onTitleChange={form.setTitle}
          technician={form.technician}
          onTechnicianChange={form.setTechnician}
          requestId={form.requestId}
          onRequestIdChange={form.setRequestId}
          description={form.description}
          onDescriptionChange={form.setDescription}
          requests={requests}
          disabled={form.busy}
        />

        {form.error && <p className="text-sm text-destructive">{form.error}</p>}

        <MaintenanceDialogFooter
          busy={form.busy}
          isEdit={form.isEdit}
          onClose={onClose}
          onSubmit={() => void form.handleSubmit()}
        />
      </DialogContent>
    </Dialog>
  );
}
