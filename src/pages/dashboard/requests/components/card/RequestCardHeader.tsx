import { Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PRIORITY_META,
  STATUS_META,
  formatRelativeTime,
} from "@/lib/workshop";
import type { RequestCardHeaderProps } from "./types";

export function RequestCardHeader({
  reference,
  priority,
  status,
  noReference,
  createdAt,
}: RequestCardHeaderProps) {
  const statusMeta = STATUS_META[status] ?? STATUS_META.pending;
  const priorityMeta = PRIORITY_META[priority];

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-semibold tracking-wide text-muted-foreground">
          {reference}
        </span>
        <Badge variant="outline" className={priorityMeta.badgeClassName}>
          {priorityMeta.label}
        </Badge>
        <Badge variant="outline" className={statusMeta.badgeClassName}>
          <span
            className={cn("size-1.5 rounded-full", statusMeta.dotClassName)}
          />
          {statusMeta.label}
        </Badge>
        {noReference && (
          <Badge
            variant="outline"
            className="border-amber-500/25 bg-amber-500/10 text-amber-700"
          >
            <Wrench className="size-3" />
            Sin repuesto
          </Badge>
        )}
      </div>
      <span className="text-xs text-muted-foreground">
        {formatRelativeTime(createdAt)}
      </span>
    </div>
  );
}
