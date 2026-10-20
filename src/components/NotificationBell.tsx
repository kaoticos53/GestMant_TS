import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAnchoredPanel } from "@/hooks/use-anchored-panel";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/workshop";
import { useMutation, useQuery } from "convex/react";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Una fila tal y como la da la consulta del backend (y como la reciben las
 * props de prueba, que las sustituyen con la misma forma). */
export type NotificationRow = {
  _id: Id<"notifications">;
  text: string;
  read: boolean;
  incidentId?: Id<"incidents">;
  createdAt: number;
};

/**
 * Avisos in-app del taller. Al abrir un aviso se marca como leído y se salta a
 * lo que el aviso apunta: si lleva `incidentId`, a la ficha de esa incidencia;
 * si no, lo que diga `onOpen` (la cola de incidencias, por defecto).
 *
 * Los avisos y su lectura llegan del backend con los hooks de Convex; las props
 * `notifications`, `markRead` y `markAllRead` los sustituyen cuando las pasan
 * (las pruebas), y quien no las pasa usa el backend, como siempre.
 */
export function NotificationBell({
  onOpen,
  className,
  notifications: notificationsProp,
  markRead: markReadProp,
  markAllRead: markAllReadProp,
}: {
  /**
   * Se invoca al elegir un aviso. Recibe el aviso elegido —los que llevan
   * `incidentId` llevan a su ficha—; el que no lleva, al que abriría `onOpen`.
   */
  onOpen?: (notification: { incidentId?: Id<"incidents"> | null }) => void;
  className?: string;
  notifications?: NotificationRow[];
  markRead?: (args: { id: Id<"notifications"> }) => Promise<void>;
  markAllRead?: () => Promise<void>;
}) {
  const notificationsDelBackend = useQuery(api.notifications.list);
  const notifications = (notificationsProp ?? notificationsDelBackend) as
    NotificationRow[] | undefined;
  const markReadBackend = useMutation(api.notifications.markRead);
  const markRead = markReadProp ?? markReadBackend;
  const markAllReadBackend = useMutation(api.notifications.markAllRead);
  const markAllRead = markAllReadProp ?? markAllReadBackend;
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // El desplegable se ancla a la ventana (no a su contenedor), que es lo que
  // impide que lo corte el panel lateral o la cabecera: el mismo anclaje que
  // usa el icono de mensajes, en `@/hooks/use-anchored-panel`.
  const {
    style: panelStyle,
    measure,
    triggerRef: buttonRef,
  } = useAnchoredPanel(open);

  // Cierre al pulsar fuera, teclado y al perder el foco (suscripción al
  // documento: setState en callback).
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Al cerrar con el teclado, el foco vuelve a la campana: antes se quedaba
      // en el vacío y el siguiente tabulador empezaba por el principio.
      buttonRef.current?.focus();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
    // `buttonRef` es un `useRef` estable: va en la lista porque lo usa el cierre
    // con `Esc`, y así la regla de dependencias no queda esquivada.
  }, [open, buttonRef]);

  // Al abrir, el foco entra en el panel: se anuncia como diálogo y lo que hay
  // dentro se recorre con el tabulador, sin quedarse en el botón de la campana.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const items = notifications ?? [];
  const unread = items.filter((item) => !item.read).length;

  const handleItem = async (item: {
    _id: Parameters<typeof markRead>[0]["id"];
    read: boolean;
    incidentId?: Id<"incidents"> | null;
  }) => {
    if (!item.read) {
      try {
        await markRead({ id: item._id });
      } catch (error) {
        console.warn("No se pudo marcar la notificación:", error);
      }
    }
    setOpen(false);
    // El aviso manda: si apunta a una ficha, es ahí a donde se va. Si no, al
    // sitio que diga quien monta la campana (en el taller, la cola).
    onOpen?.({ incidentId: item.incidentId ?? null });
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        onPointerDown={() => {
          // Antes de abrir se mide: sin esto, la primera vez abre en (0,0) y
          // se pega la esquina; con esto, abre ya en su sitio.
          if (!open) measure();
        }}
        aria-label={
          unread > 0 ? `Notificaciones: ${unread} sin leer` : "Notificaciones"
        }
        className="relative flex size-9 items-center justify-center rounded-lg border border-border/70 bg-card text-muted-foreground transition-colors hover:text-foreground"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-signal px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-label="Notificaciones"
          style={panelStyle}
          className="z-50 overflow-y-auto rounded-xl border border-border/70 bg-popover p-1.5 pt-2 shadow-lg outline-none"
        >
          <div className="flex items-center justify-between px-2.5 py-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Notificaciones
            </p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-medium text-signal hover:underline"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No tienes avisos pendientes.
            </p>
          ) : (
            items.map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => void handleItem(item)}
                className={cn(
                  "flex w-full flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                  item.read
                    ? "hover:bg-muted"
                    : "bg-signal/5 hover:bg-signal/10",
                )}
              >
                <span
                  className={cn(
                    "text-sm leading-5",
                    item.read
                      ? "text-muted-foreground"
                      : "font-medium text-foreground",
                  )}
                >
                  {item.text}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(item.createdAt)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
