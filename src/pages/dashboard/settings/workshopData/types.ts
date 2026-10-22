export interface WorkshopDataActionsProps {
  seeding: boolean;
  seedingPurchasing: boolean;
  resetting: boolean;
  onSeed: () => void;
  onSeedPurchasing: () => void;
  onRequestReset: () => void;
}

export interface WorkshopResetDialogProps {
  open: boolean;
  phrase: string;
  canVaciar: boolean;
  resetting: boolean;
  confirmWord: string;
  onPhraseChange: (value: string) => void;
  onClose: () => void;
  onConfirmReset: () => void;
}

export interface UseWorkshopDataActionsReturn {
  seeding: boolean;
  seedingPurchasing: boolean;
  resetting: boolean;
  confirming: boolean;
  phrase: string;
  canVaciar: boolean;
  confirmWord: string;
  setConfirming: (val: boolean) => void;
  setPhrase: (val: string) => void;
  handleSeed: () => Promise<void>;
  handleSeedPurchasing: () => Promise<void>;
  handleReset: () => Promise<void>;
  handleCloseResetDialog: () => void;
}
