import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  INCIDENT_PRIORITY_META,
  formatDateTime,
  normalizeIncidentPriority,
} from "@/lib/workshop";
import { Flag } from "lucide-react";
import type { IncidentDoc } from "../../types";

export interface IncidentHeaderProps {
  incident: IncidentDoc;
  statusLabel: string;
  badgeClassName: string;
  statusDescription: string;
  onChangePriority?: () => void;
}

export function IncidentHeader({
  incident,
  statusLabel,
  badgeClassName,
  statusDescription,
  onChangePriority,
}: IncidentHeaderProps) {
  const priorityMeta =
    INCIDENT_PRIORITY_META[normalizeIncidentPriority(incident.priority)];
  return (
    <SheetHeader className="sticky top-0 z-20 border-b border-border/70 bg-background/95 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="select-all font-mono text-sm font-semibold text-muted-foreground">
          {incident.reference}
        </span>
        <Badge variant="outline" className={badgeClassName}>
          {statusLabel}
        </Badge>
        <Badge variant="outline" className={priorityMeta.badgeClassName}>
          Prioridad: {priorityMeta.label}
        </Badge>
        {onChangePriority && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onChangePriority}
            className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Flag className="size-3" />
            Cambiar prioridad
          </Button>
        )}
        {incident.maintenanceId && (
          <Badge
            variant="outline"
            className="border-emerald-600/25 bg-emerald-600/10 text-emerald-700"
          >
            Ficha creada
          </Badge>
        )}
      </div>
      <SheetTitle className="text-xl tracking-tight">
        {incident.equipmentKind} · {incident.model}
      </SheetTitle>
      <SheetDescription>
        {statusDescription} · notificada {formatDateTime(incident.reportedAt)}
      </SheetDescription>
    </SheetHeader>
  );
}
