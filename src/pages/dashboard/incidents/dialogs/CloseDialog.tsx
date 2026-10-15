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

export function CloseDialog({
  incident,
  equipment,
  onClose,
}: {
  incident: IncidentDoc;
  equipment: EquipmentDoc[];
  onClose: () => void;
}) {
  const close = useMutation(api.incidents.close);
  const [outcome, setOutcome] = useState<"resolved" | "unresolved">("resolved");
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
      await close({
        incidentId: incident._id,
        outcome,
        equipmentId: equipmentId ? (equipmentId as Id<"equipment">) : undefined,
        notes: richDocToStore(notes),
      });
      toast.success(
        outcome === "resolved"
          ? `${incident.reference} resuelta`
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
          <DialogTitle>Finalizar {incident.reference}</DialogTitle>
          <DialogDescription>
            Cierra la entrada de taller. Con tus datos se creará la ficha de
            historial del equipo relacionado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="close-outcome">Resultado del trabajo</Label>
            <Select
              value={outcome}
              onValueChange={(value) =>
                setOutcome(value as "resolved" | "unresolved")
              }
            >
              <SelectTrigger id="close-outcome" disabled={busy}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resolved">Resuelta</SelectItem>
                <SelectItem value="unresolved">Sin resolución</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="close-equipment">Equipo del inventario</Label>
            <Select
              value={equipmentId || "none"}
              onValueChange={(value) =>
                setEquipmentId(value === "none" ? "" : value)
              }
            >
              <SelectTrigger id="close-equipment" disabled={busy}>
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
          </div>

          <div className="grid gap-2">
            <Label htmlFor="close-notes">Datos aportados por el técnico</Label>
            <RichTextEditor
              id="close-notes"
              value={notes}
              onChange={setNotes}
              placeholder="Qué se ha hecho, causas, recomendaciones..."
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
            {busy ? "Cerrando..." : "Finalizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
