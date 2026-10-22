import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MANUAL_FILE_FORMAT, type ManualKind } from "@/lib/manuals";
import { FileText, NotebookPen } from "lucide-react";

interface ManualKindSelectorProps {
  kind: ManualKind;
  canManage: boolean;
  busy: boolean;
  onKindChange: (kind: ManualKind) => void;
}

export function ManualKindSelector({
  kind,
  canManage,
  busy,
  onKindChange,
}: ManualKindSelectorProps) {
  const isFile = kind === "file";

  return (
    <div className="grid gap-2">
      <Label>Qué se añade</Label>
      <div className="flex flex-wrap gap-2">
        {canManage && (
          <Button
            type="button"
            variant={isFile ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            disabled={busy}
            onClick={() => onKindChange("file")}
          >
            <FileText className="size-4" />
            Archivo {MANUAL_FILE_FORMAT}
          </Button>
        )}
        <Button
          type="button"
          variant={!isFile ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          disabled={busy}
          onClick={() => onKindChange("note")}
        >
          <NotebookPen className="size-4" />
          Nota del taller
        </Button>
      </div>
    </div>
  );
}
