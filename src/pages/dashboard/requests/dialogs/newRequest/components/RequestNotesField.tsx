import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/RichTextEditor";
import type { RequestNotesFieldProps } from "../types";

export function RequestNotesField({
  value,
  onChange,
  disabled = false,
}: RequestNotesFieldProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="notes">Contexto o diagnóstico (opcional)</Label>
      <RichTextEditor
        id="notes"
        value={value}
        onChange={onChange}
        placeholder="Síntoma, diagnóstico o cualquier contexto útil"
        disabled={disabled}
      />
    </div>
  );
}
