import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getErrorMessage } from "@/lib/workshop";
import type { IncidentDoc } from "../types";

export function AssignDialog({
  incident,
  mode,
  onClose,
}: {
  incident: IncidentDoc;
  mode: "assign" | "workshop";
  onClose: () => void;
}) {
  const assignable = useQuery(api.members.listAssignable);
  const assign = useMutation(api.incidents.assign);
  const assignWorkshop = useMutation(api.incidents.assignWorkshop);
  const [targetId, setTargetId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!targetId) {
      setError("Elige el técnico que se va a encargar.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const args = {
        incidentId: incident._id,
        assigneeId: targetId as Id<"users">,
      };
      if (mode === "assign") await assign(args);
      else await assignWorkshop(args);
      toast.success(
        mode === "assign"
          ? `${incident.reference} asignada`
          : `Orden de ${incident.reference} asignada`,
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
          <DialogTitle>
            {mode === "assign"
              ? "Asignar incidencia"
              : "Asignar entrada a taller"}
          </DialogTitle>
          <DialogDescription>
            {incident.reference} · {incident.equipmentKind} {incident.model}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="assign-technician">Técnico</Label>
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger id="assign-technician" disabled={busy}>
              <SelectValue placeholder="Elige un técnico" />
            </SelectTrigger>
            <SelectContent>
              {(assignable ?? []).map((user) => (
                <SelectItem key={user._id} value={user._id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            {busy ? "Asignando..." : "Asignar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
