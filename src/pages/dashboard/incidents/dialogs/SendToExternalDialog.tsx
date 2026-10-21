import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { getErrorMessage } from "@/lib/workshop";
import { richDocToPlainText } from "@/lib/richDoc";
import type { IncidentDoc } from "../types";

export function SendToExternalDialog({
  incident,
  onClose,
}: {
  incident: IncidentDoc;
  onClose: () => void;
}) {
  const sendExternal = useMutation(api.incidents.sendToExternalRepair);
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [includedAccessories, setIncludedAccessories] = useState("");
  const [defectNotes, setDefectNotes] = useState(() =>
    richDocToPlainText(incident.description) || "",
  );
  const [dispatchNotes, setDispatchNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setError("Indica el nombre de la empresa externa o SAT.");
      return;
    }
    if (!defectNotes.trim()) {
      setError("Describe la avería o el motivo del envío.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await sendExternal({
        incidentId: incident._id,
        companyName: companyName.trim(),
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        includedAccessories: includedAccessories.trim() || undefined,
        defectNotes: defectNotes.trim(),
        dispatchNotes: dispatchNotes.trim() || undefined,
      });
      toast.success(
        `${incident.reference} enviada a reparación externa (${companyName.trim()})`,
      );
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

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
            <div className="grid gap-2">
              <Label htmlFor="companyName">
                Empresa externa / SAT <span className="text-destructive">*</span>
              </Label>
              <Input
                id="companyName"
                placeholder="Ej. Servicio Técnico Oficial Sony, Talleres AudioPro..."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={busy}
                autoFocus
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="contactName">Persona o depto. de contacto</Label>
                <Input
                  id="contactName"
                  placeholder="Ej. Juan Gómez / Soporte"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contactPhone">Teléfono o correo</Label>
                <Input
                  id="contactPhone"
                  placeholder="Ej. 912 345 678"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="includedAccessories">
                Accesorios incluidos en el envío
              </Label>
              <Input
                id="includedAccessories"
                placeholder="Ej. Cable de corriente, adaptador original, estuche..."
                value={includedAccessories}
                onChange={(e) => setIncludedAccessories(e.target.value)}
                disabled={busy}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="defectNotes">
                Notas técnicas de avería para el SAT{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="defectNotes"
                rows={3}
                placeholder="Explica detalladamente el fallo para que la empresa externa pueda reproducirlo..."
                value={defectNotes}
                onChange={(e) => setDefectNotes(e.target.value)}
                disabled={busy}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="dispatchNotes">Notas de envío / Transporte</Label>
              <Input
                id="dispatchNotes"
                placeholder="Ej. Enviado por MRW · Nº seguimiento 048291..."
                value={dispatchNotes}
                onChange={(e) => setDispatchNotes(e.target.value)}
                disabled={busy}
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
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
              {busy ? "Registrando envío..." : "Registrar envío externo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
