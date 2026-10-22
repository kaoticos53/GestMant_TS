import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/RichTextEditor";
import type { RequestDescriptionFieldProps } from "../types";

export function RequestDescriptionField({
  value,
  onChange,
  disabled = false,
}: RequestDescriptionFieldProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="description">Descripción de lo que se pide</Label>
      <RichTextEditor
        id="description"
        value={value}
        onChange={onChange}
        placeholder="Qué necesitas, para qué, cantidades, plazos... (obligatorio si no añades repuestos)"
        disabled={disabled}
      />
    </div>
  );
}
