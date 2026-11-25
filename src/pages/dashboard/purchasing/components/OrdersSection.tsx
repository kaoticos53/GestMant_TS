import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { OrderSheet } from "../dialogs/OrderSheet";
import { useOrderActionDialogs } from "../hooks/useOrderActionDialogs";
import {
  OrderActionDialogs,
  OrdersEmptyState,
  PurchaseOrderCard,
} from "./orders";
import type { OrdersSectionProps } from "./orders";

export type { OrdersSectionProps };

export function OrdersSection({
  orders,
  receptions,
  canManage,
  initialOrderId = null,
  onOpenRequest,
}: OrdersSectionProps) {
  const [selectedOrderId, setSelectedOrderId] =
    useState<Id<"purchaseOrders"> | null>(null);
  const [dismissedInitialId, setDismissedInitialId] =
    useState<Id<"purchaseOrders"> | null>(null);
  const [prevInitialOrderId, setPrevInitialOrderId] =
    useState<Id<"purchaseOrders"> | null>(initialOrderId);

  if (initialOrderId !== prevInitialOrderId) {
    setPrevInitialOrderId(initialOrderId);
    setSelectedOrderId(null);
    setDismissedInitialId(null);
  }

  const dialogs = useOrderActionDialogs();

  const activeOrderId =
    selectedOrderId ??
    (initialOrderId && initialOrderId !== dismissedInitialId
      ? initialOrderId
      : null);

  // La orden abierta se refresca con la última versión que llega del backend.
  const actual = activeOrderId
    ? (orders.find((order) => order._id === activeOrderId) ?? null)
    : null;

  const closeOpenOrder = () => {
    setSelectedOrderId(null);
    if (initialOrderId) setDismissedInitialId(initialOrderId);
  };

  if (orders.length === 0) {
    return <OrdersEmptyState />;
  }

  return (
    <div className="grid gap-3">
      {orders.map((order) => (
        <PurchaseOrderCard
          key={order._id}
          order={order}
          onOpenOrder={(ord) => setSelectedOrderId(ord._id)}
          onReceiveOrder={dialogs.setRecibiendo}
          onCancelOrder={dialogs.startCancel}
          onOpenRequest={onOpenRequest}
        />
      ))}

      {actual && (
        <OrderSheet
          order={actual}
          receptions={receptions.filter((row) => row.orderId === actual._id)}
          canManage={canManage}
          onClose={closeOpenOrder}
          onReceive={() => {
            dialogs.setRecibiendo(actual);
            closeOpenOrder();
          }}
          onCancel={() => {
            dialogs.startCancel(actual);
            closeOpenOrder();
          }}
          onOpenRequest={onOpenRequest}
        />
      )}

      <OrderActionDialogs
        recibiendo={dialogs.recibiendo}
        onCloseReceive={() => dialogs.setRecibiendo(null)}
        anulando={dialogs.anulando}
        onCloseCancel={dialogs.closeCancel}
        motivo={dialogs.motivo}
        onMotivoChange={dialogs.setMotivo}
        guardando={dialogs.guardando}
        onConfirmCancel={dialogs.confirmCancel}
      />
    </div>
  );
}
