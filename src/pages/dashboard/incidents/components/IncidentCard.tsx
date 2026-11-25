import { Archive, MapPin, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RichText } from "@/components/RichText";
import {
  canAdvanceIncident,
  isClosedIncident,
  isIncidentInWorkshop,
} from "@/lib/incidentFlow";
import { cn } from "@/lib/utils";
import {
  INCIDENT_PRIORITY_META,
  INCIDENT_STATUS_META,
  formatDateTime,
  incidentStatusLabel,
  normalizeIncidentPriority,
} from "@/lib/workshop";
import type { IncidentDoc } from "../types";

export function IncidentCard({
  incident,
  compact,
  canAssign,
  canSelfAssign = false,
  archiving,
  selfAssigning = false,
  selected = false,
  onOpen,
  onSelfAssign,
  onArchive,
  onToggleSelect,
}: {
  incident: IncidentDoc;
  compact: boolean;
  canAssign: boolean;
  canSelfAssign?: boolean;
  archiving: boolean;
  selfAssigning?: boolean;
  selected?: boolean;
  onOpen: () => void;
  onSelfAssign?: () => void;
  onArchive: () => void;
  onToggleSelect?: () => void;
}) {
  const status = INCIDENT_STATUS_META[incident.status];
  const priorityMeta =
    INCIDENT_PRIORITY_META[normalizeIncidentPriority(incident.priority)];
  const isClosed = isClosedIncident(incident.status);
  const showSelfAssign = Boolean(
    canSelfAssign &&
      onSelfAssign &&
      canAdvanceIncident(incident.status, "selfAssign"),
  );
  const showArchive = canAssign && isClosed;
  const hasFooterActions = showSelfAssign || showArchive;
  // El estado de la espera y el de la reparación se enseñan con
  // el sitio: «En espera de repuestos · taller».
  const statusLabel = incidentStatusLabel(
    incident.status,
    isIncidentInWorkshop(incident),
  );

  return (
    <div data-row className="relative">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "w-full rounded-xl border border-border/70 bg-card text-left shadow-sm transition-colors hover:border-signal/40",
          compact ? "px-3 py-2" : "p-4",
          hasFooterActions && "pb-12",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-muted-foreground">
              {incident.reference}
            </span>
            <Badge variant="outline" className={status.badgeClassName}>
              {statusLabel}
            </Badge>
            <Badge variant="outline" className={priorityMeta.badgeClassName}>
              {priorityMeta.label}
            </Badge>
            {incident.location && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" />
                {incident.location}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {formatDateTime(incident.reportedAt)}
          </span>
        </div>
        <p
          className={cn(
            "truncate text-sm font-semibold tracking-tight",
            compact ? "mt-1" : "mt-2",
          )}
        >
          {incident.equipmentKind} · {incident.model}
          {incident.serialNumber && (
            <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
              {incident.serialNumber}
            </span>
          )}
        </p>
        <RichText
          value={incident.description}
          className={cn(
            "mt-1 text-sm leading-6 text-muted-foreground",
            compact ? "line-clamp-1" : "line-clamp-2",
            "[&_img]:max-h-36 [&_img]:w-auto [&_img]:rounded-md [&_img]:object-contain",
            compact && "[&_img]:hidden",
          )}
        />
        <div
          className={cn(
            "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground",
            compact ? "mt-1.5" : "mt-2.5",
          )}
        >
          <span>Por {incident.reporterName}</span>
          {incident.reporterRole && <span>· {incident.reporterRole}</span>}
          {incident.assigneeName && (
            <span className="font-medium text-foreground">
              · Técnico: {incident.assigneeName}
            </span>
          )}
          {incident.workshopAssigneeName && (
            <span className="font-medium text-status-warning-foreground">
              · Taller: {incident.workshopAssigneeName}
            </span>
          )}
        </div>
      </button>

      {hasFooterActions && (
        <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2">
          {showArchive && onToggleSelect && (
            <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border/70 bg-card px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
              <Checkbox
                checked={selected}
                onCheckedChange={() => onToggleSelect()}
                aria-label={`Seleccionar ${incident.reference}`}
              />
              <span>Sel.</span>
            </label>
          )}
          {showSelfAssign && onSelfAssign && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              title={`Autoasignarme ${incident.reference}`}
              aria-label={`Autoasignarme ${incident.reference}`}
              disabled={selfAssigning}
              onClick={onSelfAssign}
              className="gap-1.5 bg-card"
            >
              <UserCheck className="size-3.5" />
              {selfAssigning ? "Asignando…" : "Autoasignarme"}
            </Button>
          )}
          {showArchive && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              title={`Mandar ${incident.reference} al archivo`}
              aria-label={`Archivar ${incident.reference}`}
              disabled={archiving}
              onClick={onArchive}
              className="gap-1.5 bg-card"
            >
              <Archive className="size-3.5" />
              Archivar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
