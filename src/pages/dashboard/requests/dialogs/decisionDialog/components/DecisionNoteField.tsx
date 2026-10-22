import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/RichTextEditor";
import type { DecisionNoteFieldProps } from "../types";

export function DecisionNoteField({
  label,
  placeholder,
  value,
  busy,
  onChange,
}: DecisionNoteFieldProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="decision-note">{label}</Label>
      <RichTextEditor
        id="decision-note"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={busy}
      />
    </div>
  );
}
