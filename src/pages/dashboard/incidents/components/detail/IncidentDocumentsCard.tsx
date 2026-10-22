import type { Doc } from "@/convex/_generated/dataModel";
import { useIncidentDocuments } from "../../hooks/useIncidentDocuments";
import type { IncidentDoc } from "../../types";
import { IncidentDocumentsList } from "./documents/components/IncidentDocumentsList";
import { IncidentDocumentsTrail } from "./documents/components/IncidentDocumentsTrail";
import { IncidentDocumentDialog } from "./documents/components/IncidentDocumentDialog";
import { RemoveDocumentDialog } from "./documents/components/RemoveDocumentDialog";

export interface IncidentDocumentsCardProps {
  incident: IncidentDoc;
  canAssign: boolean;
  canCoordinate: boolean;
  trail: Doc<"incidentDocumentLog">[] | undefined;
}

export function IncidentDocumentsCard({
  incident,
  canAssign,
  canCoordinate,
  trail,
}: IncidentDocumentsCardProps) {
  const {
    documentsOpen,
    documentName,
    setDocumentName,
    documentNote,
    setDocumentNote,
    documentFile,
    documentFileInputRef,
    editingDocumentId,
    setDeletingDocumentId,
    editingDocument,
    deletingDocument,
    savingDoc,
    removingDoc,
    handleNewDocument,
    handleEditDocument,
    handleCloseDocument,
    handleDocumentFileChosen,
    handleSaveDocument,
    handleRemoveDocument,
  } = useIncidentDocuments(incident);

  const docs = incident.documents ?? [];

  if (!canAssign && docs.length === 0) {
    return null;
  }

  return (
    <>
      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <IncidentDocumentsList
          docs={docs}
          canCoordinate={canCoordinate}
          onNewDocument={handleNewDocument}
          onEditDocument={handleEditDocument}
          onDeleteDocument={setDeletingDocumentId}
        />
        <IncidentDocumentsTrail trail={trail} canAssign={canAssign} />
      </div>

      <IncidentDocumentDialog
        open={documentsOpen}
        reference={incident.reference}
        editingDocumentId={editingDocumentId}
        editingDocument={editingDocument}
        documentName={documentName}
        setDocumentName={setDocumentName}
        documentNote={documentNote}
        setDocumentNote={setDocumentNote}
        documentFile={documentFile}
        documentFileInputRef={documentFileInputRef}
        savingDoc={savingDoc}
        onClose={handleCloseDocument}
        onFileChosen={handleDocumentFileChosen}
        onSave={handleSaveDocument}
      />

      <RemoveDocumentDialog
        deletingDocument={deletingDocument}
        reference={incident.reference}
        removingDoc={removingDoc}
        onCancel={() => setDeletingDocumentId(null)}
        onConfirm={handleRemoveDocument}
      />
    </>
  );
}
