import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/workshop";
import { useMutation, useQuery } from "convex/react";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Avisos in-app del taller. Al abrir un aviso se marca como leído y se salta
 * al módulo de incidencias (si se pasa `onOpen`).
 */
export function NotificationBell({
  onOpen,
  className,
}: {
  /** Se invoca al elegir un aviso (para navegar a la cola de incidencias). */
  onOpen?: () => void;
  className?: string;
}) {
  const notifications = useQuery(api.notifications.list);
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cierre al pulsar fuera (suscripción al documento: setState en callback)
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const items = notifications ?? [];
  const unread = items.filter((item) => !item.read).length;

  const handleItem = async (item: {
    _id: Parameters<typeof markRead>[0]["id"];
    read: boolean;
  }) => {
    if (!item.read) {
      try {
        await markRead({ id: item._id });
      } catch (error) {
        console.warn("No se pudo marcar la notificación:", error);
      }
    }
    setOpen(false);
    onOpen?.();
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={
          unread > 0
            ? `Notificaciones: ${unread} sin leer`
            : "Notificaciones"
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
        <div className="absolute right-0 top-full z-50 mt-2 max-h-96 w-80 overflow-y-auto rounded-xl border border-border/70 bg-popover p-1.5 shadow-lg">
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
