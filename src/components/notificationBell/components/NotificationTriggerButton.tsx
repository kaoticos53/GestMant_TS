import { Bell } from "lucide-react";
import { formatBadgeCount, getTriggerAriaLabel } from "../helpers";
import type { NotificationTriggerButtonProps } from "../types";

export function NotificationTriggerButton({
  open,
  unread,
  buttonRef,
  onToggle,
  onMeasure,
}: NotificationTriggerButtonProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onToggle}
      onPointerDown={() => {
        // Antes de abrir se mide: sin esto, la primera vez abre en (0,0) y
        // se pega la esquina; con esto, abre ya en su sitio.
        if (!open) onMeasure();
      }}
      aria-label={getTriggerAriaLabel(unread)}
      className="relative flex size-9 items-center justify-center rounded-lg border border-border/70 bg-card text-muted-foreground transition-colors hover:text-foreground"
    >
      <Bell className="size-4" />
      {unread > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-signal px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
          {formatBadgeCount(unread)}
        </span>
      )}
    </button>
  );
}
