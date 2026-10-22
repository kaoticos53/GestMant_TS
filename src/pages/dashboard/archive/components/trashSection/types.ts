import type { ReactNode } from "react";
import type { TrashRow } from "../../types";

export type TrashedIncidentRow = Extract<TrashRow, { kind: "incident" }>;
export type TrashedRequestRow = Extract<TrashRow, { kind: "request" }>;

export interface TrashGroupProps {
  title: string;
  count: number;
  children: ReactNode;
}

export interface TrashButtonsProps {
  row: TrashRow;
  busyId: string | null;
  onOpen: (row: TrashRow) => void;
  onRestore: (row: TrashRow) => Promise<void>;
  onDelete: (row: TrashRow) => void;
}

export interface TrashedIncidentItemProps {
  row: TrashedIncidentRow;
  busyId: string | null;
  onOpen: (row: TrashRow) => void;
  onRestore: (row: TrashRow) => Promise<void>;
  onDelete: (row: TrashRow) => void;
}

export interface TrashedRequestItemProps {
  row: TrashedRequestRow;
  busyId: string | null;
  onOpen: (row: TrashRow) => void;
  onRestore: (row: TrashRow) => Promise<void>;
  onDelete: (row: TrashRow) => void;
}

export interface TrashDeleteDialogProps {
  deletingRow: TrashRow | null;
  busyId: string | null;
  onClose: () => void;
  onConfirmDelete: () => Promise<void>;
}
