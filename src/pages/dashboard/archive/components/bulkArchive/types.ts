export type BulkArchiveTarget = "incidents" | "requests";

export interface PendingCounts {
  incidents: number;
  requests: number;
}

export interface BulkArchiveCardProps {
  canArchiveIncidents: boolean;
  canArchiveRequests: boolean;
  cutoffMonths: string;
  setCutoffMonths: (months: string) => void;
  cutoff: number;
  pending: PendingCounts;
  canArchiveSomething: boolean;
  bulkTarget: BulkArchiveTarget | null;
  setBulkTarget: (target: BulkArchiveTarget | null) => void;
  bulkBusy: boolean;
  onBulkArchive: () => Promise<void>;
  onOpenSettings?: () => void;
}

export interface BulkArchiveHeaderProps {
  cutoffMonths: string;
  onCutoffChange: (months: string) => void;
}

export interface BulkArchiveActionsProps {
  canArchiveIncidents: boolean;
  canArchiveRequests: boolean;
  pending: PendingCounts;
  onSelectTarget: (target: BulkArchiveTarget) => void;
  onOpenSettings?: () => void;
}

export interface BulkArchiveConfirmDialogProps {
  target: BulkArchiveTarget | null;
  pending: PendingCounts;
  cutoff: number;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}
