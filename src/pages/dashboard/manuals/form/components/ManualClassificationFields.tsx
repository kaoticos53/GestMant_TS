import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MANUAL_TYPES } from "@/lib/manuals";
import { equipmentLabel } from "@/lib/workshop";
import type { EquipmentDoc } from "../types";

interface ManualClassificationFieldsProps {
  title: string;
  type: string;
  equipmentId: string;
  brand: string;
  model: string;
  classificationBrand: string;
  classificationModel: string;
  linked: EquipmentDoc | null;
  fixedEquipmentId?: string | null;
  equipment: EquipmentDoc[];
  uniqueModels: string[];
  busy: boolean;
  onTitleChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onEquipmentChange: (value: string) => void;
  onBrandChange: (value: string) => void;
  onModelChange: (value: string) => void;
}

export function ManualClassificationFields({
  title,
  type,
  equipmentId,
  brand,
  model,
  classificationBrand,
  classificationModel,
  linked,
  fixedEquipmentId,
  equipment,
  uniqueModels,
  busy,
  onTitleChange,
  onTypeChange,
  onEquipmentChange,
  onBrandChange,
  onModelChange,
}: ManualClassificationFieldsProps) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="manual-title">Título *</Label>
          <Input
            id="manual-title"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Manual de servicio HDC-3500"
            disabled={busy}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="manual-type">Tipo *</Label>
          <Select value={type} onValueChange={onTypeChange} disabled={busy}>
            <SelectTrigger id="manual-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MANUAL_TYPES.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="manual-equipment">Equipo del inventario</Label>
          {fixedEquipmentId && linked ? (
            <p className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm">
              {equipmentLabel(linked)}
            </p>
          ) : (
            <Select
              value={equipmentId}
              onValueChange={onEquipmentChange}
              disabled={busy}
            >
              <SelectTrigger id="manual-equipment" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  Sin equipo (es del modelo)
                </SelectItem>
                {equipment.map((item) => (
                  <SelectItem key={item._id} value={item._id}>
                    {equipmentLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="manual-brand">Marca</Label>
          <Input
            id="manual-brand"
            value={linked ? classificationBrand : brand}
            onChange={(event) => onBrandChange(event.target.value)}
            placeholder="Sony"
            disabled={busy || Boolean(linked)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="manual-model">Modelo</Label>
          <Input
            id="manual-model"
            list="manual-models-datalist"
            value={linked ? classificationModel : model}
            onChange={(event) => onModelChange(event.target.value)}
            placeholder="HDC-3500"
            disabled={busy || Boolean(linked)}
          />
          <datalist id="manual-models-datalist">
            {uniqueModels.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
      </div>

      {linked && (
        <p className="text-xs leading-5 text-muted-foreground">
          {fixedEquipmentId
            ? `Se añade a ${equipmentLabel(linked)}: la marca y el modelo son los suyos, así que el manual aparecerá también en su ficha.`
            : `Al asignarlo a ${equipmentLabel(linked)}, la marca y el modelo se toman del equipo: así el manual aparece también en su ficha.`}
        </p>
      )}
    </>
  );
}
