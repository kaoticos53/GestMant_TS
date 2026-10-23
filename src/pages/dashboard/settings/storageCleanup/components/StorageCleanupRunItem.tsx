import {
  CLEANUP_PASS_META,
  formatRunDetail,
  formatRunTimestamp,
  formatRunTrigger,
} from "../helpers";
import type { StorageCleanupRunItemProps } from "../types";

export function StorageCleanupRunItem({ run }: StorageCleanupRunItemProps) {
  const meta = CLEANUP_PASS_META[run.pass];
  const timestampText = formatRunTimestamp(run.ranAt);
  const detailText = formatRunDetail(run);
  const triggerText = formatRunTrigger(run);

  return (
    <li className="rounded-lg border border-border/70 px-3 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-sm">{meta.label}</span>
        <span className="text-xs text-muted-foreground">{timestampText}</span>
      </div>
      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
        {detailText}
        {triggerText !== null && ` · ${triggerText}`}
      </p>
    </li>
  );
}
