import { Badge } from "@/components/ui/badge";
import { formatPublicCode } from "@/lib/publicCode";
import { isIncidentInWorkshop } from "@/lib/incidentFlow";
import {
  TRACKING_STATUS_NOTE,
  pendingPartsOldest,
  trackingAgeNote,
} from "@/lib/incidentTracking";
import { richDocToPlainText } from "@/lib/richDoc";
import {
  INCIDENT_PRIORITY_META,
  INCIDENT_STATUS_META,
  formatDateTime,
  formatRelativeTime,
  incidentStatusLabel,
  normalizeIncidentPriority,
} from "@/lib/workshop";
import {
  getTrackingCurrentSince,
  getTrackingEquipmentTitle,
  getTrackingMissingParts,
} from "../helpers";
import type { TrackingCardProps } from "../types";
import { TrackingDetailsList } from "./TrackingDetailsList";
import { TrackingHistoryTimeline } from "./TrackingHistoryTimeline";
import { TrackingPendingParts } from "./TrackingPendingParts";

/** Tarjeta principal con la información pública recortada de la incidencia consultada. */
export function TrackingCard({ tracking, arrivedAt }: TrackingCardProps) {
  const status = INCIDENT_STATUS_META[tracking.status];
  const priorityMeta =
    INCIDENT_PRIORITY_META[normalizeIncidentPriority(tracking.priority)];
  const inWorkshop = isIncidentInWorkshop({
    status: tracking.status,
    workshopAssigneeName: tracking.workshopAssigneeName ?? undefined,
  });
  const statusLabel = incidentStatusLabel(tracking.status, inWorkshop);

  const ageNote = trackingAgeNote({
    reportedAt: tracking.reportedAt,
    closedAt: tracking.closedAt,
    now: arrivedAt,
  });

  const currentSince = getTrackingCurrentSince(tracking);
  const description = richDocToPlainText(tracking.description).trim();
  const missingParts = getTrackingMissingParts(tracking);
  const oldestPending = pendingPartsOldest(missingParts);

  return (
    <article className="mt-4 rounded-xl border border-border/70 bg-card p-4 text-left shadow-sm">
      <header className="flex flex-wrap items-center gap-2">
        <span className="select-all font-mono text-sm font-semibold text-foreground">
          {tracking.code === null
            ? "Sin código"
            : formatPublicCode(tracking.code)}
        </span>
        <Badge variant="outline" className={status.badgeClassName}>
          {statusLabel}
        </Badge>
        <Badge variant="outline" className={priorityMeta.badgeClassName}>
          Prioridad: {priorityMeta.label}
        </Badge>
      </header>

      <h3 className="mt-2 text-base font-semibold tracking-tight">
        {getTrackingEquipmentTitle(tracking)}
      </h3>

      <p className="mt-1 text-sm leading-6">
        {TRACKING_STATUS_NOTE[tracking.status]}
      </p>

      <p className="mt-1 text-xs text-muted-foreground">
        {ageNote}
        {currentSince !== null &&
          ` En este punto desde ${formatRelativeTime(currentSince)}.`}
      </p>

      <TrackingPendingParts
        missingParts={missingParts}
        status={tracking.status}
        isClosed={tracking.closedAt !== null}
        arrivedAt={arrivedAt}
        oldestPending={oldestPending}
      />

      <TrackingDetailsList tracking={tracking} />

      {tracking.priorityNote && (
        <section className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <h4 className="text-xs font-medium text-amber-800 dark:text-amber-300">
            Motivo del cambio de prioridad
            {tracking.priorityChangedAt
              ? ` · ${formatDateTime(tracking.priorityChangedAt)}`
              : ""}
          </h4>
          <p className="mt-1 whitespace-pre-line text-sm leading-6">
            {tracking.priorityNote}
          </p>
        </section>
      )}

      {tracking.userNote && (
        <section className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
          <h4 className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
            Nota para el usuario
          </h4>
          <p className="mt-1 whitespace-pre-line text-sm leading-6">
            {tracking.userNote}
          </p>
        </section>
      )}

      {description !== "" && (
        <section className="mt-4">
          <h4 className="text-xs font-medium text-muted-foreground">
            Lo que se avisó
          </h4>
          <p className="mt-1 whitespace-pre-line text-sm leading-6">
            {description}
          </p>
        </section>
      )}

      <TrackingHistoryTimeline history={tracking.history} />

      <p className="mt-4 border-t border-border/70 pt-3 text-xs text-muted-foreground">
        Este es el resumen que se puede consultar con el código: las notas
        internas, los documentos y quién dio cada paso se quedan en el taller.
      </p>
    </article>
  );
}
