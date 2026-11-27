import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowUpRight, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isPurchaseRequestAwaitingDelivery } from "@/lib/purchaseFlow";
import { canBuyForRequest } from "@/lib/requestFlow";
import { getErrorMessage } from "@/lib/workshop";
import type { RequestDoc } from "../types";

const PURCHASE_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente de orden",
  ordered: "En orden de compra",
  received: "Recibida",
  cancelled: "Cancelada",
};

export interface LinkedPurchasesCardProps {
  request: RequestDoc;
  hasShortage: boolean;
  canPurchase: boolean;
  canViewPurchasing?: boolean;
  onOpenPurchasing?: (
    section: "pending" | "orders",
    orderId?: Id<"purchaseOrders"> | null,
  ) => void;
}

export function LinkedPurchasesCard({
  request,
  hasShortage,
  canPurchase,
  canViewPurchasing = canPurchase,
  onOpenPurchasing,
}: LinkedPurchasesCardProps) {
  const data = useQuery(
    api.purchasing.byRequest,
    canViewPurchasing ? { requestId: request._id } : "skip",
  );
  const requestPurchase = useMutation(api.purchasing.requestPurchase);
  const [creating, setCreating] = useState(false);

  const requests = data?.requests ?? [];
  const orders = data?.orders ?? [];
  const orderById = new Map(orders.map((order) => [order._id, order]));

  const liveCount = requests.filter(isPurchaseRequestAwaitingDelivery).length;
  const canCreatePurchase =
    canPurchase &&
    hasShortage &&
    liveCount === 0 &&
    canBuyForRequest(request.status) &&
    request.lines.length > 0 &&
    request.archivedAt === undefined &&
    request.deletedAt === undefined;

  if (requests.length === 0 && !canCreatePurchase) {
    return null;
  }

  const handleCreatePurchase = async () => {
    setCreating(true);
    try {
      const { references, repeated } = await requestPurchase({
        requestId: request._id,
      });
      toast.success(
        references.length === 1
          ? `${references[0]} apartada para comprar`
          : `${references.length} peticiones de compra apartadas`,
        {
          description:
            repeated > 0
              ? `${repeated} línea${repeated === 1 ? "" : "s"} ya estaba${repeated === 1 ? "" : "n"} en la cola de compras.`
              : "Ya aparece en Compras → Pendientes.",
        },
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <ShoppingCart className="size-3.5" />
          Compras vinculadas
        </p>
        {canCreatePurchase && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            disabled={creating}
            onClick={() => void handleCreatePurchase()}
          >
            <ShoppingCart className="size-3.5" />
            {creating ? "Generando..." : "Pedir compra"}
          </Button>
        )}
      </div>

      {requests.length > 0 ? (
        <ul className="mt-2.5 space-y-2">
          {requests.map((item) => {
            const order = item.orderId ? orderById.get(item.orderId) : undefined;
            const statusLabel =
              PURCHASE_STATUS_LABELS[item.status] ?? item.status;
            return (
              <li
                key={item._id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 font-medium">
                    <span className="font-mono text-xs">{item.reference}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="truncate">
                      {item.code} {item.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      × {item.quantity} {item.unit}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {statusLabel} · {item.supplier}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {order ? (
                    onOpenPurchasing ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-7 gap-1 font-mono text-xs"
                        onClick={() => onOpenPurchasing("orders", order._id)}
                      >
                        {order.reference}
                        <ArrowUpRight className="size-3.5" />
                      </Button>
                    ) : (
                      <Badge variant="secondary" className="font-mono text-xs">
                        {order.reference}
                      </Badge>
                    )
                  ) : (
                    onOpenPurchasing &&
                    item.status === "pending" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => onOpenPurchasing("pending")}
                      >
                        Ver en Compras
                        <ArrowUpRight className="size-3.5" />
                      </Button>
                    )
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Hay líneas sin stock suficiente y todavía no se ha generado petición de
          compra.
        </p>
      )}
    </div>
  );
}
