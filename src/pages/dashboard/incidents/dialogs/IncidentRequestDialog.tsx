import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { PackagePlus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/RichTextEditor";
import { api } from "@/convex/_generated/api";
import { PRIORITY_META, getErrorMessage, type Priority } from "@/lib/workshop";
import { richDocToStore } from "@/lib/richDoc";
import type { IncidentDoc } from "../types";

export function IncidentRequestDialog({
  incident,
  currentUserName,
  onClose,
}: {
  incident: IncidentDoc;
  currentUserName: string;
  onClose: () => void;
}) {
  const createRequest = useMutation(api.partRequests.create);
  const [priority, setPriority] = useState<Priority>("normal");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const requested = richDocToStore(description);
    if (!requested) {
      setError("Describe qué material hace falta.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const equipmentText =
        `${incident.equipmentKind} ${incident.model}`.trim();
      const reference = await createRequest({
        requesterName: currentUserName,
        equipment: equipmentText,
        equipmentId: incident.equipmentId,
        priority,
        description: requested,
        notes: notes.trim() || undefined,
        incidentId: incident._id,
      });
      toast.success(`${reference} creada para ${incident.reference}`);
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
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="size-4" />
            Petición de repuestos
          </DialogTitle>
          <DialogDescription>
            {incident.reference} · el encargado de repuestos la gestionará en la
            cola de peticiones.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="req-priority">Prioridad</Label>
            <Select
              value={priority}
              onValueChange={(value) => setPriority(value as Priority)}
            >
              <SelectTrigger id="req-priority" disabled={busy}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRIORITY_META) as Priority[]).map((option) => (
                  <SelectItem key={option} value={option}>
                    {PRIORITY_META[option].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="req-description">¿Qué material hace falta? *</Label>
            <RichTextEditor
              id="req-description"
              value={description}
              onChange={setDescription}
              placeholder="Repuestos, cantidades, plazos... el responsable asociará los del catálogo."
              disabled={busy}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="req-notes">Notas</Label>
            <Input
              id="req-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="p. ej. urgente: el plató 2 está parado"
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
            {busy ? "Creando..." : "Crear petición"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
