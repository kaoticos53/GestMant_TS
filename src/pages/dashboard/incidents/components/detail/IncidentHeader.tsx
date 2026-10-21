import { Badge } from "@/components/ui/badge";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDateTime } from "@/lib/workshop";
import type { IncidentDoc } from "../../types";

export interface IncidentHeaderProps {
  incident: IncidentDoc;
  statusLabel: string;
  badgeClassName: string;
  statusDescription: string;
}

export function IncidentHeader({
  incident,
  statusLabel,
  badgeClassName,
  statusDescription,
}: IncidentHeaderProps) {
  return (
    <SheetHeader className="sticky top-0 z-20 border-b border-border/70 bg-background/95 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="select-all font-mono text-sm font-semibold text-muted-foreground">
          {incident.reference}
        </span>
        <Badge variant="outline" className={badgeClassName}>
          {statusLabel}
        </Badge>
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
