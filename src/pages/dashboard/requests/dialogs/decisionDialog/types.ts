import type { RequestStatus } from "@/lib/workshop";
import type {
  DecisionMode,
  PartDoc,
  RequestDoc,
} from "../../types";

export type { DecisionMode, PartDoc, RequestDoc };
export type RequestLine = RequestDoc["lines"][number];

export interface DecisionDialogProps {
  request: RequestDoc;
  mode: DecisionMode;
  parts: PartDoc[];
  canPurchase: boolean;
  onClose: () => void;
}

export interface DecisionStockApprovalPanelProps {
  lines: RequestLine[];
  partById: Map<string, PartDoc>;
  shortages: RequestLine[];
  compradas: number;
  canPurchase: boolean;
  busy: boolean;
  onPurchase: () => void;
}

export interface DecisionIssueBatchPanelProps {
  lines: RequestLine[];
  requestStatus: RequestStatus;
  entrega: Record<string, number>;
  busy: boolean;
  onChangeDelivery: (sparePartId: string, quantity: number) => void;
}

export interface DecisionNoteFieldProps {
  label: string;
  placeholder: string;
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
}

export interface DecisionDialogFooterProps {
  busy: boolean;
  blocked: boolean;
  disabledConfirm: boolean;
  confirmLabel: string;
  DecisionIcon: React.ComponentType<{ className?: string }>;
  onClose: () => void;
  onConfirm: () => void;
}
