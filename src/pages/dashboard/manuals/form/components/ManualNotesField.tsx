import { RichTextEditor } from "@/components/RichTextEditor";
import { Label } from "@/components/ui/label";

interface ManualNotesFieldProps {
  notes: string;
  isFile: boolean;
  busy: boolean;
  onChange: (notes: string) => void;
}

export function ManualNotesField({
  notes,
  isFile,
  busy,
  onChange,
}: ManualNotesFieldProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="manual-notes">
        {isFile ? "Nota del taller (opcional)" : "Nota del taller *"}
      </Label>
      <RichTextEditor
        id="manual-notes"
        value={notes}
        onChange={onChange}
        disabled={busy}
        placeholder="Lo que conviene saber de este equipo: puesta en marcha, ajustes, avisos..."
      />
    </div>
  );
}
