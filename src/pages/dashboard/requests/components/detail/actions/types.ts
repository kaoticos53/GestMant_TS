import type { RequestDoc } from "../../../types";

export interface RequestActionsFooterProps {
  canManage: boolean;
  status: RequestDoc["status"];
  reference: string;
  noReference: boolean;
  onClose: () => void;
  onReject?: () => void;
  onApprove?: () => void;
  onAssociate?: () => void;
  onIssue?: () => void;
  onHold?: () => void;
  onResume?: () => void;
  resuming?: boolean;
  onReturn?: () => void;
  onCancel?: () => void;
  archiving: boolean;
  onArchive: () => Promise<void>;
  withdrawing: boolean;
  withdrawOpen: boolean;
  setWithdrawOpen: (open: boolean) => void;
  withdrawReason: string;
  setWithdrawReason: (reason: string) => void;
  onWithdraw: () => Promise<void>;
}

export interface RequestActionFlags {
  canReject: boolean;
  canApprove: boolean;
  needsAssociation: boolean;
  canIssue: boolean;
  canHold: boolean;
  canResume: boolean;
  canReturnMaterial: boolean;
  canCancel: boolean;
  canArchive: boolean;
  canWithdraw: boolean;
}

export interface RequestWorkflowButtonsProps {
  flags: RequestActionFlags;
  onClose: () => void;
  onReject?: () => void;
  onApprove?: () => void;
  onAssociate?: () => void;
  onIssue?: () => void;
  onHold?: () => void;
  onResume?: () => void;
  resuming?: boolean;
  onReturn?: () => void;
  onCancel?: () => void;
  archiving: boolean;
  onArchive: () => Promise<void>;
  withdrawing: boolean;
  onOpenWithdraw: () => void;
}

export interface RequestWithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reference: string;
  withdrawReason: string;
  onWithdrawReasonChange: (reason: string) => void;
  withdrawing: boolean;
  onWithdraw: () => Promise<void>;
}
