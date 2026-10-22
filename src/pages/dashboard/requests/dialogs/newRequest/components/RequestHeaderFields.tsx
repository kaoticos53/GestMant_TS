import { AutocompleteInput } from "@/components/ui/AutocompleteInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Priority } from "@/lib/workshop";
import type { RequestHeaderFieldsProps } from "../types";

export function RequestHeaderFields({
  requesterName,
  onRequesterNameChange,
  requesterTeam,
  onRequesterTeamChange,
  catalogPositions,
  priority,
  onPriorityChange,
  disabled = false,
}: RequestHeaderFieldsProps) {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="requester">Solicitante *</Label>
        <Input
          id="requester"
          value={requesterName}
          onChange={(event) => onRequesterNameChange(event.target.value)}
          placeholder="Nombre y apellido"
          disabled={disabled}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="team">Puesto</Label>
        <AutocompleteInput
          id="team"
          value={requesterTeam}
          onChange={onRequesterTeamChange}
          items={catalogPositions}
          kind="position"
          placeholder="p. ej. Realización, Audio, Cámaras..."
          disabled={disabled}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="priority">Prioridad</Label>
        <Select
          value={priority}
          onValueChange={(value) => onPriorityChange(value as Priority)}
        >
          <SelectTrigger id="priority" className="w-full" disabled={disabled}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="urgent">Urgente</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="low">Baja</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
