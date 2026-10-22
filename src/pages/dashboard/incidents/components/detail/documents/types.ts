import type { Doc, Id } from "@/convex/_generated/dataModel";

export interface IncidentDocumentItem {
  _id: Id<"incidentDocuments">;
  name: string;
  url?: string | null;
  note?: string;
  author?: string;
  createdAt: number;
  storageId?: Id<"_storage"> | string;
}

export interface IncidentDocumentsListProps {
  docs: IncidentDocumentItem[];
  canCoordinate: boolean;
  onNewDocument: () => void;
  onEditDocument: (id: Id<"incidentDocuments">, name: string, note?: string) => void;
  onDeleteDocument: (id: Id<"incidentDocuments">) => void;
}

export interface IncidentDocumentsTrailProps {
  trail: Doc<"incidentDocumentLog">[] | undefined;
  canAssign: boolean;
}

export interface IncidentDocumentDialogProps {
  open: boolean;
  reference: string;
  editingDocumentId: Id<"incidentDocuments"> | null;
  editingDocument: { storageId?: Id<"_storage"> | string } | null | undefined;
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
  deletingDocument: { _id: Id<"incidentDocuments"> | string; name: string } | null | undefined;
  reference: string;
  removingDoc: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}
