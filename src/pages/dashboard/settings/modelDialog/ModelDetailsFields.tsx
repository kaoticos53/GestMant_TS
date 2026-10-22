import { AutocompleteInput } from "@/components/ui/AutocompleteInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ModelDetailsFieldsProps } from "./types";

export function ModelDetailsFields({
  category,
  onCategoryChange,
  defaultSupplier,
  onDefaultSupplierChange,
  maintenanceInterval,
  onMaintenanceIntervalChange,
  description,
  onDescriptionChange,
  catalogSuppliers,
  disabled,
}: ModelDetailsFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="model-category">Categoría de equipo</Label>
          <Input
            id="model-category"
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            placeholder="ej. Elevación, Mecanizado, Audiovisual..."
            disabled={disabled}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="model-supplier">Proveedor habitual</Label>
          <AutocompleteInput
            id="model-supplier"
            value={defaultSupplier}
            onChange={onDefaultSupplierChange}
            items={catalogSuppliers}
            kind="supplier"
            placeholder="ej. Toyota Material Handling"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="model-interval">
          Intervalo preventivo por defecto (días)
        </Label>
        <Input
          id="model-interval"
          type="number"
          min="1"
          value={maintenanceInterval}
          onChange={(e) => onMaintenanceIntervalChange(e.target.value)}
          placeholder="ej. 90 (cada 3 meses)"
          disabled={disabled}
        />
        <p className="text-[11px] text-muted-foreground">
          Se propondrá automáticamente al dar de alta nuevos equipos físicos de este modelo.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="model-description">
          Notas técnicas / Especificaciones
        </Label>
        <Textarea
          id="model-description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Características destacadas, capacidad de carga, potencia o requisitos..."
          rows={3}
          disabled={disabled}
        />
      </div>
    </>
  );
}
