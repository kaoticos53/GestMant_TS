import { AutocompleteInput } from "@/components/ui/AutocompleteInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ModelBasicFieldsProps } from "./types";

export function ModelBasicFields({
  modelCode,
  onModelCodeChange,
  brand,
  onBrandChange,
  name,
  onNameChange,
  catalogBrands,
  disabled,
}: ModelBasicFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="model-code">
            Código / Modelo comercial <span className="text-destructive">*</span>
          </Label>
          <Input
            id="model-code"
            value={modelCode}
            onChange={(e) => onModelCodeChange(e.target.value)}
            placeholder="ej. 8FGF25 o HDC-3500"
            disabled={disabled}
            autoFocus
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="model-brand">Marca comercial</Label>
          <AutocompleteInput
            id="model-brand"
            value={brand}
            onChange={onBrandChange}
            items={catalogBrands}
            kind="brand"
            placeholder="ej. Toyota, Sony, Rexroth..."
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="model-name">
          Designación genérica <span className="text-destructive">*</span>
        </Label>
        <Input
          id="model-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="ej. Carretilla elevadora diésel 2.5T"
          disabled={disabled}
          required
        />
      </div>
    </>
  );
}
