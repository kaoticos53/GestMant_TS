import type { PurchaseOrderDoc } from "@/lib/purchasing";
import type { ReceptionDoc } from "../../types";

export interface OrdersSectionProps {
  orders: PurchaseOrderDoc[];
  receptions: ReceptionDoc[];
  canManage: boolean;
}

export interface PurchaseOrderCardProps {
  order: PurchaseOrderDoc;
  canManage: boolean;
  onOpenOrder: (order: PurchaseOrderDoc) => void;
  onReceiveOrder: (order: PurchaseOrderDoc) => void;
  onCancelOrder: (order: PurchaseOrderDoc) => void;
}

export interface CancelOrderDialogProps {
  order: PurchaseOrderDoc | null;
  onClose: () => void;
  motivo: string;
  onMotivoChange: (value: string) => void;
  guardando: boolean;
  onConfirmCancel: () => Promise<void>;
}
