import { Label } from "@/components/ui/label";
import { formatHistoryStatus } from "../helpers";
import type { WeeklyReportHistoryListProps } from "../types";

export function WeeklyReportHistoryList({
  history,
}: WeeklyReportHistoryListProps) {
  if (history.length === 0) return null;

  return (
    <div className="grid gap-2">
      <Label className="text-sm">Últimos envíos</Label>
      <ul className="grid gap-1.5">
        {history.map((item) => (
          <li
            key={item.key}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2 text-xs"
          >
            <span className="font-medium">{item.subject}</span>
            <span
              className={
                item.status === "sent"
                  ? "text-emerald-700"
                  : "text-destructive"
              }
            >
              {formatHistoryStatus(item.status, item.recipients.length, item.sentAt)}
            </span>
            {item.error && (
              <span className="w-full text-muted-foreground">
                {item.error}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
