import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { IncidentDoc } from "../types";
import {
  ExternalCompanyFields,
  ExternalDefectFields,
  useSendToExternalForm,
} from "./sendToExternal";

export function SendToExternalDialog({
  incident,
  onClose,
}: {
  incident: IncidentDoc;
  onClose: () => void;
}) {
  const {
    companyName,
    setCompanyName,
    contactName,
    setContactName,
    contactPhone,
    setContactPhone,
    includedAccessories,
    setIncludedAccessories,
    defectNotes,
    setDefectNotes,
    dispatchNotes,
    setDispatchNotes,
    busy,
    error,
    catalogWorkshops,
    handleSubmit,
  } = useSendToExternalForm({ incident, onClose });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Enviar a reparación externa</DialogTitle>
            <DialogDescription>
              {incident.reference} · {incident.equipmentKind} {incident.model}
              {incident.serialNumber ? ` · S/N ${incident.serialNumber}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-1">
            <ExternalCompanyFields
              companyName={companyName}
              setCompanyName={setCompanyName}
              contactName={contactName}
              setContactName={setContactName}
              contactPhone={contactPhone}
              setContactPhone={setContactPhone}
              catalogWorkshops={catalogWorkshops}
              disabled={busy}
            />

            <ExternalDefectFields
              includedAccessories={includedAccessories}
              setIncludedAccessories={setIncludedAccessories}
              defectNotes={defectNotes}
              setDefectNotes={setDefectNotes}
              dispatchNotes={dispatchNotes}
              setDispatchNotes={setDispatchNotes}
              disabled={busy}
            />

            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Enviando..." : "Registrar envío externo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
