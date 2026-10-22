import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { equipmentLabel } from "@/lib/workshop";
import type { EquipmentDoc } from "../../types";

export interface RequestEquipmentSectionProps {
  equipment: EquipmentDoc[];
  selectedEquipment: EquipmentDoc | undefined;
  equipmentChoice: string;
  onEquipmentChoiceChange: (value: string) => void;
  equipmentManual: string;
  onEquipmentManualChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Sección para seleccionar el equipo afectado desde el inventario
 * o introducir un equipo libremente de manera manual.
 */
export function RequestEquipmentSection({
  equipment,
  selectedEquipment,
  equipmentChoice,
  onEquipmentChoiceChange,
  equipmentManual,
  onEquipmentManualChange,
  disabled = false,
}: RequestEquipmentSectionProps) {
  return (
    <div className="grid gap-2 sm:col-span-2">
      <Label htmlFor="equipment-choice">Equipo afectado</Label>
      <Select
        value={equipmentChoice}
        onValueChange={onEquipmentChoiceChange}
      >
        <SelectTrigger
          id="equipment-choice"
          className="w-full"
          disabled={disabled}
        >
          <SelectValue placeholder="Elegir equipo del inventario" />
        </SelectTrigger>
        <SelectContent>
          {equipment.map((item) => (
            <SelectItem key={item._id} value={item._id}>
              {equipmentLabel(item)}
              {item.brand ? ` · ${item.brand}` : ""}
            </SelectItem>
          ))}
          <SelectItem value="manual">
            Otro — escribir el equipo a mano
          </SelectItem>
        </SelectContent>
      </Select>

      {equipmentChoice === "manual" && (
        <Input
          value={equipmentManual}
          onChange={(event) => onEquipmentManualChange(event.target.value)}
          placeholder="p. ej. Router de vídeo 7800FR"
          disabled={disabled}
          aria-label="Equipo afectado (a mano)"
        />
      )}

      {selectedEquipment && (
        <p className="text-xs text-muted-foreground">
          En inventario
          {selectedEquipment.location
            ? ` · ${selectedEquipment.location}`
            : ""}
        </p>
      )}

      {equipment.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No hay equipos en el inventario todavía: escríbelo a mano.
        </p>
      )}
    </div>
  );
}
