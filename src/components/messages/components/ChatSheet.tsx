import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RichText } from "@/components/RichText";
import { RichTextEditor } from "@/components/RichTextEditor";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/workshop";
import { Send } from "lucide-react";
import { useChatThread } from "../hooks/useChatThread";
import type { ActiveThread, Contact } from "../types";

export interface ChatSheetProps {
  thread: ActiveThread;
  contacts: readonly Contact[];
  canSend: boolean;
  onClose: () => void;
}

/**
 * Panel lateral interactivo con la conversación en tiempo real entre dos usuarios.
 * Incluye auto-scroll automático, marcado reactivo de lectura y envío con RichTextEditor.
 */
export function ChatSheet({
  thread,
  contacts,
  canSend,
  onClose,
}: ChatSheetProps) {
  const {
    messages,
    meId,
    resolvedName,
    text,
    setText,
    busy,
    canSubmit,
    listRef,
    handleSend,
  } = useChatThread({
    threadId: thread.id,
    threadName: thread.name,
    contacts,
  });

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader className="border-b border-border/70 pb-3">
          <SheetTitle className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-signal/10 text-sm font-semibold text-signal">
              {resolvedName.trim().charAt(0).toUpperCase() || "?"}
            </span>
            {resolvedName}
          </SheetTitle>
          <SheetDescription>
            Conversación directa · los mensajes llegan en tiempo real
          </SheetDescription>
        </SheetHeader>

        <div
          ref={listRef}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-2"
        >
          {messages === undefined ? (
            <div className="space-y-3">
              <div className="h-12 w-2/3 animate-pulse rounded-xl bg-muted" />
              <div className="ml-auto h-12 w-1/2 animate-pulse rounded-xl bg-muted" />
            </div>
          ) : messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Todavía no hay mensajes con {resolvedName}. Escribe el primero 👇
            </p>
          ) : (
            messages.map((message) => {
              const mine = message.senderId === meId;
              return (
                <div
                  key={message._id}
                  className={cn("flex flex-col", mine && "items-end")}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-5",
                      mine
                        ? "bg-signal text-primary-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    <RichText
                      value={message.text}
                      className={cn(
                        "break-words",
                        // El enlace de un mensaje toma el color de acento; sobre
                        // el fondo de la burbuja propia no se leería, así que
                        // ahí el acento es el color del propio texto.
                        mine && "[--signal:currentColor]",
                      )}
                    />
                  </div>
                  <span className="mt-1 px-1 text-[10px] text-muted-foreground">
                    {message.senderName} ·{" "}
                    {formatRelativeTime(message.createdAt)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {canSend ? (
          <form
            onSubmit={handleSend}
            className="flex items-end gap-2 border-t border-border/70 pt-3"
          >
            <RichTextEditor
              value={text}
              onChange={setText}
              placeholder={`Escribe a ${resolvedName}...`}
              disabled={busy}
              compact
            />
            <Button
              type="submit"
              size="icon"
              className="shrink-0"
              disabled={busy || !canSubmit}
              aria-label="Enviar mensaje"
            >
              <Send className="size-4" />
            </Button>
          </form>
        ) : (
          <p className="border-t border-border/70 pt-3 text-xs text-muted-foreground">
            Tu rol no tiene permiso para enviar mensajes: aquí solo puedes leer
            la conversación.
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
