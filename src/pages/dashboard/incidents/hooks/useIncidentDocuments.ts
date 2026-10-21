import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { richDocToStore } from "@/lib/richDoc";
import {
  MAX_FILE_SIZE_LABEL,
  compressForUpload,
  exceedsFileLimit,
  uploadToStorage,
} from "@/lib/upload";
import { getErrorMessage } from "@/lib/workshop";
import type { IncidentDoc } from "../types";

export function useIncidentDocuments(incident: IncidentDoc) {
  const attachDocument = useMutation(api.incidents.attachDocument);
  const updateDocument = useMutation(api.incidents.updateDocument);
  const removeDocument = useMutation(api.incidents.removeDocument);
  const generateUploadUrl = useMutation(api.incidents.generateUploadUrl);

  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [documentName, setDocumentName] = useState("");
  const [documentNote, setDocumentNote] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const documentFileInputRef = useRef<HTMLInputElement | null>(null);

  const [editingDocumentId, setEditingDocumentId] =
    useState<Id<"incidentDocuments"> | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] =
    useState<Id<"incidentDocuments"> | null>(null);

  const [savingDoc, setSavingDoc] = useState(false);
  const [removingDoc, setRemovingDoc] = useState(false);

  const editingDocument = incident.documents?.find(
    (doc) => doc._id === editingDocumentId,
  );
  const deletingDocument = incident.documents?.find(
    (doc) => doc._id === deletingDocumentId,
  );

  const handleNewDocument = () => {
    setEditingDocumentId(null);
    setDocumentName("");
    setDocumentNote("");
    setDocumentFile(null);
    setDocumentsOpen(true);
  };

  const handleEditDocument = (
    documentId: Id<"incidentDocuments">,
    name: string,
    note?: string,
  ) => {
    setEditingDocumentId(documentId);
    setDocumentName(name);
    setDocumentNote(note ?? "");
    setDocumentFile(null);
    setDocumentsOpen(true);
  };

  const handleCloseDocument = () => {
    setDocumentsOpen(false);
    setDocumentName("");
    setDocumentNote("");
    setDocumentFile(null);
    setEditingDocumentId(null);
  };

  const handleDocumentFileChosen = async (chosen: FileList | null) => {
    const picked = chosen?.[0];
    if (!picked) return;
    const file = await compressForUpload(picked);
    if (exceedsFileLimit(file)) {
      toast.error(`${picked.name}: supera los ${MAX_FILE_SIZE_LABEL}`);
      return;
    }
    setDocumentFile(file);
    setDocumentName((current) => (current.trim() ? current : file.name));
  };

  const handleSaveDocument = async () => {
    const name = documentName.trim() || documentFile?.name.trim() || "";
    if (!name) return;
    setSavingDoc(true);
    try {
      const storageId = documentFile
        ? await uploadToStorage(await generateUploadUrl(), documentFile)
        : undefined;

      if (editingDocumentId) {
        await updateDocument({
          incidentId: incident._id,
          documentId: editingDocumentId,
          name,
          note: richDocToStore(documentNote),
          ...(storageId ? { storageId } : {}),
        });
        toast.success(
          storageId
            ? "Documento actualizado con su archivo nuevo"
            : "Documento actualizado",
        );
      } else {
        await attachDocument({
          incidentId: incident._id,
          name,
          ...(storageId ? { storageId } : {}),
          note: richDocToStore(documentNote),
        });
        toast.success(
          storageId ? "Documento adjunto con su archivo" : "Documento adjunto",
        );
      }
      handleCloseDocument();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingDoc(false);
    }
  };

  const handleRemoveDocument = async () => {
    if (!deletingDocumentId) return;
    setRemovingDoc(true);
    try {
      await removeDocument({
        incidentId: incident._id,
        documentId: deletingDocumentId,
      });
      toast.success("Documento quitado del expediente");
      setDeletingDocumentId(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRemovingDoc(false);
    }
  };

  return {
    documentsOpen,
    setDocumentsOpen,
    documentName,
    setDocumentName,
    documentNote,
    setDocumentNote,
    documentFile,
    documentFileInputRef,
    editingDocumentId,
    deletingDocumentId,
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
  };
}
