import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
import { RequestPartsSection } from "../../requests/dialogs/components/RequestPartsSection";
import { useRequestPartsSelection } from "../../requests/hooks/useRequestPartsSelection";
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
  const parts = useQuery(api.spareParts.list) ?? [];
  const equipment = useQuery(api.equipment.list) ?? [];
  const catalogModels = useQuery(api.equipmentModels.list) ?? [];

  const [priority, setPriority] = useState<Priority>(
    (incident.priority as Priority | undefined) ?? "normal",
  );
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const partsSelection = useRequestPartsSelection({
    parts,
    equipment,
    catalogModels,
    equipmentChoice: incident.equipmentId ?? "",
  });

  const handleSubmit = async () => {
    const requested = richDocToStore(description);
    if (!requested && partsSelection.lines.length === 0) {
      setError(
        "Indica qué material hace falta o añade al menos un repuesto del catálogo.",
      );
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
        description: requested || undefined,
        notes: notes.trim() || undefined,
        incidentId: incident._id,
        lines: partsSelection.lines.length > 0 ? partsSelection.lines : undefined,
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
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="size-4" />
            Petición de repuestos
          </DialogTitle>
          <DialogDescription>
            {incident.reference} · el responsable de repuestos la gestionará en la
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

          <RequestPartsSection
            parts={parts}
            visibleParts={partsSelection.visibleParts}
            compatibleParts={partsSelection.compatibleParts}
            partById={partsSelection.partById}
            selectedEquipment={partsSelection.selectedEquipment}
            showOnly={partsSelection.showOnly}
            onToggleOnlyCompatible={() =>
              partsSelection.setOnlyCompatible((prev) => !prev)
            }
            selectedId={partsSelection.selectedId}
            onSelectIdChange={partsSelection.setSelectedId}
            onAddLine={partsSelection.addLine}
            lines={partsSelection.lines}
            onUpdateQuantity={partsSelection.updateQuantity}
            onRemoveLine={partsSelection.removeLine}
            disabled={busy}
          />

          <div className="grid gap-2">
            <Label htmlFor="req-description">¿Qué material hace falta?</Label>
            <RichTextEditor
              id="req-description"
              value={description}
              onChange={setDescription}
              placeholder="Repuestos, cantidades, plazos... opcional si ya has añadido referencias del catálogo."
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

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

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
