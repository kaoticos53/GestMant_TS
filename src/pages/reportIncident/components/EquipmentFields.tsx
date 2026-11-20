import { useRef } from "react";
import { EquipmentLabelScanner, type AppliedLabelFields } from "@/components/ai/EquipmentLabelScanner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EquipmentFieldsProps {
  isAuthenticated?: boolean;
  reportedAt: string;
  onReportedAtChange: (value: string) => void;
  equipmentKind: string;
  onEquipmentKindChange: (value: string) => void;
  model: string;
  onModelChange: (value: string) => void;
  serialNumber: string;
  onSerialNumberChange: (value: string) => void;
  inventoryModels: string[];
  disabled: boolean;
}

export function EquipmentFields({
  isAuthenticated = false,
  reportedAt,
  onReportedAtChange,
  equipmentKind,
  onEquipmentKindChange,
  model,
  onModelChange,
  serialNumber,
  onSerialNumberChange,
  inventoryModels,
  disabled,
}: EquipmentFieldsProps) {
  const undoSnapshotRef = useRef<{
    equipmentKind: string;
    model: string;
    serialNumber: string;
  } | null>(null);

  const handleApplyLabel = (fields: AppliedLabelFields) => {
    if (!undoSnapshotRef.current) {
      undoSnapshotRef.current = { equipmentKind, model, serialNumber };
    }
    if (fields.equipmentKind) onEquipmentKindChange(fields.equipmentKind);
    if (fields.model) onModelChange(fields.model);
    if (fields.serialNumber) onSerialNumberChange(fields.serialNumber);
  };

  const handleUndoLabel = () => {
    const snap = undoSnapshotRef.current;
    if (!snap) return;
    onEquipmentKindChange(snap.equipmentKind);
    onModelChange(snap.model);
    onSerialNumberChange(snap.serialNumber);
    undoSnapshotRef.current = null;
  };

  return (
    <div className="space-y-4">
      {isAuthenticated && (
        <EquipmentLabelScanner
          isAuthenticated={isAuthenticated}
          disabled={disabled}
          onApply={handleApplyLabel}
          onUndo={handleUndoLabel}
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2 items-start">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inc-date">Fecha de notificación *</Label>
        <Input
          id="inc-date"
          type="date"
          value={reportedAt}
          onChange={(event) => onReportedAtChange(event.target.value)}
          disabled={disabled}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inc-kind">Tipo de equipo</Label>
        <Input
          id="inc-kind"
          value={equipmentKind}
          onChange={(event) => onEquipmentKindChange(event.target.value)}
          placeholder="p. ej. Cámara de estudio"
          disabled={disabled}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inc-model">Modelo</Label>
        <Input
          id="inc-model"
          list="incident-models-datalist"
          value={model}
          onChange={(event) => onModelChange(event.target.value)}
          placeholder="p. ej. HDC-3500"
          className="font-mono"
          disabled={disabled}
        />
        <datalist id="incident-models-datalist">
          {inventoryModels.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inc-serial">Número de serie</Label>
        <Input
          id="inc-serial"
          value={serialNumber}
          onChange={(event) => onSerialNumberChange(event.target.value)}
          placeholder="p. ej. HDC3500-2505-0147"
          className="font-mono"
          disabled={disabled}
        />
      </div>
    </div>
    </div>
  );
}
