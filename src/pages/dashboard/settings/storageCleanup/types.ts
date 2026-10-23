import type { CleanupPass } from "@/lib/cleanupLog";

export interface StorageCleanupRun {
  pass: CleanupPass;
  ranAt: number | null;
  files: number;
  bytes: number;
  tickets: number;
  unreadable: number;
  runBy: string | null;
  automatic: boolean;
}

export interface ManualCleanupSummary {
  reportUploads: {
    files: number;
    bytes: number;
    tickets: number;
    unreadable: number;
  };
  orphanFiles: {
    files: number;
    bytes: number;
    unreadable: number;
  };
  trash: {
    files: number;
    bytes: number;
  };
}

export interface StorageCleanupHeaderProps {
  running: boolean;
  disabled: boolean;
  onRunNow: () => void;
}

export interface StorageCleanupRunsListProps {
  runs: StorageCleanupRun[] | undefined;
}

export interface StorageCleanupRunItemProps {
  run: StorageCleanupRun;
}
