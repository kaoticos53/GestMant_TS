import { RichText } from "@/components/RichText";
import { formatDateTime } from "@/lib/workshop";
import type { IncidentAssignmentSectionProps } from "./types";

export function IncidentAssignmentSection({
  incident,
  inWorkshop,
}: IncidentAssignmentSectionProps) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Asignación
      </p>
      <div className="mt-2 grid gap-2 text-sm">
        <p>
          <span className="text-muted-foreground">Técnico: </span>
          {incident.assigneeName ?? "Sin asignar"}
        </p>
        {inWorkshop && (
          <p>
            <span className="text-muted-foreground">Entrada a taller: </span>
            {incident.workshopAssigneeName ?? "—"}
          </p>
        )}
        {incident.closedAt && (
          <p>
            <span className="text-muted-foreground">Cerrada: </span>
            {formatDateTime(incident.closedAt)}
          </p>
        )}
        {incident.notes && (
          <RichText
            value={incident.notes}
            className="rounded-lg border border-border/70 bg-background/60 p-3 text-sm leading-6"
          />
        )}
      </div>
    </div>
  );
}
