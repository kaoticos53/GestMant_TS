import type { NotificationsPanelProps } from "../types";
import { NotificationItemButton } from "./NotificationItemButton";

export function NotificationsPanel({
  items,
  unread,
  panelRef,
  panelStyle,
  onMarkAllRead,
  onSelect,
}: NotificationsPanelProps) {
  return (
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
            onClick={onMarkAllRead}
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
          <NotificationItemButton
            key={item._id}
            item={item}
            onSelect={onSelect}
          />
        ))
      )}
    </div>
  );
}
