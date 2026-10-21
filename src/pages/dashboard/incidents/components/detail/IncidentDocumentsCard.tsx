import {
  ChevronDown,
  FileDown,
  FileText,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DocumentLink } from "@/components/DocumentLink";
import { RichText } from "@/components/RichText";
import { RichTextEditor } from "@/components/RichTextEditor";
import type { Doc } from "@/convex/_generated/dataModel";
import { FILE_ACCEPT, MAX_FILE_SIZE_LABEL } from "@/lib/upload";
import { documentTrailLabel, formatDateTime } from "@/lib/workshop";
import { useIncidentDocuments } from "../../hooks/useIncidentDocuments";
import type { IncidentDoc } from "../../types";

export interface IncidentDocumentsCardProps {
  incident: IncidentDoc;
  canAssign: boolean;
  canCoordinate: boolean;
  trail: Doc<"incidentDocumentLog">[] | undefined;
}

export function IncidentDocumentsCard({
  incident,
  canAssign,
  canCoordinate,
  trail,
}: IncidentDocumentsCardProps) {
  const {
    documentsOpen,
    documentName,
    setDocumentName,
    documentNote,
    setDocumentNote,
    documentFile,
    documentFileInputRef,
    editingDocumentId,
    setDeletingDocumentId,
    editingDocument,
    deletingDocument,
    savingDoc,
    removingDoc,
    handleNewDocument,
    handleEditDocument,
    handleCloseDocument,
    handleDocumentFileChosen,
    handleSaveDocument,
    handleRemoveDocument,
  } = useIncidentDocuments(incident);

  const docs = incident.documents ?? [];

  if (!canAssign && docs.length === 0) {
    return null;
  }

  return (
    <>
      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Documentos adjuntos
          </p>
          {canCoordinate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={handleNewDocument}
            >
              <Plus className="size-3.5" />
              Adjuntar
            </Button>
          )}
        </div>
        <ul className="mt-3 space-y-2">
          {docs.length === 0 && (
            <li className="text-sm text-muted-foreground">
              Todavía no hay documentos adjuntos.
            </li>
          )}
          {docs.map((doc) => (
            <li
              key={doc._id}
              className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/60 p-3 text-sm"
            >
              <FileText className="mt-0.5 shrink-0 size-4 text-muted-foreground" />
              <div className="min-w-0">
                <p className="font-medium text-foreground">{doc.name}</p>
                <DocumentLink
                  url={doc.url}
                  name={doc.name}
                  icon={<FileDown className="size-3.5" />}
                  className="mt-0.5"
                />
                {doc.note && (
                  <RichText
                    value={doc.note}
                    className="mt-0.5 text-xs leading-5 text-muted-foreground"
                  />
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {doc.author && <>{doc.author} · </>}
                  Añadido {formatDateTime(doc.createdAt)}
                </p>
                {canCoordinate && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 px-2"
                      onClick={() =>
                        handleEditDocument(doc._id, doc.name, doc.note)
                      }
                    >
                      <Pencil className="size-3.5" />
                      Corregir
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 px-2 text-destructive hover:text-destructive"
                      onClick={() => setDeletingDocumentId(doc._id)}
                    >
                      <Trash2 className="size-3.5" />
                      Quitar
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>

        {canAssign && (
          <Collapsible className="mt-3 border-t border-border/70 pt-3">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronDown className="size-3.5" />
                Rastro de cambios
                {trail && ` (${trail.length})`}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ol className="mt-2 space-y-2">
                {trail && trail.length === 0 && (
                  <li className="text-xs text-muted-foreground">
                    Sin cambios: ningún documento se ha movido en este
                    expediente.
                  </li>
                )}
                {trail?.map((entry) => (
                  <li
                    key={entry._id}
                    className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs"
                  >
                    <p className="text-foreground">{documentTrailLabel(entry)}</p>
                    <p className="mt-0.5 text-muted-foreground">
                      {entry.by} · {formatDateTime(entry.at)}
                    </p>
                  </li>
                ))}
              </ol>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      {documentsOpen && (
        <Dialog open onOpenChange={(open) => !open && handleCloseDocument()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingDocumentId ? "Corregir documento" : "Adjuntar documento"}
              </DialogTitle>
              <DialogDescription>
                {editingDocumentId
                  ? `Corriges los datos del documento de ${incident.reference}. Puedes cambiarle el nombre o la nota, y también sustituir el archivo.`
                  : `Añade un documento al expediente de ${incident.reference}.`}
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
                  onChange={(event) =>
                    void handleDocumentFileChosen(event.target.files)
                  }
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
                      onClick={() =>
                        documentFileInputRef.current?.click()
                      }
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
                  {editingDocument?.storageId
                    ? `Imágenes, PDF o documentos de oficina, máximo ${MAX_FILE_SIZE_LABEL}. Al guardar, el archivo anterior se borra del servidor y el cambio queda firmado en el rastro.`
                    : `Imágenes, PDF o documentos de oficina. Máximo ${MAX_FILE_SIZE_LABEL} por archivo; el archivo se sube y queda guardado con el expediente.`}
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
                  onClick={handleCloseDocument}
                  disabled={savingDoc}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveDocument}
                  disabled={
                    savingDoc || (!documentName.trim() && !documentFile)
                  }
                >
                  {savingDoc
                    ? documentFile
                      ? "Subiendo..."
                      : "Guardando..."
                    : editingDocumentId
                      ? "Guardar cambios"
                      : "Adjuntar"}
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      )}

      {deletingDocument && (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open && !removingDoc) setDeletingDocumentId(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                ¿Quitar «{deletingDocument.name}» del expediente?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Dejará de estar en la ficha de {incident.reference}. El rastro de
                cambios conserva quién lo quitó, cuándo y con qué nombre estaba.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={removingDoc}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                disabled={removingDoc}
                onClick={(event) => {
                  event.preventDefault();
                  void handleRemoveDocument();
                }}
              >
                {removingDoc ? "Quitando..." : "Quitar documento"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
