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
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/workshop";
import type { IncidentDoc } from "../types";

/**
 * Corregir el modelo y el nº de serie del equipo de una incidencia. Quien
 * notificó no lo tenía delante y los escribió de memoria —a veces mal y a veces
 * en blanco—, y quien acaba abriendo la máquina es quien lo ve de verdad: son
 * los dos datos que la identifican en el historial de mantenimiento.
 */
export function CorrectEquipmentDialog({
  incident,
  onClose,
}: {
  incident: IncidentDoc;
  onClose: () => void;
}) {
  const updateEquipment = useMutation(api.incidents.updateEquipment);
  const [model, setModel] = useState(incident.model ?? "");
  const [serialNumber, setSerialNumber] = useState(incident.serialNumber ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modelEmpty = model.trim() === "";
  const unchanged =
    model.trim() === (incident.model ?? "") &&
    serialNumber.trim() === (incident.serialNumber ?? "");

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateEquipment({
        incidentId: incident._id,
        model: model.trim(),
        serialNumber: serialNumber.trim(),
      });
      toast.success(`Datos del equipo de ${incident.reference} corregidos`);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Datos del equipo de {incident.reference}</DialogTitle>
          <DialogDescription>
            Escribe el modelo y el nº de serie tal y como figuran en la máquina.
            Si el dato que llegó con la notificación era erróneo se corrige aquí
            —también se puede vaciar—, y el cambio queda en el historial de la
            incidencia.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="equipment-model">Modelo</Label>
            <Input
              id="equipment-model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="p. ej. HDC-3500"
              disabled={busy}
            />
            <p
              className={cn(
                "text-xs text-muted-foreground",
                modelEmpty && "text-destructive",
              )}
            >
              {modelEmpty
                ? "El modelo identifica la máquina: no puede quedarse en blanco."
                : incident.model
                  ? `Lo notificado: ${incident.model}`
                  : "Lo notificado: sin modelo."}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="equipment-serial">Nº de serie</Label>
            <Input
              id="equipment-serial"
              value={serialNumber}
              onChange={(event) => setSerialNumber(event.target.value)}
              placeholder="p. ej. HDC3500-2505-0147"
              className="font-mono"
              disabled={busy}
            />
            <p className="text-xs text-muted-foreground">
              {incident.serialNumber
                ? `Lo notificado: ${incident.serialNumber}`
                : "Lo notificado: sin nº de serie."}
            </p>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={busy || unchanged || modelEmpty}
          >
            {busy ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
