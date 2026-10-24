import { Truck, Undo2 } from "lucide-react";
import { Can } from "@/components/AbilityProvider";
import { Button } from "@/components/ui/button";
import { SheetFooter } from "@/components/ui/sheet";
import { asPurchaseOrder } from "@/lib/abilities";
import { canAdvancePurchaseOrder } from "@/lib/purchaseFlow";
import type { OrderSheetFooterProps } from "../types";

export function OrderSheetFooter({
  order,
  orderStatus,
  onClose,
  onCancel,
  onReceive,
}: OrderSheetFooterProps) {
  // La máquina dice desde qué estado cabe cada paso; `<Can>` dice quién puede
  // darlo, con la orden delante. Cada pregunta se queda en su sitio.
  const canCancel = canAdvancePurchaseOrder(orderStatus, "cancel");
  const canReceive = canAdvancePurchaseOrder(orderStatus, "receive");

  return (
    <SheetFooter className="sticky bottom-0 z-20 border-t border-border/70 bg-background/95 px-4 py-3 backdrop-blur-sm sm:px-6">
      <Button type="button" variant="ghost" onClick={onClose}>
        Cerrar
      </Button>
      {canCancel && (
        <Can I="cancel" this={asPurchaseOrder(order)}>
          <Button
            type="button"
            variant="outline"
            className="gap-2 text-destructive"
            onClick={onCancel}
          >
            <Undo2 className="size-4" />
            Anular la orden
          </Button>
        </Can>
      )}
      {canReceive && (
        <Can I="receive" this={asPurchaseOrder(order)}>
          <Button type="button" className="gap-2" onClick={onReceive}>
            <Truck className="size-4" />
            Recepcionar material
          </Button>
        </Can>
      )}
    </SheetFooter>
  );
}
