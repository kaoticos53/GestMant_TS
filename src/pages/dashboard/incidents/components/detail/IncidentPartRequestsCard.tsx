import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { incidentTakesPartRequests } from "@/lib/incidentFlow";
import {
  lineDelivered,
  lineRemaining,
  requestDelivery,
  requestMaterialState,
  type RequestMaterialState,
} from "@/lib/requestFlow";
import { richDocToPlainText } from "@/lib/richDoc";
import {
  PRIORITY_META,
  STATUS_META as REQUEST_STATUS_META,
  formatDateTime,
} from "@/lib/workshop";
import type { IncidentDoc } from "../../types";

const MATERIAL_STATE_LABEL: Record<RequestMaterialState, string> = {
  pending: "sin entregar",
  partial: "entrega parcial",
  delivered: "entregado",
  returned: "devuelto",
  dropped: "no se sirvió",
};

function untouchedLineLabel(material: RequestMaterialState): string {
  return material === "partial" || material === "delivered"
    ? MATERIAL_STATE_LABEL.pending
    : MATERIAL_STATE_LABEL[material];
}

export interface IncidentPartRequestsCardProps {
  incident: IncidentDoc;
  linkedRequests: Doc<"partRequests">[];
  canOpenRequests?: boolean;
  onOpenRequest?: (id: Id<"partRequests">) => void;
}

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
          {linkedRequests.map((request) => {
            const meta = REQUEST_STATUS_META[request.status];
            const archived = request.archivedAt !== undefined;
            const delivery = requestDelivery(request.lines, request.status);
            const material = requestMaterialState(request.status, delivery);
            const deliveredAt =
              material === "delivered"
                ? request.issuedAt
                : material === "returned"
                  ? request.returnedAt
                  : undefined;
            const described = richDocToPlainText(request.description);

            return (
              <li
                key={request._id}
                className="rounded-lg border border-border/60 bg-background/60 p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-muted-foreground">
                      {request.reference}
                    </span>
                    <Badge variant="outline" className={meta.badgeClassName}>
                      {meta.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {PRIORITY_META[request.priority].label}
                    </span>
                    {material === "partial" && (
                      <Badge
                        variant="outline"
                        className="border-amber-500/40 bg-amber-500/10 text-amber-800 first-letter:uppercase"
                      >
                        {MATERIAL_STATE_LABEL.partial}
                      </Badge>
                    )}
                    {archived && (
                      <Badge
                        variant="outline"
                        className="border-border bg-muted text-muted-foreground"
                      >
                        En el archivo
                      </Badge>
                    )}
                  </div>
                  {canOpenRequests && onOpenRequest && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 px-2 text-xs"
                      onClick={() => onOpenRequest(request._id)}
                    >
                      <ArrowUpRight className="size-3.5" />
                      {archived ? "Ver petición" : "Abrir petición"}
                    </Button>
                  )}
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  {meta.description} · abierta el {formatDateTime(request.createdAt)}{" "}
                  por {request.requesterName}
                </p>

                {request.lines.length > 0 ? (
                  <ul className="mt-2 divide-y divide-border/50 border-t border-border/50">
                    {request.lines.map((line) => {
                      const delivered = lineDelivered(line, request.status);
                      const remaining = lineRemaining(line, request.status);
                      return (
                        <li
                          key={line.sparePartId}
                          className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5"
                        >
                          <span className="min-w-0 truncate">
                            <span className="font-mono text-xs text-muted-foreground">
                              {line.code}
                            </span>{" "}
                            {line.name}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums">
                            <span className="text-muted-foreground">pedido </span>
                            <span className="font-semibold text-foreground">
                              ×{line.quantity}
                            </span>
                            <span className="text-muted-foreground">{" · "}</span>
                            {delivered > 0 ? (
                              <>
                                <span className="text-muted-foreground">
                                  entregado{" "}
                                </span>
                                <span className="font-semibold text-foreground">
                                  ×{delivered}
                                </span>
                                {remaining > 0 && (
                                  <>
                                    <span className="text-muted-foreground">
                                      {" · faltan "}
                                    </span>
                                    <span className="font-semibold text-foreground">
                                      ×{remaining}
                                    </span>
                                  </>
                                )}
                                {material === "returned" && (
                                  <span className="text-muted-foreground">
                                    {" · devuelto"}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-muted-foreground">
                                {untouchedLineLabel(material)}
                              </span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : described !== "" ? (
                  <p className="mt-2 whitespace-pre-line border-t border-border/50 pt-2 text-sm text-foreground/80">
                    {described}
                  </p>
                ) : (
                  <p className="mt-2 border-t border-border/50 pt-2 text-xs text-muted-foreground">
                    Sin repuesto del catálogo y sin descripción: la petición no dice
                    qué material falta.
                  </p>
                )}

                {deliveredAt !== undefined && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {material === "delivered"
                      ? "Material entregado el "
                      : "Material devuelto el "}
                    {formatDateTime(deliveredAt)}
                  </p>
                )}
                {archived && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Está en el archivo del taller: se abre en solo lectura, sin
                    sacarla de allí ni devolverla a la cola.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
