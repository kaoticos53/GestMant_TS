import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { PurchaseOrderDoc } from "@/lib/purchasing";
import { getErrorMessage } from "@/lib/workshop";
import { ReceiveDialog } from "../../dialogs/ReceiveDialog";
import { CancelOrderDialog } from "./CancelOrderDialog";
import { formatCancelSuccessDescription } from "./helpers";

export interface OrderActionDialogsProps {
  recibiendo: PurchaseOrderDoc | null;
  onCloseReceive: () => void;
  anulando: PurchaseOrderDoc | null;
  onCloseCancel: () => void;
  motivo: string;
  onMotivoChange: (value: string) => void;
}

/**
 * Diálogos modales de recepción parcial/total y anulación de órdenes de compra.
 * Monta las mutaciones de Convex solo mientras algún diálogo está abierto.
 */
export function OrderActionDialogs({
  recibiendo,
  onCloseReceive,
  anulando,
  onCloseCancel,
  motivo,
  onMotivoChange,
}: OrderActionDialogsProps) {
  return (
    <>
      {recibiendo && (
        <ReceiveDialog
          open={recibiendo !== null}
          onOpenChange={(open) => !open && onCloseReceive()}
          order={recibiendo}
        />
      )}

      {anulando && (
        <CancelOrderController
          order={anulando}
          onClose={onCloseCancel}
          motivo={motivo}
          onMotivoChange={onMotivoChange}
        />
      )}
    </>
  );
}

function CancelOrderController({
  order,
  onClose,
  motivo,
  onMotivoChange,
}: {
  order: PurchaseOrderDoc;
  onClose: () => void;
  motivo: string;
  onMotivoChange: (value: string) => void;
}) {
  const cancelar = useMutation(api.purchasing.cancelOrder);
  const [guardando, setGuardando] = useState(false);

  const handleConfirmCancel = async () => {
    setGuardando(true);
    try {
      const { returned } = await cancelar({
        orderId: order._id,
        note: motivo,
      });
      toast.success(`Orden ${order.reference} anulada`, {
        description: formatCancelSuccessDescription(returned),
      });
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <CancelOrderDialog
      order={order}
      onClose={onClose}
      motivo={motivo}
      onMotivoChange={onMotivoChange}
      guardando={guardando}
      onConfirmCancel={handleConfirmCancel}
    />
  );
}
