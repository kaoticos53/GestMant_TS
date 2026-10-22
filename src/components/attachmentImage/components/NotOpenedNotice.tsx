import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { attachmentFailure } from "@/lib/attachment";
import type { AttachmentLayout } from "../types";

export interface NotOpenedNoticeProps {
  url: string;
  name: string;
  layout: AttachmentLayout;
  apiUrl?: string | null;
  pageProtocol?: string | null;
  onRetry: () => void;
}

/** El aviso que ocupa el sitio de la foto que no se ha podido abrir. */
export function NotOpenedNotice({
  url,
  name,
  layout,
  apiUrl,
  pageProtocol,
  onRetry,
}: NotOpenedNoticeProps) {
  const failure = attachmentFailure(url, { apiUrl, pageProtocol });

  if (layout === "cell") {
    return (
      <span
        role="status"
        title={failure.detail}
        className="flex size-full flex-col items-center justify-center gap-1 bg-muted/60 px-2 text-center"
      >
        <CircleAlert className="size-4 text-amber-600" />
        <span className="text-[11px] font-medium leading-tight">
          No se abre
        </span>
        <span className="text-[10px] leading-tight text-muted-foreground">
          {failure.reason}
        </span>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={onRetry}
          className="h-auto px-0 text-[10px] font-medium"
        >
          Reintentar
        </Button>
      </span>
    );
  }

  return (
    <span
      role="status"
      className="flex w-full flex-col gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2.5 text-xs leading-5 text-amber-800"
    >
      <span className="flex items-start gap-2">
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
        <span className="font-medium">
          {name ? `No se abre «${name}»` : "No se abre este adjunto"}
        </span>
      </span>
      <span className="pl-6">{failure.detail}</span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-6">
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={onRetry}
          className="h-auto px-0 text-xs font-medium text-amber-700"
        >
          Reintentar
        </Button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-amber-700 underline underline-offset-4"
        >
          Abrir la dirección
        </a>
        <span className="font-mono text-[10px] break-all text-amber-800/70">
          {failure.address}
        </span>
      </span>
    </span>
  );
}
