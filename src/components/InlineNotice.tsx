import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type InlineNoticeTone = "warning" | "success" | "info" | "destructive";

const TONE_CLASSES: Record<InlineNoticeTone, string> = {
  warning:
    "border border-status-warning/30 bg-status-warning-surface text-status-warning-foreground",
  success:
    "border border-status-success/30 bg-status-success-surface text-status-success-foreground",
  info: "border border-status-info/30 bg-status-info-surface text-status-info-foreground",
  destructive: "border border-destructive/30 bg-destructive/10 text-destructive",
};

export interface InlineNoticeProps {
  tone?: InlineNoticeTone;
  as?: "div" | "span";
  className?: string;
  children: ReactNode;
}

/**
 * Aviso contextual compacto con contraste garantizado en tema claro y oscuro.
 */
export function InlineNotice({
  tone = "warning",
  as = "div",
  className,
  children,
}: InlineNoticeProps) {
  const Component = as;
  return (
    <Component
      role="status"
      className={cn(
        "flex w-full flex-col gap-1.5 rounded-lg px-3 py-2.5 text-xs leading-5",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </Component>
  );
}
