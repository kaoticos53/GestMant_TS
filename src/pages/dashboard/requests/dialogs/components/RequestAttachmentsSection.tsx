import { FileText, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MAX_FILE_SIZE_LABEL } from "@/lib/upload";
import type { PendingRequestFile } from "../../hooks/useRequestAttachments";

export interface RequestAttachmentsSectionProps {
  files: PendingRequestFile[];
  fileAccept: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  openFileDialog: () => void;
  onFilesChosen: (files: FileList | null) => Promise<void>;
  onRemoveFile: (id: string) => void;
  disabled?: boolean;
}

/**
 * Sección de adjuntos multimedia y documentos con vista previa,
 * barra de progreso/spinner y botón de eliminación accesible.
 */
export function RequestAttachmentsSection({
  files,
  fileAccept,
  fileInputRef,
  openFileDialog,
  onFilesChosen,
  onRemoveFile,
  disabled = false,
}: RequestAttachmentsSectionProps) {
  return (
    <div className="grid gap-2">
      <Label>Fotos y documentos</Label>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={fileAccept}
        className="hidden"
        onChange={(event) => {
          void onFilesChosen(event.target.files);
          event.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="gap-2"
        onClick={openFileDialog}
        disabled={disabled}
      >
        <Upload className="size-4" />
        Añadir fotos o documentos
      </Button>

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2"
            >
              {file.previewUrl ? (
                <img
                  src={file.previewUrl}
                  alt=""
                  className="size-9 shrink-0 rounded-md border border-border/70 object-cover"
                />
              ) : (
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <FileText className="size-4" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">
                  {file.file.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {file.error ? (
                    <span className="text-destructive">{file.error}</span>
                  ) : file.uploading ? (
                    "Subiendo..."
                  ) : (
                    `${Math.max(1, Math.round(file.file.size / 1024))} KB · listo`
                  )}
                </span>
              </span>
              {file.uploading && (
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onRemoveFile(file.id)}
                disabled={disabled || file.uploading}
                aria-label={`Quitar ${file.file.name}`}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Imágenes, PDF o documentos de oficina. Máximo {MAX_FILE_SIZE_LABEL}{" "}
        por archivo.
      </p>
    </div>
  );
}
