import { PackageSearch } from "lucide-react";
import {
  PENDING_PARTS_UNSPECIFIED,
  pendingPartWait,
} from "@/lib/incidentTracking";
import { formatDateTime } from "@/lib/workshop";
import type { TrackingPendingPartsProps } from "../types";

/** Sección visual con las piezas que la incidencia espera o aviso de repuesto no especificado. */
export function TrackingPendingParts({
  missingParts,
  status,
  isClosed,
  arrivedAt,
  oldestPending,
}: TrackingPendingPartsProps) {
  if (missingParts.length > 0) {
    return (
      <section className="mt-3 rounded-xl border border-status-warning/30 bg-status-warning-surface p-3 text-status-warning-foreground">
        <h4 className="flex items-center gap-1.5 text-xs font-medium">
          <PackageSearch className="size-3.5 shrink-0" aria-hidden />
          Repuestos pendientes
        </h4>
        <ul className="mt-2 flex flex-col gap-1.5">
          {missingParts.map((part, index) => (
            <li
              key={`${part.since}-${index}`}
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm"
            >
              <span>
                <span className="font-semibold tabular-nums">
                  {part.quantity} ×
                </span>{" "}
                {part.name}
              </span>
              <span className="text-xs opacity-80">
                {pendingPartWait(part.since, arrivedAt)}
              </span>
            </li>
          ))}
        </ul>
        {oldestPending !== null && (
          <p className="mt-2 text-xs opacity-80">
            {missingParts.length === 1
              ? "Se pidió el"
              : "El más antiguo se pidió el"}{" "}
            {formatDateTime(oldestPending)}.
          </p>
        )}
      </section>
    );
  }

  if (status === "waitingParts" && !isClosed) {
    return (
      <p className="mt-3 rounded-xl border border-dashed border-border bg-card p-3 text-xs text-muted-foreground">
        {PENDING_PARTS_UNSPECIFIED}
      </p>
    );
  }

  return null;
}
