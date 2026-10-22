import { incidentTakesPartRequests } from "@/lib/incidentFlow";
import { IncidentPartRequestItem } from "./partRequests";
import type { IncidentPartRequestsCardProps } from "./partRequests";

export type { IncidentPartRequestsCardProps };

export function IncidentPartRequestsCard({
  incident,
  linkedRequests,
  canOpenRequests = false,
  onOpenRequest,
}: IncidentPartRequestsCardProps) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Peticiones de material
        </p>
        {linkedRequests.length > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {linkedRequests.length}
          </span>
        )}
      </div>
      {linkedRequests.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No se ha pedido material para este caso.
          {incidentTakesPartRequests(incident.status) &&
            " Cuando falte una pieza, se abre una petición desde las acciones de la ficha."}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {linkedRequests.map((request) => (
            <IncidentPartRequestItem
              key={request._id}
              request={request}
              canOpenRequests={canOpenRequests}
              onOpenRequest={onOpenRequest}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
