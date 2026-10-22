import { AutocompleteInput } from "@/components/ui/AutocompleteInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PartBasicFieldsProps } from "./types";

export function PartBasicFields({
  form,
  categoryOptions,
  updateField,
  disabled,
}: PartBasicFieldsProps) {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="part-code">Código *</Label>
        <Input
          id="part-code"
          value={form.code}
          onChange={(event) => updateField("code", event.target.value)}
          placeholder="ALI-24015"
          className="font-mono"
          disabled={disabled}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="part-name">Nombre *</Label>
        <Input
          id="part-name"
          value={form.name}
          onChange={(event) => updateField("name", event.target.value)}
          placeholder="Fuente de alimentación 24 V 150 W"
          disabled={disabled}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="part-category">Categoría</Label>
        <AutocompleteInput
          id="part-category"
          value={form.category}
          onChange={(value) => updateField("category", value)}
          items={categoryOptions}
          kind="partCategory"
          placeholder="p. ej. Electrónica, Conectividad..."
          disabled={disabled}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="part-unit">Unidad</Label>
        <Input
          id="part-unit"
          value={form.unit}
          onChange={(event) => updateField("unit", event.target.value)}
          placeholder="ud"
          disabled={disabled}
        />
      </div>
    </>
  );
}
