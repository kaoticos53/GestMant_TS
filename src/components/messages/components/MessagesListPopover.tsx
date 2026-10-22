import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/workshop";
import { UserPlus } from "lucide-react";
import type { CSSProperties } from "react";
import type { ActiveThread, ThreadSummary } from "../types";

export interface MessagesListPopoverProps {
  style: CSSProperties;
  threads: readonly ThreadSummary[];
  canSend: boolean;
  onOpenComposer: () => void;
  onSelectThread: (thread: ActiveThread) => void;
}

/**
 * Desplegable de hilos de mensajes anclado a la ventana.
 * Permite acceder a conversaciones previas o iniciar un nuevo mensaje.
 */
export function MessagesListPopover({
  style,
  threads,
  canSend,
  onOpenComposer,
  onSelectThread,
}: MessagesListPopoverProps) {
  return (
    <div
      role="dialog"
      aria-label="Mensajes"
      style={style}
      className="z-50 flex flex-col overflow-hidden rounded-xl border border-border/70 bg-popover shadow-lg"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border/70 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Mensajes
        </p>
        {canSend && (
          <button
            type="button"
            onClick={onOpenComposer}
            className="flex items-center gap-1 text-xs font-medium text-signal hover:underline"
          >
            <UserPlus className="size-3.5" />
            Nuevo mensaje
          </button>
        )}
      </div>

      {threads.length === 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            No hay conversaciones todavía.
          </p>
          {canSend && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 gap-1.5"
              onClick={onOpenComposer}
            >
              <UserPlus className="size-3.5" />
              Escribir a alguien
            </Button>
          )}
        </div>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto">
          {threads.map((thread) => (
            <li key={thread.userId}>
              <button
                type="button"
                onClick={() =>
                  onSelectThread({
                    id: thread.userId,
                    name: thread.name,
                  })
                }
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-signal/10 text-xs font-semibold text-signal">
                  {thread.name.trim().charAt(0).toUpperCase() || "?"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {thread.name}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatRelativeTime(thread.at)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 block truncate text-xs",
                      thread.unread > 0
                        ? "font-medium text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {thread.preview}
                  </span>
                </span>
                {thread.unread > 0 && (
                  <span className="flex min-w-4 shrink-0 items-center justify-center rounded-full bg-signal px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
                    {thread.unread > 9 ? "9+" : thread.unread}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
