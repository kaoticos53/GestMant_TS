import { FileText, ImageIcon, Paperclip } from "lucide-react";
import type { RequestCardAttachmentsProps } from "./types";

export function RequestCardAttachments({
  attachments,
  images,
  documents,
  compact,
}: RequestCardAttachmentsProps) {
  if (attachments.length === 0 || compact) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/50 px-2.5 py-1.5">
        <Paperclip className="size-3.5" />
        {attachments.length} adjuntos
      </span>
      {images > 0 && (
        <span className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/50 px-2.5 py-1.5">
          <ImageIcon className="size-3.5" />
          {images} fotos
        </span>
      )}
      {documents > 0 && (
        <span className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/50 px-2.5 py-1.5">
          <FileText className="size-3.5" />
          {documents} documentos
        </span>
      )}
    </div>
  );
}
