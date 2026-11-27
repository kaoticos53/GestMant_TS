import logo from "@/assets/logo.svg";
import { WorkshopAiChatButton } from "@/components/ai/WorkshopAiChatButton";
import { BackgroundJobsIndicator } from "@/components/jobs/BackgroundJobsIndicator";
import { MessagesCenter } from "@/components/MessagesCenter";
import { NotificationBell } from "@/components/NotificationBell";
import type { SidebarHeaderProps } from "./types";

export function SidebarHeader({
  isGuest = false,
  onOpenNotification,
  canSendMessages,
}: SidebarHeaderProps) {
  return (
    <div className="@container flex h-16 shrink-0 items-center justify-between gap-1.5 border-b border-border/70 px-3">
      <img
        src={logo}
        alt="Pulso Taller"
        className="size-8 shrink-0 rounded-lg ring-1 ring-border"
      />
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-sm font-semibold tracking-tight">
          Pulso Taller
        </span>
        <span className="hidden truncate text-xs text-muted-foreground @[235px]:block">
          Equipo audiovisual
        </span>
      </span>
      {!isGuest && (
        <div className="flex shrink-0 items-center gap-0.5">
          <NotificationBell onOpen={onOpenNotification} />
          <MessagesCenter canSend={canSendMessages} />
          <BackgroundJobsIndicator />
          <WorkshopAiChatButton />
        </div>
      )}
    </div>
  );
}
