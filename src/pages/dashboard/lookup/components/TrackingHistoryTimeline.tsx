import { CalendarClock } from "lucide-react";
import {
  INCIDENT_STATUS_META,
  formatDateTime,
  formatRelativeTime,
} from "@/lib/workshop";
import type { TrackingHistoryTimelineProps } from "../types";

/** Línea temporal con las transiciones históricas de estado de la incidencia. */
export function TrackingHistoryTimeline({
  history,
}: TrackingHistoryTimelineProps) {
  if (history.length === 0) return null;

  return (
    <section className="mt-4 border-t border-border/70 pt-3">
      <h4 className="text-xs font-medium text-muted-foreground">
        Cómo ha avanzado
      </h4>
      <ol className="mt-2 flex flex-col gap-2">
        {history.map((entry, index) => (
          <li
            key={`${entry.status}-${entry.at}-${index}`}
            className="flex flex-wrap items-center gap-x-2 text-xs"
          >
            <CalendarClock
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="font-medium">
              {INCIDENT_STATUS_META[entry.status].label}
            </span>
            <span className="text-muted-foreground">
              {formatDateTime(entry.at)} · {formatRelativeTime(entry.at)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
