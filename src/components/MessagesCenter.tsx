import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RichText } from "@/components/RichText";
import { RichTextEditor } from "@/components/RichTextEditor";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAnchoredPanel } from "@/hooks/use-anchored-panel";
import { useAuth } from "@/hooks/use-auth";
import {
  chatPanelReducer,
  closesListOnOutsideClick,
  initialChatPanel,
} from "@/lib/chatPanel";
import { richDocIsEmpty, richDocToPlainText } from "@/lib/richDoc";
import { cn } from "@/lib/utils";
import { formatRelativeTime, getErrorMessage } from "@/lib/workshop";
import { useMutation, useQuery } from "convex/react";
import { MessageCircle, Send, UserPlus } from "lucide-react";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Mismo límite que valida el servidor al enviar, contado sobre el texto del
 * mensaje: el formato (párrafos, listas, marcas) no cuenta.
 */
const MAX_MESSAGE_TEXT = 1500;

/** Contacto del directorio (usuarios activos, sin ti). */
interface Contact {
  _id: Id<"users">;
  name: string;
  position: string | null;
  role: string | null;
}

interface ThreadSummary {
  userId: Id<"users">;
  name: string;
  preview: string;
  at: number;
  unread: number;
}

/**
 * Mensajería entre usuarios: icono con el total de mensajes sin leer, lista de
 * conversaciones y chat en un Sheet. Al abrir una conversación la lista se
 * queda debajo (y no se cierra al pulsar fuera mientras el chat está abierto),
 * de modo que cerrar el chat devuelve siempre a la lista. Las suscripciones de
 * Convex hacen que los mensajes entrantes aparezcan en tiempo real y que el
 * contador se actualice solo.
 */
