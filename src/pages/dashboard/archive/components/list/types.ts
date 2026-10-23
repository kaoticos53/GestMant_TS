import type { ArchiveEntry } from "../../types";

export interface ArchiveEmptyStateProps {
  search: string;
  totalEntries: number;
  onClearSearch: () => void;
}

export interface ArchiveEntryCardProps {
  entry: ArchiveEntry;
  compact: boolean;
  canRestore: boolean;
  busy: boolean;
  onOpenEntry: (entry: { kind: "incident" | "request"; id: string }) => void;
  onRestore: (entry: ArchiveEntry) => Promise<void>;
}

export interface ArchiveDateSectionGroup {
  key: string;
  label: string;
  items: ArchiveEntry[];
}

export interface ArchiveDateSectionProps {
  section: ArchiveDateSectionGroup;
  compact: boolean;
  canArchiveIncidents: boolean;
  canArchiveRequests: boolean;
  busyId: string | null;
  onOpenEntry: (entry: { kind: "incident" | "request"; id: string }) => void;
  onRestore: (entry: ArchiveEntry) => Promise<void>;
}
