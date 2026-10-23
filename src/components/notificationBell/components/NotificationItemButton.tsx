import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/workshop";
import type { NotificationItemButtonProps } from "../types";

export function NotificationItemButton({
  item,
  onSelect,
}: NotificationItemButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={cn(
        "flex w-full flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left transition-colors",
        item.read ? "hover:bg-muted" : "bg-signal/5 hover:bg-signal/10",
      )}
    >
      <span
        className={cn(
          "text-sm leading-5",
          item.read ? "text-muted-foreground" : "font-medium text-foreground",
        )}
      >
        {item.text}
      </span>
      <span className="text-xs text-muted-foreground">
        {formatRelativeTime(item.createdAt)}
      </span>
    </button>
  );
}
