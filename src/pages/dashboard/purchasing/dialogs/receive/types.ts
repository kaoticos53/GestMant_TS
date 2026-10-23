import type { Id } from "@/convex/_generated/dataModel";
import type { PurchaseOrderDoc, PurchaseOrderLine } from "@/lib/purchasing";

export interface ReceivedItemPayload {
  purchaseRequestId: Id<"purchaseRequests">;
  quantity: number;
}

export interface ReceiveLinesInputsProps {
  lines: readonly PurchaseOrderLine[];
  cantidades: Record<string, string>;
  onChangeCantidad: (purchaseRequestId: string, value: string) => void;
  disabled?: boolean;
}

export interface ReceiveDeliveryNoteInputProps {
  archivo: File | null;
  onSelectArchivo: (file: File | null) => void;
  disabled?: boolean;
}

export interface UseReceiveDialogFormProps {
  order: PurchaseOrderDoc;
  onSuccess: () => void;
}
