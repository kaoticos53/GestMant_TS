import { AttachmentGroup } from "@/components/AttachmentGroup";
import { AttachmentImage } from "@/components/AttachmentImage";
import { FileText, Paperclip } from "lucide-react";
import type { RequestAttachment } from "../../types";

export interface RequestAttachmentsCardProps {
  attachments: RequestAttachment[];
}

export function RequestAttachmentsCard({
  attachments,
}: RequestAttachmentsCardProps) {
  if (attachments.length === 0) return null;

  const images = attachments.filter((a) => a.kind === "image");
  const documents = attachments.filter((a) => a.kind === "document");

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Paperclip className="size-3.5" />
        Adjuntos
      </p>

      {images.length > 0 && (
        <AttachmentGroup>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {images.map((image) => (
              <AttachmentImage
                key={image.storageId}
                url={image.url}
                name={image.name}
                layout="cell"
                link
                frameClassName="aspect-square overflow-hidden rounded-lg border border-border/70"
                imageClassName="size-full object-cover transition-transform group-hover:scale-105"
              />
            ))}
          </div>
        </AttachmentGroup>
      )}

      {documents.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {documents.map((document) => (
            <li key={document.storageId}>
              {document.url ? (
                <a
                  href={document.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/50 px-3 py-2 text-sm transition-colors hover:border-signal/40"
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{document.name}</span>
                </a>
              ) : (
                <span className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                  <FileText className="size-4 shrink-0" />
                  <span className="truncate">{document.name}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
