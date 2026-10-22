import logo from "@/assets/logo.svg";
import { MessagesCenter } from "@/components/MessagesCenter";
import { NotificationBell } from "@/components/NotificationBell";
import type { SidebarHeaderProps } from "./types";

export function SidebarHeader({
  onOpenNotification,
  canSendMessages,
}: SidebarHeaderProps) {
  return (
    <div className="flex h-16 items-center justify-between gap-2.5 border-b border-border/70 px-5">
      <img
        src={logo}
        alt="Pulso Taller"
        className="size-8 rounded-lg ring-1 ring-border"
      />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-semibold tracking-tight">
          Pulso Taller
        </span>
        <span className="truncate text-xs text-muted-foreground">
          Equipo audiovisual
        </span>
      </span>
      <div className="flex items-center gap-1.5">
        <NotificationBell onOpen={onOpenNotification} />
        <MessagesCenter canSend={canSendMessages} />
      </div>
    </div>
  );
}
