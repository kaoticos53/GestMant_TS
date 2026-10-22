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
import type { Id } from "@/convex/_generated/dataModel";
import { MAINTENANCE_META, type MaintenanceKind } from "@/lib/workshop";
import type { MaintenanceFormFieldsProps } from "../types";

export function MaintenanceFormFields({
  kind,
  onKindChange,
  date,
  onDateChange,
  title,
  onTitleChange,
  technician,
  onTechnicianChange,
  requestId,
  onRequestIdChange,
  description,
  onDescriptionChange,
  requests,
  disabled = false,
}: MaintenanceFormFieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="mt-kind">Tipo</Label>
        <Select
          value={kind}
          onValueChange={(value) => onKindChange(value as MaintenanceKind)}
        >
          <SelectTrigger id="mt-kind" disabled={disabled}>
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
          onChange={(event) => onDateChange(event.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="mt-title">Resumen *</Label>
        <Input
          id="mt-title"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="p. ej. Sustitución de la fuente de alimentación"
          disabled={disabled}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="mt-technician">Realizada por</Label>
        <Input
          id="mt-technician"
          value={technician}
          onChange={(event) => onTechnicianChange(event.target.value)}
          placeholder="Nombre del técnico"
          disabled={disabled}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="mt-request">Petición vinculada</Label>
        <Select
          value={requestId || "none"}
          onValueChange={(value) =>
            onRequestIdChange(
              value === "none" ? "" : (value as Id<"partRequests">),
            )
          }
        >
          <SelectTrigger id="mt-request" disabled={disabled}>
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
          onChange={onDescriptionChange}
          placeholder="Síntoma, causa, repuestos sustituidos, observaciones..."
          disabled={disabled}
        />
      </div>
    </div>
  );
}
