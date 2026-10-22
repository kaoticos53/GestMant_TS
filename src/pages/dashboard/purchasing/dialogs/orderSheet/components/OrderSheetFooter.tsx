import { Truck, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SheetFooter } from "@/components/ui/sheet";
import { canAdvancePurchaseOrder } from "@/lib/purchaseFlow";
import type { OrderSheetFooterProps } from "../types";

export function OrderSheetFooter({
  orderStatus,
  canManage,
  onClose,
  onCancel,
  onReceive,
}: OrderSheetFooterProps) {
  const canCancel = canManage && canAdvancePurchaseOrder(orderStatus, "cancel");
  const canReceive = canManage && canAdvancePurchaseOrder(orderStatus, "receive");

  return (
    <SheetFooter className="sticky bottom-0 z-20 border-t border-border/70 bg-background/95 px-4 py-3 backdrop-blur-sm sm:px-6">
      <Button type="button" variant="ghost" onClick={onClose}>
        Cerrar
      </Button>
      {canCancel && (
        <Button
          type="button"
          variant="outline"
          className="gap-2 text-destructive"
          onClick={onCancel}
        >
          <Undo2 className="size-4" />
          Anular la orden
        </Button>
      )}
      {canReceive && (
        <Button type="button" className="gap-2" onClick={onReceive}>
          <Truck className="size-4" />
          Recepcionar material
        </Button>
      )}
    </SheetFooter>
  );
}
