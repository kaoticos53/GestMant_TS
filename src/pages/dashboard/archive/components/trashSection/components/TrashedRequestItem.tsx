import { Badge } from "@/components/ui/badge";
import { trashRemainingLabel } from "@/lib/trash";
import { STATUS_META } from "@/lib/workshop";
import { formatRequestContext, formatTrashRetireDetails } from "../helpers";
import type { TrashedRequestItemProps } from "../types";
import { TrashButtons } from "./TrashButtons";

export function TrashedRequestItem({
  row,
  busyId,
  onOpen,
  onRestore,
  onDelete,
}: TrashedRequestItemProps) {
  const item = row.item;
  const meta = STATUS_META[item.status] ?? STATUS_META.pending;
  const context = formatRequestContext(
    item.requesterName,
    item.requesterTeam,
    item.equipment,
  );

  return (
    <article className="flex flex-wrap items-start gap-3 rounded-lg border border-border/70 bg-background/60 p-3">
      <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-muted-foreground">
            {item.reference}
          </span>
          <Badge variant="outline" className={meta.badgeClassName}>
            {meta.label}
          </Badge>
          <span className="text-[11px] font-medium uppercase tracking-wide text-destructive">
            {trashRemainingLabel(item.purgeAt)}
          </span>
        </div>
        <p className="text-sm font-medium leading-5">
          {item.summary || "Petición sin repuesto"}
        </p>
        {context !== "" && (
          <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
            {context}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {formatTrashRetireDetails(
            item.deletedAt,
            item.deletedBy,
            item.deletedReason,
            item.archived,
          )}
        </p>
      </div>
      <TrashButtons
        row={row}
        busyId={busyId}
        onOpen={onOpen}
        onRestore={onRestore}
        onDelete={onDelete}
      />
    </article>
  );
}
