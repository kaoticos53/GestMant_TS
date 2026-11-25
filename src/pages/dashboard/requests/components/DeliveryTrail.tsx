import { useQuery } from "convex/react";
import { PackageCheck, ShoppingCart, Undo2 } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { isDeliveryReason, isReturnReason } from "@/lib/requestFlow";
import { REJECTION_REASON_LABELS, formatDateTime } from "@/lib/workshop";

interface TimelineEntry {
  key: string;
  at: number;
  kind: "delivery" | "return" | "purchase";
  actor: string;
  title: string;
  detail?: string;
}

function timelineHeading(
  hasDeliveries: boolean,
  hasReturns: boolean,
  hasPurchases: boolean,
): string {
  const parts: string[] = [];
  if (hasDeliveries) parts.push("entregas");
  if (hasReturns) parts.push("devoluciones");
  if (hasPurchases) parts.push("compras");

  if (parts.length === 3) return "Entregas, devoluciones y compras";
  if (parts.length === 2) {
    const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    return `${first} y ${parts[1]}`;
  }
  if (hasReturns) return "Devoluciones del material";
  if (hasPurchases) return "Historial de compras";
  return "Entregas del material";
}

/**
 * Constancia cronológica de entregas, devoluciones e hitos de compra de una petición.
 */
export function DeliveryTrail({
  requestId,
}: {
  requestId: Id<"partRequests">;
}) {
  const trail = useQuery(api.partRequests.decisions, { requestId });
  const purchasing = useQuery(api.purchasing.byRequest, { requestId });

  const entregas: TimelineEntry[] = (trail ?? [])
    .filter((row) => isDeliveryReason(row.decision?.reason))
    .map((row) => ({
      key: `delivery-${row._id}`,
      at: row.at,
      kind: "delivery",
      actor: row.by,
      title:
        row.decision?.reason !== undefined
          ? (REJECTION_REASON_LABELS[row.decision.reason] ?? "Entrega")
          : "Entrega",
      detail: row.decision?.note,
    }));

  const devoluciones: TimelineEntry[] = (trail ?? [])
    .filter((row) => isReturnReason(row.decision?.reason))
    .map((row) => ({
      key: `return-${row._id}`,
      at: row.at,
      kind: "return",
      actor: row.by,
      title:
        row.decision?.reason !== undefined
          ? (REJECTION_REASON_LABELS[row.decision.reason] ?? "Devolución")
          : "Devolución",
      detail: row.decision?.note,
    }));

  const purchaseEntries: TimelineEntry[] = [];
  const ordersById = new Map(
    (purchasing?.orders ?? []).map((order) => [order._id, order]),
  );

  for (const pr of purchasing?.requests ?? []) {
    purchaseEntries.push({
      key: `pr-req-${pr._id}`,
      at: pr.requestedAt,
      kind: "purchase",
      actor: pr.requestedBy,
      title: `Compra solicitada (${pr.reference})`,
      detail: `${pr.quantity} ${pr.unit} · ${pr.code} ${pr.name} · ${pr.supplier}`,
    });
    if (pr.orderedAt !== undefined && pr.orderId) {
      const order = ordersById.get(pr.orderId);
      purchaseEntries.push({
        key: `pr-ord-${pr._id}`,
        at: pr.orderedAt,
        kind: "purchase",
        actor: order?.orderedBy ?? "Compras",
        title: order
          ? `Incluida en orden ${order.reference}`
          : "Incluida en orden de compra",
        detail: `${pr.reference} · ${pr.supplier}`,
      });
    }
  }

  for (const rec of purchasing?.receptions ?? []) {
    purchaseEntries.push({
      key: `rec-${rec._id}`,
      at: rec.receivedAt,
      kind: "purchase",
      actor: rec.receivedBy,
      title: `Material recibido (${rec.orderReference})`,
      detail: `Albarán ${rec.deliveryNote.name}`,
    });
  }

  const entries = [...entregas, ...devoluciones, ...purchaseEntries].sort(
    (a, b) => a.at - b.at,
  );
  if (entries.length === 0) return null;

  const heading = timelineHeading(
    entregas.length > 0,
    devoluciones.length > 0,
    purchaseEntries.length > 0,
  );

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <PackageCheck className="size-3.5" />
        {heading}
      </p>
      <ol className="mt-2 space-y-2.5">
        {entries.map((entry) => (
          <li
            key={entry.key}
            className="border-t border-border/50 pt-2 first:border-t-0 first:pt-0"
          >
            <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
              {entry.kind === "purchase" && (
                <ShoppingCart className="inline size-3.5 text-muted-foreground" />
              )}
              {entry.kind === "return" && (
                <Undo2 className="inline size-3.5 text-status-warning-foreground" />
              )}
              <span className="font-medium">{entry.actor}</span>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(entry.at)} · {entry.title}
              </span>
            </p>
            {entry.detail !== undefined && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {entry.detail}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
