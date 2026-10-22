import type { Doc, Id } from "@/convex/_generated/dataModel";

export type IncidentLifecycleNote = NonNullable<
  Doc<"incidents">["lifecycleNotes"]
>[number];

export interface LiveNotesListProps {
  notes: IncidentLifecycleNote[];
  currentUserId: Id<"users"> | null;
  restoringVersionAt: number | null;
  onEditNote: (noteId: string, noteText: string) => void;
  onDeleteNote: (noteId: string) => void;
  onRestoreVersion: (noteId: string, versionIndex: number) => void;
}

export interface RetiredNotesCollapsibleProps {
  restorable: IncidentLifecycleNote[];
  restoringNoteId: string | null;
  onRestoreNote: (noteId: string) => void;
}

export interface IncidentNoteDialogProps {
  open: boolean;
  reference: string;
  editingNoteId: string | null;
  note: string;
  savingNote: boolean;
  onChangeNote: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export interface RemoveNoteDialogProps {
  open: boolean;
  reference: string;
  removingNote: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}
