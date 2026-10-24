import { Badge } from "@/components/ui/badge";
import { Can } from "@/components/AbilityProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { asPurchaseOrder } from "@/lib/abilities";
import { canAdvancePurchaseOrder } from "@/lib/purchaseFlow";
import { PURCHASE_ORDER_STATUS_META, orderTotals } from "@/lib/purchasing";
import { Truck, Undo2 } from "lucide-react";
import { formatOrderRequestRefs, formatOrderSubtitle } from "./helpers";
import type { PurchaseOrderCardProps } from "./types";

export function PurchaseOrderCard({
  order,
  onOpenOrder,
  onReceiveOrder,
  onCancelOrder,
}: PurchaseOrderCardProps) {
  const meta = PURCHASE_ORDER_STATUS_META[order.status];
  const total = orderTotals(order);
  const requestRefsText = formatOrderRequestRefs(order.requestRefs);

  return (
    <Card>
      <CardContent className="grid gap-3 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              {order.reference}
              {order.solicitudeCode && (
                <Badge variant="secondary" className="font-mono text-xs">
                  Solicitud: {order.solicitudeCode}
                </Badge>
              )}
              <Badge variant="outline" className={meta.badgeClassName}>
                {meta.label}
              </Badge>
            </p>
            <p className="text-sm text-muted-foreground">
              {formatOrderSubtitle(order, total.received, total.quantity)}
            </p>
            {requestRefsText && (
              <p className="text-xs text-muted-foreground">
                Desde {requestRefsText}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenOrder(order)}
            >
              Ver la orden
            </Button>
            {canAdvancePurchaseOrder(order.status, "receive") && (
              <>
                <Can I="receive" this={asPurchaseOrder(order)}>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-2"
                    onClick={() => onReceiveOrder(order)}
                  >
                    <Truck className="size-4" />
                    Recepcionar
                  </Button>
                </Can>
                <Can I="cancel" this={asPurchaseOrder(order)}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-destructive"
                    onClick={() => onCancelOrder(order)}
                  >
                    <Undo2 className="size-4" />
                    Anular
                  </Button>
                </Can>
              </>
            )}
          </div>
        </div>
        <Progress value={Math.round(total.ratio * 100)} />
      </CardContent>
    </Card>
  );
}
