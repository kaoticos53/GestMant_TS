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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/RichTextEditor";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { equipmentLabel, getErrorMessage } from "@/lib/workshop";
import { richDocToStore } from "@/lib/richDoc";
import type { EquipmentDoc, IncidentDoc } from "../types";

export function VerifyDialog({
  incident,
  equipment,
  onClose,
}: {
  incident: IncidentDoc;
  equipment: EquipmentDoc[];
  onClose: () => void;
}) {
  const verify = useMutation(api.incidents.verify);
  const [outcome, setOutcome] = useState<"onsite" | "workshop" | "unresolved">(
    "onsite",
  );
  const [equipmentId, setEquipmentId] = useState<string>(
    incident.equipmentId ?? "",
  );
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      await verify({
        incidentId: incident._id,
        outcome,
        equipmentId: equipmentId ? (equipmentId as Id<"equipment">) : undefined,
        notes: richDocToStore(notes),
      });
      toast.success(
        outcome === "workshop"
          ? `${incident.reference} derivada a taller`
          : outcome === "onsite"
            ? `${incident.reference} resuelta in situ`
            : `${incident.reference} cerrada sin resolución`,
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
        <DialogHeader>
          <DialogTitle>Verificar {incident.reference}</DialogTitle>
          <DialogDescription>
            Registra el resultado de la verificación. Cada opción deja un nuevo
            estado en la ficha.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="verify-outcome">Resultado</Label>
            <Select
              value={outcome}
              onValueChange={(value) =>
                setOutcome(value as "onsite" | "workshop" | "unresolved")
              }
            >
              <SelectTrigger id="verify-outcome" disabled={busy}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="onsite">
                  Resuelta in situ (se cierra)
                </SelectItem>
                <SelectItem value="workshop">
                  Requiere desplazar el equipo al taller
                </SelectItem>
                <SelectItem value="unresolved">
                  Se cierra sin resolución
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="verify-equipment">Equipo del inventario</Label>
            <Select
              value={equipmentId || "none"}
              onValueChange={(value) =>
                setEquipmentId(value === "none" ? "" : value)
              }
            >
              <SelectTrigger id="verify-equipment" disabled={busy}>
                <SelectValue placeholder="Vincular con un equipo del inventario" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin vincular</SelectItem>
                {equipment.map((item) => (
                  <SelectItem key={item._id} value={item._id}>
                    {equipmentLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Si hay equipo relacionado, al cerrar se creará la ficha en su
              historial.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="verify-notes">Notas del técnico</Label>
            <RichTextEditor
              id="verify-notes"
              value={notes}
              onChange={setNotes}
              placeholder="Diagnóstico, repuestos sustituidos, qué se ha probado..."
              disabled={busy}
            />
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
          <Button type="button" onClick={handleSubmit} disabled={busy}>
            {busy ? "Guardando..." : "Registrar resultado"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
