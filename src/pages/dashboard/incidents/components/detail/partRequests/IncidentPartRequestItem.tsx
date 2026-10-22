import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PRIORITY_META, formatDateTime } from "@/lib/workshop";
import { IncidentPartRequestLine } from "./IncidentPartRequestLine";
import { MATERIAL_STATE_LABEL, resolveRequestDeliveryMeta } from "./helpers";
import type { IncidentPartRequestItemProps } from "./types";

export function IncidentPartRequestItem({
  request,
  canOpenRequests = false,
  onOpenRequest,
}: IncidentPartRequestItemProps) {
  const {
    statusMeta,
    archived,
    material,
    deliveredAt,
    described,
  } = resolveRequestDeliveryMeta(request);

  return (
    <li className="rounded-lg border border-border/60 bg-background/60 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-muted-foreground">
            {request.reference}
          </span>
          <Badge variant="outline" className={statusMeta.badgeClassName}>
            {statusMeta.label}
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
        {statusMeta.description} · abierta el {formatDateTime(request.createdAt)}{" "}
        por {request.requesterName}
      </p>

      {request.lines.length > 0 ? (
        <ul className="mt-2 divide-y divide-border/50 border-t border-border/50">
          {request.lines.map((line) => (
            <IncidentPartRequestLine
              key={line.sparePartId}
              line={line}
              requestStatus={request.status}
              material={material}
            />
          ))}
        </ul>
      ) : described !== "" ? (
        <p className="mt-2 whitespace-pre-line border-t border-border/50 pt-2 text-sm text-foreground/80">
          {described}
        </p>
      ) : (
        <p className="mt-2 border-t border-border/50 pt-2 text-xs text-muted-foreground">
          Sin repuesto del catálogo y sin descripción: la petición no dice qué
          material falta.
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
          Está en el archivo del taller: se abre en solo lectura, sin sacarla de
          allí ni devolverla a la cola.
        </p>
      )}
    </li>
  );
}
