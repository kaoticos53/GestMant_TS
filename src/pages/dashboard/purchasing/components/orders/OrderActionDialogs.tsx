import type { PurchaseOrderDoc } from "@/lib/purchasing";
import { ReceiveDialog } from "../../dialogs/ReceiveDialog";
import { CancelOrderDialog } from "./CancelOrderDialog";

export interface OrderActionDialogsProps {
  recibiendo: PurchaseOrderDoc | null;
  onCloseReceive: () => void;
  anulando: PurchaseOrderDoc | null;
  onCloseCancel: () => void;
  motivo: string;
  onMotivoChange: (value: string) => void;
  guardando: boolean;
  onConfirmCancel: () => Promise<void>;
}

/**
 * Diálogos modales de recepción parcial/total y anulación de órdenes de compra.
 */
export function OrderActionDialogs({
  recibiendo,
  onCloseReceive,
  anulando,
  onCloseCancel,
  motivo,
  onMotivoChange,
  guardando,
  onConfirmCancel,
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

      <CancelOrderDialog
        order={anulando}
        onClose={onCloseCancel}
        motivo={motivo}
        onMotivoChange={onMotivoChange}
        guardando={guardando}
        onConfirmCancel={onConfirmCancel}
      />
    </>
  );
}