export function MessagesCenter({
  className,
  canSend = true,
}: {
  className?: string;
  /** Sin permiso de envío se queda solo de lectura. */
  canSend?: boolean;
}) {
  const { user } = useAuth();
  const messages = useQuery(api.messages.list);
  const contacts = useQuery(api.messages.contacts);

  // Una sola máquina de estados para la lista, el chat y el alta de mensaje:
  // al cerrar el chat la lista vuelve a estar a la vista.
  const [panel, dispatch] = useReducer(
    chatPanelReducer<Id<"users">>,
    null,
    () => initialChatPanel<Id<"users">>(),
  );
  const containerRef = useRef<HTMLDivElement>(null);
  // La lista se ancla a la ventana, no a su contenedor: el icono vive en
  // cabeceras pegajosas y junto al panel lateral del menú, que recorta con
  // `overflow-hidden`, así que un desplegable `absolute` se vería cortado. El
  // anclaje es el mismo que el de la campana de avisos.
  const {
    style: listStyle,
    measure,
    triggerRef: buttonRef,
  } = useAnchoredPanel(panel.listOpen);

  const meId = user?._id;
  const items = useMemo(() => messages ?? [], [messages]);

  const unreadTotal = items.filter(
    (message) => message.recipientId === meId && !message.read,
  ).length;

  // Hilos: primera aparición = mensaje más reciente (lista en orden desc).
  const threads = useMemo<ThreadSummary[]>(() => {
    if (!meId) return [];
    const map = new Map<string, ThreadSummary>();
    for (const message of items) {
      const isMine = message.senderId === meId;
      const otherId = (
        isMine ? message.recipientId : message.senderId
      ) as string;
      const existing = map.get(otherId);
      if (existing) {
        if (!isMine && !message.read) existing.unread += 1;
        continue;
      }
      map.set(otherId, {
        userId: otherId as Id<"users">,
        name: isMine ? message.recipientName : message.senderName,
        // Un mensaje con formato se guarda como documento: en la lista se
        // enseña su texto, que el documento en JSON ahí no dice nada.
        preview: richDocToPlainText(message.text),
        at: message.createdAt,
        unread: !isMine && !message.read ? 1 : 0,
      });
    }
    return [...map.values()];
  }, [items, meId]);

  // Cierre del panel al pulsar fuera (suscripción al documento). Con el chat o
  // el alta de mensaje en pantalla no se escucha: ese clic es para volver a la
  // lista, no para cerrarla. El chat vive en un portal fuera del contenedor, así
  // que la comprobación de «dentro» solo se aplica a la lista.
  const listenOutside = closesListOnOutsideClick(panel);
  useEffect(() => {
    if (!listenOutside) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        dispatch({ type: "dismiss" });
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [listenOutside]);

  const contactList = contacts ?? [];

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => dispatch({ type: "toggle-list" })}
        onPointerDown={() => {
          // Antes de abrir se mide: sin esto, la primera vez abre en la esquina
          // y se coloca en su sitio en el render siguiente.
          if (!panel.listOpen) measure();
        }}
        aria-label={
          unreadTotal > 0 ? `Mensajes: ${unreadTotal} sin leer` : "Mensajes"
        }
        className="relative flex size-9 items-center justify-center rounded-lg border border-border/70 bg-card text-muted-foreground transition-colors hover:text-foreground"
      >
        <MessageCircle className="size-4" />
        {unreadTotal > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-signal px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
            {unreadTotal > 9 ? "9+" : unreadTotal}
          </span>
        )}
      </button>

      {panel.listOpen && (
        <div
          role="dialog"
          aria-label="Mensajes"
          style={listStyle}
          className="z-50 flex flex-col overflow-hidden rounded-xl border border-border/70 bg-popover shadow-lg"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border/70 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Mensajes
            </p>
            {canSend && (
              <button
                type="button"
                onClick={() => dispatch({ type: "open-composer" })}
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
                  onClick={() => dispatch({ type: "open-composer" })}
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
                      dispatch({
                        type: "open-thread",
                        thread: { id: thread.userId, name: thread.name },
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
      )}

      {panel.thread && (
        <ChatSheet
          thread={panel.thread}
          contacts={contactList}
          canSend={canSend}
          onClose={() => dispatch({ type: "close-thread" })}
        />
      )}

      {panel.composerOpen && canSend && (
        <NewMessageDialog
          contacts={contactList}
          onSent={(userId, name) =>
            dispatch({ type: "sent", thread: { id: userId, name } })
          }
          onClose={() => dispatch({ type: "close-composer" })}
        />
      )}
    </div>
  );
}

/** Conversación con un usuario: burbujas en vivo y campo de envío. */
function ChatSheet({
  thread,
  contacts,
  canSend,
  onClose,
}: {
  thread: { id: Id<"users">; name: string };
  contacts: Contact[];
  canSend: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const messages = useQuery(
    api.messages.thread,
    thread.id ? { userId: thread.id } : "skip",
  );
  const send = useMutation(api.messages.send);
  const markThreadRead = useMutation(api.messages.markThreadRead);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // El estado del campo es el documento que emite el editor; para el límite y
  // para saber si hay algo escrito se mira su texto.
  const plainText = richDocToPlainText(text);
  const canSubmit =
    !richDocIsEmpty(text) && plainText.length <= MAX_MESSAGE_TEXT;

  const meId = user?._id;
  const name =
    contacts.find((contact) => contact._id === thread.id)?.name ?? thread.name;

  // Al abrir, y ante cada mensaje entrante, se marca el hilo como leído.
  useEffect(() => {
    void markThreadRead({ userId: thread.id }).catch((error) => {
      console.warn("No se pudo marcar el hilo como leído:", error);
    });
  }, [thread.id, messages?.length, markThreadRead]);

  // Auto-scroll al final cuando llega contenido nuevo.
  useEffect(() => {
    const element = listRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages?.length]);

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Se manda el documento tal cual y el servidor lo normaliza. El envío es
    // el botón: dentro del editor, Enter escribe un salto de línea.
    if (!canSubmit) return;
    setBusy(true);
    try {
      await send({ recipientId: thread.id, text });
      setText("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader className="border-b border-border/70 pb-3">
          <SheetTitle className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-signal/10 text-sm font-semibold text-signal">
              {name.trim().charAt(0).toUpperCase() || "?"}
            </span>
            {name}
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
              Todavía no hay mensajes con {name}. Escribe el primero 👇
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
              placeholder={`Escribe a ${name}...`}
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

/** Elegir a quién escribir y enviar el primer mensaje. */
function NewMessageDialog({
  contacts,
  onSent,
  onClose,
}: {
  contacts: Contact[];
  onSent: (userId: Id<"users">, name: string) => void;
  onClose: () => void;
}) {
  const send = useMutation(api.messages.send);
  const [recipientId, setRecipientId] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plainText = richDocToPlainText(text);
  const canSubmit =
    !richDocIsEmpty(text) && plainText.length <= MAX_MESSAGE_TEXT;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!recipientId) {
      setError("Elige a quién quieres escribir.");
      return;
    }
    if (richDocIsEmpty(text)) {
      setError("Escribe un mensaje antes de enviarlo.");
      return;
    }
    if (plainText.length > MAX_MESSAGE_TEXT) {
      setError(
        `Los mensajes no pueden superar los ${MAX_MESSAGE_TEXT} caracteres.`,
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await send({ recipientId: recipientId as Id<"users">, text });
      const contact = contacts.find((item) => item._id === recipientId);
      toast.success("Mensaje enviado");
      onSent(recipientId as Id<"users">, contact?.name ?? "Contacto");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-4" />
            Nuevo mensaje
          </DialogTitle>
          <DialogDescription>
            Escribe a cualquier persona del taller. Verás la respuesta aquí
            mismo, en tiempo real.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="message-recipient">Para</Label>
            <Select
              value={recipientId}
              onValueChange={setRecipientId}
              disabled={busy}
            >
              <SelectTrigger id="message-recipient">
                <SelectValue placeholder="Elige un usuario" />
              </SelectTrigger>
              <SelectContent>
                {contacts.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No hay ningún usuario disponible
                  </SelectItem>
                ) : (
                  contacts.map((contact) => (
                    <SelectItem key={contact._id} value={contact._id}>
                      {contact.name}
                      {contact.position ? ` · ${contact.position}` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="message-text">Mensaje</Label>
            <RichTextEditor
              id="message-text"
              value={text}
              onChange={setText}
              placeholder="¿Me pasas el cable SDI del plató 2?"
              disabled={busy}
              compact
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="gap-2"
              disabled={busy || !canSubmit}
            >
              {busy ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
