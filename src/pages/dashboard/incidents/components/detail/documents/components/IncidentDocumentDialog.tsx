import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/RichTextEditor";
import { FILE_ACCEPT } from "@/lib/upload";
import {
  getDocumentDialogDescription,
  getDocumentDialogTitle,
  getDocumentFileHelperText,
  getDocumentSubmitLabel,
} from "../helpers";
import type { IncidentDocumentDialogProps } from "../types";

export function IncidentDocumentDialog({
  open,
  reference,
  editingDocumentId,
  editingDocument,
  documentName,
  setDocumentName,
  documentNote,
  setDocumentNote,
  documentFile,
  documentFileInputRef,
  savingDoc,
  onClose,
  onFileChosen,
  onSave,
}: IncidentDocumentDialogProps) {
  if (!open) return null;

  const isEditing = Boolean(editingDocumentId);

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{getDocumentDialogTitle(isEditing)}</DialogTitle>
          <DialogDescription>
            {getDocumentDialogDescription(isEditing, reference)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="doc-name">Nombre</Label>
            <Input
              id="doc-name"
              value={documentName}
              onChange={(event) => setDocumentName(event.target.value)}
              placeholder="p. ej. Presupuesto reparación, Foto de la placa..."
              disabled={savingDoc}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="doc-file">
              {editingDocument?.storageId
                ? "Sustituir archivo (opcional)"
                : "Archivo *"}
            </Label>
            <input
              ref={documentFileInputRef}
              id="doc-file"
              type="file"
              accept={FILE_ACCEPT}
              className="hidden"
              onChange={(event) => void onFileChosen(event.target.files)}
            />
            {documentFile ? (
              <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs">
                <span className="truncate font-medium text-foreground">
                  {documentFile.name}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-muted-foreground"
                  disabled={savingDoc}
                  onClick={() => documentFileInputRef.current?.click()}
                >
                  Cambiar
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="justify-start gap-2"
                disabled={savingDoc}
                onClick={() => documentFileInputRef.current?.click()}
              >
                <Upload className="size-4" />
                {editingDocument?.storageId
                  ? "Elegir el archivo nuevo"
                  : "Elegir archivo"}
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              {getDocumentFileHelperText(Boolean(editingDocument?.storageId))}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="doc-note">Nota</Label>
            <RichTextEditor
              id="doc-note"
              value={documentNote}
              onChange={setDocumentNote}
              placeholder="p. ej. Foto del daño antes de la reparación"
              disabled={savingDoc}
            />
          </div>
        </div>

        {(documentName.trim() || documentFile) && (
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={savingDoc}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={onSave}
              disabled={savingDoc || (!documentName.trim() && !documentFile)}
            >
              {getDocumentSubmitLabel(
                savingDoc,
                Boolean(documentFile),
                isEditing,
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
