import { useState } from "react";
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
import type { Id } from "@/convex/_generated/dataModel";
import { richDocToStore } from "@/lib/richDoc";
import {
  MAINTENANCE_META,
  equipmentLabel,
  getErrorMessage,
  type MaintenanceKind,
} from "@/lib/workshop";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { dateToInput, inputToDate } from "../helpers";
import type { MaintenanceDialogProps } from "../types";

/** Se calcula una vez a nivel de módulo (o al montar el componente). */
const TODAY_INPUT = dateToInput(Date.now());

export function MaintenanceDialog({
  item,
  record,
  requests,
  onClose,
}: MaintenanceDialogProps) {
  const create = useMutation(api.maintenance.create);
  const update = useMutation(api.maintenance.update);

  const isEdit = record !== null;
  const [kind, setKind] = useState<MaintenanceKind>(record?.kind ?? "repair");
  const [title, setTitle] = useState(record?.title ?? "");
  const [date, setDate] = useState(
    record ? dateToInput(record.performedAt) : TODAY_INPUT,
  );
  const [technician, setTechnician] = useState(record?.technician ?? "");
  const [description, setDescription] = useState(record?.description ?? "");
  const [requestId, setRequestId] = useState<Id<"partRequests"> | "">(
    record?.requestId ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    const performedAt = inputToDate(date);
    if (!title.trim()) {
      setError("El resumen de la intervención es obligatorio.");
      return;
    }
    if (performedAt === undefined) {
      setError("Indica la fecha de la intervención.");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        equipmentId: item._id,
        kind,
        title: title.trim(),
        // Como en la ficha del equipo: lo que se guarda es el documento del
        // editor y una nota vacía se queda en `undefined`.
        description: richDocToStore(description),
        performedAt,
        technician: technician.trim(),
        requestId: requestId === "" ? undefined : requestId,
      };
      if (isEdit && record) {
        await update({ id: record._id, ...payload });
        toast.success("Intervención actualizada");
      } else {
        await create(payload);
        toast.success(`${title.trim()} añadida al historial`);
      }
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar intervención" : "Registrar intervención"}
          </DialogTitle>
          <DialogDescription>
            {equipmentLabel(item)} · queda registrada en su historial de
            mantenimiento.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="mt-kind">Tipo</Label>
            <Select
              value={kind}
              onValueChange={(value) => setKind(value as MaintenanceKind)}
            >
              <SelectTrigger id="mt-kind" disabled={busy}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="repair">
                  {MAINTENANCE_META.repair.label}
                </SelectItem>
                <SelectItem value="preventive">
                  {MAINTENANCE_META.preventive.label}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mt-date">Fecha</Label>
            <Input
              id="mt-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              disabled={busy}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="mt-title">Resumen *</Label>
            <Input
              id="mt-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="p. ej. Sustitución de la fuente de alimentación"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mt-technician">Realizada por</Label>
            <Input
              id="mt-technician"
              value={technician}
              onChange={(event) => setTechnician(event.target.value)}
              placeholder="Nombre del técnico"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mt-request">Petición vinculada</Label>
            <Select
              value={requestId || "none"}
              onValueChange={(value) =>
                setRequestId(
                  value === "none" ? "" : (value as Id<"partRequests">),
                )
              }
            >
              <SelectTrigger id="mt-request" disabled={busy}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin petición vinculada</SelectItem>
                {requests.map((request) => (
                  <SelectItem key={request._id} value={request._id}>
                    {request.reference} · {request.requesterName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="mt-description">Descripción</Label>
            <RichTextEditor
              id="mt-description"
              value={description}
              onChange={setDescription}
              placeholder="Síntoma, causa, repuestos sustituidos, observaciones..."
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
            {busy ? "Guardando..." : isEdit ? "Guardar cambios" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
