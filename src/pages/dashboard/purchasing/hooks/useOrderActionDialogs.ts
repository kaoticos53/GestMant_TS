import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { PurchaseOrderDoc } from "@/lib/purchasing";
import { getErrorMessage } from "@/lib/workshop";
import { formatCancelSuccessDescription } from "../components/orders/helpers";

/**
 * Gestiona el estado compartido de recepción y anulación para una orden de compra
 * abierta desde cualquier vista del módulo de compras.
 */
export function useOrderActionDialogs() {
  const [recibiendo, setRecibiendo] = useState<PurchaseOrderDoc | null>(null);
  const [anulando, setAnulando] = useState<PurchaseOrderDoc | null>(null);
  const cancelar = useMutation(api.purchasing.cancelOrder);
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  const startCancel = (order: PurchaseOrderDoc) => {
    setMotivo("");
    setAnulando(order);
  };

  const closeCancel = () => setAnulando(null);

  const confirmCancel = async () => {
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

  return {
    recibiendo,
    setRecibiendo,
    anulando,
    startCancel,
    closeCancel,
    motivo,
    setMotivo,
    guardando,
    confirmCancel,
  };
}
