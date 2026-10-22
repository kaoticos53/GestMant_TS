import { ImageOff } from "lucide-react";
import { missingAttachment } from "@/lib/attachment";
import { cn } from "@/lib/utils";
import type { AttachmentLayout } from "../types";

export interface NoFileNoticeProps {
  layout: AttachmentLayout;
  frameClassName?: string;
}

/**
 * Aviso de un adjunto que no tiene archivo o cuya dirección es vacía/inexistente.
 */
export function NoFileNotice({ layout, frameClassName }: NoFileNoticeProps) {
  const missing = missingAttachment();

  if (layout === "cell") {
    return (
      <span
        className={cn(
          "flex flex-col items-center justify-center gap-1 bg-muted/60 text-muted-foreground",
          frameClassName,
        )}
      >
        <ImageOff className="size-4" />
        <span className="text-[10px] leading-tight">{missing.reason}</span>
      </span>
    );
  }

  if (layout === "row") {
    return (
      <span
        role="status"
        className="flex w-full flex-col gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2.5 text-xs leading-5 text-amber-800"
      >
        <span className="flex items-start gap-2">
          <ImageOff className="mt-0.5 size-4 shrink-0" />
          <span className="font-medium">{missing.reason}</span>
        </span>
        <span className="pl-6">{missing.detail}</span>
      </span>
    );
  }

  return null;
}
