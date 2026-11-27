import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RichText } from "@/components/RichText";
import type { Id } from "@/convex/_generated/dataModel";
import { formatHistoryNote } from "@/lib/richDoc";
import { INCIDENT_STATUS_META, formatDateTime } from "@/lib/workshop";
import type { IncidentDoc } from "../../types";

export interface IncidentHistoryCardProps {
  history: IncidentDoc["history"];
  onOpenIncident?: (id: Id<"incidents">) => void;
}

export function IncidentHistoryCard({
  history,
  onOpenIncident,
}: IncidentHistoryCardProps) {
  if (history.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Historial de estados
      </p>
      <ol className="mt-3 space-y-3">
        {history.map((entry, index) => {
          const meta = INCIDENT_STATUS_META[entry.status];
          const isRecurrenceEntry = Boolean(entry.linkedIncidentReference);
          return (
            <li
              key={`${entry.status}-${entry.at}-${index}`}
              className="flex gap-3"
            >
              <span className="mt-1 size-2 shrink-0 rounded-full bg-signal" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className={
                      isRecurrenceEntry
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        : meta.badgeClassName
                    }
                  >
                    {isRecurrenceEntry ? "Reabierta" : meta.label}
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
                    value={formatHistoryNote(entry.note) ?? entry.note}
                    className="mt-0.5 text-muted-foreground"
                  />
                )}
                {entry.linkedIncidentId && entry.linkedIncidentReference && (
                  <div className="mt-1">
                    {onOpenIncident ? (
                      <button
                        type="button"
                        onClick={() => onOpenIncident(entry.linkedIncidentId!)}
                        className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-2 py-0.5 font-mono text-xs font-medium text-signal hover:bg-muted"
                      >
                        {entry.linkedIncidentReference}
                        <ArrowUpRight className="size-3.5" />
                      </button>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">
                        {entry.linkedIncidentReference}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
