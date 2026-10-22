import type {
  PurchaseOrderDoc,
  PurchaseOrderLine,
  PurchaseOrderStatus,
} from "@/lib/purchasing";
import type { ReceptionDoc } from "../../types";

export interface OrderSheetHeaderProps {
  order: PurchaseOrderDoc;
  meta: { label: string; badgeClassName: string };
  total: { received: number; quantity: number };
}

export interface OrderSolicitudeCodeCardProps {
  solicitudeCode?: string;
  canManage: boolean;
  editandoSolicitud: boolean;
  codigoSolicitud: string;
  guardandoSolicitud: boolean;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onChangeCode: (value: string) => void;
  onSave: () => void;
}

export interface OrderLinesListProps {
  lines: PurchaseOrderLine[];
  canManage: boolean;
  orderStatus: PurchaseOrderStatus;
  editando: string | null;
  nota: string;
  onStartEditingNote: (purchaseRequestId: string, initialNote: string) => void;
  onChangeNote: (value: string) => void;
  onSaveNote: (line: PurchaseOrderLine) => void;
}

export interface OrderReceptionsListProps {
  receptions: ReceptionDoc[];
}

export interface OrderSheetFooterProps {
  orderStatus: PurchaseOrderStatus;
  canManage: boolean;
  onClose: () => void;
  onCancel: () => void;
  onReceive: () => void;
}
