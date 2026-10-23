import { api } from "@/convex/_generated/api";
import { useAnchoredPanel } from "@/hooks/use-anchored-panel";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { useRef, useState } from "react";
import {
  NotificationTriggerButton,
  NotificationsPanel,
  countUnread,
  useNotificationBellDismiss,
  type NotificationBellProps,
  type NotificationRow,
} from "./notificationBell/index";

export type { NotificationRow };

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
}: NotificationBellProps) {
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

  const {
    style: panelStyle,
    measure,
    triggerRef: buttonRef,
  } = useAnchoredPanel(open);

  useNotificationBellDismiss({
    open,
    containerRef,
    panelRef,
    buttonRef,
    onClose: () => setOpen(false),
  });

  const items = notifications ?? [];
  const unread = countUnread(items);

  const handleItem = async (item: NotificationRow) => {
    if (!item.read) {
      try {
        await markRead({ id: item._id });
      } catch (error) {
        console.warn("No se pudo marcar la notificación:", error);
      }
    }
    setOpen(false);
    onOpen?.({ incidentId: item.incidentId ?? null });
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <NotificationTriggerButton
        open={open}
        unread={unread}
        buttonRef={buttonRef}
        onToggle={() => setOpen((value) => !value)}
        onMeasure={measure}
      />

      {open && (
        <NotificationsPanel
          items={items}
          unread={unread}
          panelRef={panelRef}
          panelStyle={panelStyle}
          onMarkAllRead={() => void markAllRead()}
          onSelect={(item) => void handleItem(item)}
        />
      )}
    </div>
  );
}
