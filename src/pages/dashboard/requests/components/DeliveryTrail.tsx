import { useQuery } from "convex/react";
import { PackageCheck } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { isDeliveryReason } from "@/lib/requestFlow";
import { REJECTION_REASON_LABELS, formatDateTime } from "@/lib/workshop";

/**
 * La constancia de las entregas de una petición: quién sacó el material, cuándo y
 * qué salió en cada tanda.
 *
 * Lo que las líneas no pueden contar. Una línea dice cuánto lleva entregado de su
 * repuesto, pero no quién lo entregó ni en cuántas veces salió —dos piezas pueden
 * haber salido juntas o en dos tandas de una, y la diferencia es lo que se
 * pregunta cuando hay que responder por una entrega—. Eso lo guarda la petición
 * como decisiones (`partRequests.decisions`), y aquí se lee tal cual.
 *
 * Solo las entregas: el resto de la constancia —rechazos, esperas,
 * devoluciones— ya se cuenta en las notas de la ficha (`DecisionNotes`).
 */
export function DeliveryTrail({
  requestId,
}: {
  requestId: Id<"partRequests">;
}) {
  const trail = useQuery(api.partRequests.decisions, { requestId });
  const entregas = (trail ?? []).filter((row) =>
    isDeliveryReason(row.decision?.reason),
  );
  if (entregas.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <PackageCheck className="size-3.5" />
        Entregas del material
      </p>
      <ol className="mt-2 space-y-2.5">
        {entregas.map((row) => (
          <li
            key={row._id}
            className="border-t border-border/50 pt-2 first:border-t-0 first:pt-0"
          >
            <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-medium">{row.by}</span>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(row.at)}
                {row.decision?.reason !== undefined &&
                  ` · ${
                    REJECTION_REASON_LABELS[row.decision.reason] ?? "Entrega"
                  }`}
              </span>
            </p>
            {row.decision?.note !== undefined && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {row.decision.note}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
