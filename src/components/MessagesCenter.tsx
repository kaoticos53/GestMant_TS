import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAnchoredPanel } from "@/hooks/use-anchored-panel";
import { useAuth } from "@/hooks/use-auth";
import {
  chatPanelReducer,
  closesListOnOutsideClick,
  initialChatPanel,
} from "@/lib/chatPanel";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { MessageCircle } from "lucide-react";
import { useEffect, useReducer, useRef } from "react";
import { ChatSheet } from "./messages/components/ChatSheet";
import { MessagesListPopover } from "./messages/components/MessagesListPopover";
import { NewMessageDialog } from "./messages/components/NewMessageDialog";
import { useMessageThreads } from "./messages/hooks/useMessageThreads";

export interface MessagesCenterProps {
  className?: string;
  /** Sin permiso de envío se queda solo de lectura. */
  canSend?: boolean;
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
}: MessagesCenterProps) {
  const { user } = useAuth();
  const rawMessages = useQuery(api.messages.list);
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
  // `overflow-hidden`, así que un desplegable `absolute` se vería cortado.
  const {
    style: listStyle,
    measure,
    triggerRef: buttonRef,
  } = useAnchoredPanel(panel.listOpen);

  const { unreadTotal, threads } = useMessageThreads(rawMessages, user?._id);

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
        <MessagesListPopover
          style={listStyle}
          threads={threads}
          canSend={canSend}
          onOpenComposer={() => dispatch({ type: "open-composer" })}
          onSelectThread={(thread) =>
            dispatch({
              type: "open-thread",
              thread,
            })
          }
        />
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
