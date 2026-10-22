import { FileDown, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentLink } from "@/components/DocumentLink";
import { RichText } from "@/components/RichText";
import { formatDateTime } from "@/lib/workshop";
import type { IncidentDocumentsListProps } from "../types";

export function IncidentDocumentsList({
  docs,
  canCoordinate,
  onNewDocument,
  onEditDocument,
  onDeleteDocument,
}: IncidentDocumentsListProps) {
  return (
    <>
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
            onClick={onNewDocument}
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
                    onClick={() => onEditDocument(doc._id, doc.name, doc.note)}
                  >
                    <Pencil className="size-3.5" />
                    Corregir
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-destructive hover:text-destructive"
                    onClick={() => onDeleteDocument(doc._id)}
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
    </>
  );
}
