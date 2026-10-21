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
import type { IncidentDoc } from "../types";

export function ReceiveFromExternalDialog({
  incident,
  onClose,
}: {
  incident: IncidentDoc;
  onClose: () => void;
}) {
  const receiveExternal = useMutation(api.incidents.receiveFromExternalRepair);
  const [repairNotes, setRepairNotes] = useState("");
  const [workshopNotes, setWorkshopNotes] = useState("");
  const [costInput, setCostInput] = useState("");
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ext = incident.externalRepair;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const parsedCost = costInput.trim() ? parseFloat(costInput.replace(",", ".")) : undefined;
      if (costInput.trim() && (isNaN(parsedCost!) || parsedCost! < 0)) {
        setError("El coste debe ser un importe numérico válido.");
        setBusy(false);
        return;
      }

      await receiveExternal({
        incidentId: incident._id,
        repairNotes: repairNotes.trim() || undefined,
        workshopNotes: workshopNotes.trim() || undefined,
        cost: parsedCost,
        deliveryNoteNumber: deliveryNoteNumber.trim() || undefined,
      });

      toast.success(
        `Equipo de ${incident.reference} recibido en el taller desde ${ext?.companyName ?? "empresa externa"}`,
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
            <DialogTitle>Registrar retorno de reparación externa</DialogTitle>
            <DialogDescription>
              {incident.reference} · Retorno desde {ext?.companyName ?? "empresa externa"}. El equipo volverá a estar en taller para su comprobación.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-1">
            {ext && (
              <div className="rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                <div className="font-medium text-foreground">Datos del envío inicial:</div>
                <div><span className="font-medium">Empresa:</span> {ext.companyName}</div>
                {ext.defectNotes && (
                  <div><span className="font-medium">Avería comunicada:</span> {ext.defectNotes}</div>
                )}
                {ext.equipmentSnapshot?.includedAccessories && (
                  <div><span className="font-medium">Accesorios enviados:</span> {ext.equipmentSnapshot.includedAccessories}</div>
                )}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="repairNotes">Informe / Trabajos de la empresa externa</Label>
              <Textarea
                id="repairNotes"
                rows={3}
                placeholder="Indica qué componentes sustituyeron o qué reparación realizó el SAT externo..."
                value={repairNotes}
                onChange={(e) => setRepairNotes(e.target.value)}
                disabled={busy}
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="workshopNotes">Comprobación interna en el taller</Label>
              <Textarea
                id="workshopNotes"
                rows={2}
                placeholder="Pruebas de encendido, verificación de funcionamiento realizadas al desempaquetarlo..."
                value={workshopNotes}
                onChange={(e) => setWorkshopNotes(e.target.value)}
                disabled={busy}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="deliveryNoteNumber">Nº albarán o factura externa</Label>
                <Input
                  id="deliveryNoteNumber"
                  placeholder="Ej. ALB-2026-9481"
                  value={deliveryNoteNumber}
                  onChange={(e) => setDeliveryNoteNumber(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="costInput">Coste de la reparación (€)</Label>
                <Input
                  id="costInput"
                  type="text"
                  inputMode="decimal"
                  placeholder="Ej. 145.50"
                  value={costInput}
                  onChange={(e) => setCostInput(e.target.value)}
                  disabled={busy}
                />
              </div>
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
              {busy ? "Registrando recepción..." : "Registrar retorno al taller"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
