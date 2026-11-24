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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import {
  INCIDENT_PRIORITIES,
  INCIDENT_PRIORITY_META,
  getErrorMessage,
  normalizeIncidentPriority,
  type IncidentPriority,
} from "@/lib/workshop";
import type { IncidentDoc } from "../types";

export function ChangePriorityDialog({
  incident,
  onClose,
}: {
  incident: IncidentDoc;
  onClose: () => void;
}) {
  const changePriority = useMutation(api.incidents.changePriority);
  const [priority, setPriority] = useState<IncidentPriority>(
    normalizeIncidentPriority(incident.priority),
  );
  const [note, setNote] = useState(incident.priorityNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      await changePriority({
        incidentId: incident._id,
        priority,
        note: note.trim() || undefined,
      });
      toast.success(
        `Prioridad actualizada a ${INCIDENT_PRIORITY_META[priority].label}`,
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar prioridad · {incident.reference}</DialogTitle>
          <DialogDescription>
            Ajusta la prioridad y añade una nota explicando el motivo. La nota
            será visible en el seguimiento del usuario.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="change-priority-select">Prioridad</Label>
            <Select
              value={priority}
              onValueChange={(value) => setPriority(value as IncidentPriority)}
            >
              <SelectTrigger id="change-priority-select" disabled={busy}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INCIDENT_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {INCIDENT_PRIORITY_META[p].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="change-priority-note">
              Motivo del cambio de prioridad
            </Label>
            <Textarea
              id="change-priority-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej. Afecta a la emisión en directo, se escala a urgente..."
              rows={3}
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
            {busy ? "Guardando..." : "Guardar prioridad"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
