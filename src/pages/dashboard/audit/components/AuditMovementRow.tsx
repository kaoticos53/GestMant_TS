import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  INCIDENT_STATUS_META,
  documentTrailLabel,
  formatClockTime,
  formatDateTime,
} from "@/lib/workshop";
import type { AuditMovementRowProps } from "../types";

/** Fila individual que representa un movimiento del rastro documental. */
export function AuditMovementRow({
  entry,
  compact,
  onOpenIncident,
}: AuditMovementRowProps) {
  const meta = entry.status ? INCIDENT_STATUS_META[entry.status] : undefined;

  return (
    <li
      data-row
      className={cn(
        "flex flex-wrap items-start justify-between gap-3",
        compact ? "px-3 py-1.5" : "px-4 py-3",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className={cn(compact ? "text-xs leading-5" : "text-sm leading-6")}>
          {documentTrailLabel(entry)}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{entry.by}</span>
          {entry.archived ? (
            <span className="font-mono">{entry.reference}</span>
          ) : (
            <button
              type="button"
              onClick={() => onOpenIncident(entry.incidentId)}
              title={`Abrir la ficha de ${entry.reference}`}
              className="cursor-pointer rounded font-mono font-medium text-signal underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {entry.reference}
            </button>
          )}
          {entry.title !== "" && <span>{entry.title}</span>}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {meta && (
          <Badge variant="outline" className={meta.badgeClassName}>
            {meta.label}
          </Badge>
        )}
        {entry.archived && (
          <Badge variant="outline" className="font-normal">
            Archivada
          </Badge>
        )}
        <span
          className="text-xs text-muted-foreground"
          title={formatDateTime(entry.at)}
        >
          {formatClockTime(entry.at)}
        </span>
      </div>
    </li>
  );
}
