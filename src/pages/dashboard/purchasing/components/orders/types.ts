import type { Id } from "@/convex/_generated/dataModel";
import type { PurchaseOrderDoc } from "@/lib/purchasing";
import type { ReceptionDoc } from "../../types";

export interface OrdersSectionProps {
  orders: PurchaseOrderDoc[];
  receptions: ReceptionDoc[];
  canManage: boolean;
  initialOrderId?: Id<"purchaseOrders"> | null;
  onOpenRequest?: (id: Id<"partRequests">) => void;
}

export interface PurchaseOrderCardProps {
  order: PurchaseOrderDoc;
  onOpenOrder: (order: PurchaseOrderDoc) => void;
  onReceiveOrder: (order: PurchaseOrderDoc) => void;
  onCancelOrder: (order: PurchaseOrderDoc) => void;
  onOpenRequest?: (id: Id<"partRequests">) => void;
}

export interface CancelOrderDialogProps {
  order: PurchaseOrderDoc | null;
  onClose: () => void;
  motivo: string;
  onMotivoChange: (value: string) => void;
  guardando: boolean;
  onConfirmCancel: () => Promise<void>;
}
