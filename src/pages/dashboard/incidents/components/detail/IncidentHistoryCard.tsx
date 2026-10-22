import { Badge } from "@/components/ui/badge";
import { RichText } from "@/components/RichText";
import { INCIDENT_STATUS_META, formatDateTime } from "@/lib/workshop";
import type { IncidentDoc } from "../../types";

export interface IncidentHistoryCardProps {
  history: IncidentDoc["history"];
}

export function IncidentHistoryCard({ history }: IncidentHistoryCardProps) {
  if (history.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Historial de estados
      </p>
      <ol className="mt-3 space-y-3">
        {history.map((entry, index) => {
          const meta = INCIDENT_STATUS_META[entry.status];
          return (
            <li
              key={`${entry.status}-${entry.at}-${index}`}
              className="flex gap-3"
            >
              <span className="mt-1 size-2 shrink-0 rounded-full bg-signal" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className={meta.badgeClassName}>
                    {meta.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(entry.at)}
                  </span>
                  {entry.by && (
                    <span className="text-xs text-muted-foreground">
                      · {entry.by}
                    </span>
                  )}
                </div>
                {entry.note && (
                  <RichText
                    value={entry.note}
                    className="mt-0.5 text-muted-foreground"
                  />
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
