import type { Doc } from "@/convex/_generated/dataModel";

export interface IncidentDocumentItem {
  _id: string;
  name: string;
  url?: string;
  note?: string;
  author?: string;
  createdAt: number;
  storageId?: string;
}

export interface IncidentDocumentsListProps {
  docs: IncidentDocumentItem[];
  canCoordinate: boolean;
  onNewDocument: () => void;
  onEditDocument: (id: string, name: string, note?: string) => void;
  onDeleteDocument: (id: string) => void;
}

export interface IncidentDocumentsTrailProps {
  trail: Doc<"incidentDocumentLog">[] | undefined;
  canAssign: boolean;
}

export interface IncidentDocumentDialogProps {
  open: boolean;
  reference: string;
  editingDocumentId: string | null;
  editingDocument: { storageId?: string } | null;
  documentName: string;
  setDocumentName: (name: string) => void;
  documentNote: string;
  setDocumentNote: (note: string) => void;
  documentFile: File | null;
  documentFileInputRef: React.RefObject<HTMLInputElement | null>;
  savingDoc: boolean;
  onClose: () => void;
  onFileChosen: (files: FileList | null) => void;
  onSave: () => void;
}

export interface RemoveDocumentDialogProps {
  deletingDocument: { _id: string; name: string } | null;
  reference: string;
  removingDoc: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}
