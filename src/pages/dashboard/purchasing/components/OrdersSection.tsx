import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { PurchaseOrderDoc } from "@/lib/purchasing";
import { getErrorMessage } from "@/lib/workshop";
import { OrderSheet } from "../dialogs/OrderSheet";
import { ReceiveDialog } from "../dialogs/ReceiveDialog";
import {
  CancelOrderDialog,
  OrdersEmptyState,
  PurchaseOrderCard,
  formatCancelSuccessDescription,
} from "./orders";
import type { OrdersSectionProps } from "./orders";

export type { OrdersSectionProps };

export function OrdersSection({
  orders,
  receptions,
  canManage,
}: OrdersSectionProps) {
  const [abierta, setAbierta] = useState<PurchaseOrderDoc | null>(null);
  const [recibiendo, setRecibiendo] = useState<PurchaseOrderDoc | null>(null);
  const [anulando, setAnulando] = useState<PurchaseOrderDoc | null>(null);
  const cancelar = useMutation(api.purchasing.cancelOrder);
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  // La orden abierta se refresca con la última versión que llega del backend.
  const actual = abierta
    ? (orders.find((order) => order._id === abierta._id) ?? abierta)
    : null;

  if (orders.length === 0) {
    return <OrdersEmptyState />;
  }

  const anular = async () => {
    if (!anulando) return;
    setGuardando(true);
    try {
      const { returned } = await cancelar({
        orderId: anulando._id,
        note: motivo,
      });
      toast.success(`Orden ${anulando.reference} anulada`, {
        description: formatCancelSuccessDescription(returned),
      });
      setAnulando(null);
      setMotivo("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="grid gap-3">
      {orders.map((order) => (
        <PurchaseOrderCard
          key={order._id}
          order={order}
          onOpenOrder={setAbierta}
          onReceiveOrder={setRecibiendo}
          onCancelOrder={(ord) => {
            setMotivo("");
            setAnulando(ord);
          }}
        />
      ))}

      {actual && (
        <OrderSheet
          order={actual}
          receptions={receptions.filter((row) => row.orderId === actual._id)}
          canManage={canManage}
          onClose={() => setAbierta(null)}
          onReceive={() => {
            setRecibiendo(actual);
            setAbierta(null);
          }}
          onCancel={() => {
            setMotivo("");
            setAnulando(actual);
            setAbierta(null);
          }}
        />
      )}

      {recibiendo && (
        <ReceiveDialog
          open={recibiendo !== null}
          onOpenChange={(open) => !open && setRecibiendo(null)}
          order={recibiendo}
        />
      )}

      <CancelOrderDialog
        order={anulando}
        onClose={() => setAnulando(null)}
        motivo={motivo}
        onMotivoChange={setMotivo}
        guardando={guardando}
        onConfirmCancel={anular}
      />
    </div>
  );
}
