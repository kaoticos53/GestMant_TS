import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MANUAL_ACCEPT, MANUAL_FILE_FORMAT } from "@/lib/manuals";
import { MAX_MANUAL_FILE_SIZE_LABEL } from "@/lib/upload";
import { formatFileSize } from "@/lib/workshop";
import { FileText, X } from "lucide-react";

interface ManualFileUploadFieldProps {
  file: File | null;
  isEdit: boolean;
  busy: boolean;
  onFileChange: (file: File | null) => void;
  onClearFile: () => void;
}

export function ManualFileUploadField({
  file,
  isEdit,
  busy,
  onFileChange,
  onClearFile,
}: ManualFileUploadFieldProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="manual-file">
        Archivo ({MANUAL_FILE_FORMAT}){!isEdit && " *"}
      </Label>
      <Input
        id="manual-file"
        type="file"
        accept={MANUAL_ACCEPT}
        disabled={busy}
        onChange={(event) =>
          onFileChange(event.target.files?.[0] ?? null)
        }
      />
      <p className="text-xs leading-5 text-muted-foreground">
        {isEdit
          ? "Elige un archivo solo si quieres sustituir el que tiene: el anterior se conserva en el historial de la ficha, por si hace falta volver a él."
          : `Se sube al almacén del taller. Hasta ${MAX_MANUAL_FILE_SIZE_LABEL}.`}
      </p>
      {file && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="size-3.5" />
          {file.name} · {formatFileSize(file.size)}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label="Quitar el archivo elegido"
            onClick={onClearFile}
          >
            <X className="size-3.5" />
          </Button>
        </p>
      )}
    </div>
  );
}
