import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  noteRemovedToast,
  noteRestoreUndoneToast,
  noteRestoredToast,
  noteVersionRestoredToast,
} from "@/lib/noteToasts";
import { richDocToStore } from "@/lib/richDoc";
import { getErrorMessage, liveNotes, noteRestoreUndoIndex } from "@/lib/workshop";
import type { IncidentDoc } from "../types";

export function useIncidentNotes(incident: IncidentDoc) {
  const addNote = useMutation(api.incidents.addNote);
  const updateNote = useMutation(api.incidents.updateNote);
  const removeNote = useMutation(api.incidents.removeNote);
  const restoreNote = useMutation(api.incidents.restoreNote);
  const restoreNoteVersion = useMutation(api.incidents.restoreNoteVersion);

  const [notesOpen, setNotesOpen] = useState(false);
  const [note, setNote] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [removingNote, setRemovingNote] = useState(false);
  const [restoringNoteId, setRestoringNoteId] = useState<string | null>(null);
  const [restoringVersionAt, setRestoringVersionAt] = useState<number | null>(null);

  const handleCloseNote = () => {
    setNotesOpen(false);
    setNote("");
    setEditingNoteId(null);
  };

  const handleNewNote = () => {
    setEditingNoteId(null);
    setNote("");
    setNotesOpen(true);
  };

  const handleEditNote = (noteId: string, text: string) => {
    setEditingNoteId(noteId);
    setNote(text);
    setNotesOpen(true);
  };

  const handleSaveNote = async () => {
    const noteText = richDocToStore(note);
    if (!noteText) return;
    setSavingNote(true);
    try {
      if (editingNoteId) {
        await updateNote({
          incidentId: incident._id,
          noteId: editingNoteId,
          note: noteText,
          expectedUpdatedAt: incident.updatedAt,
        });
        toast.success("Nota corregida");
      } else {
        await addNote({
          incidentId: incident._id,
          note: noteText,
          expectedUpdatedAt: incident.updatedAt,
        });
        toast.success("Nota añadida");
      }
      handleCloseNote();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingNote(false);
    }
  };

  const handleRestoreNote = async (noteId: string) => {
    setRestoringNoteId(noteId);
    try {
      await restoreNote({ incidentId: incident._id, noteId });
      noteRestoredToast();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRestoringNoteId(null);
    }
  };

  const handleRestoreVersion = async (
    noteId: string,
    versionIndex: number,
    mode: "restore" | "undo" = "restore",
  ) => {
    const entry = liveNotes(incident.lifecycleNotes).find(
      (item) => item.id === noteId,
    );
    const undoIndex = entry ? noteRestoreUndoIndex(entry, versionIndex) : null;
    setRestoringVersionAt(versionIndex);
    try {
      await restoreNoteVersion({
        incidentId: incident._id,
        noteId,
        versionIndex,
      });
      if (mode === "undo") {
        noteRestoreUndoneToast();
      } else {
        noteVersionRestoredToast(
          undoIndex === null
            ? {}
            : {
                onUndo: () =>
                  void handleRestoreVersion(noteId, undoIndex, "undo"),
              },
        );
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRestoringVersionAt(null);
    }
  };

  const handleRemoveNote = async () => {
    if (!deletingNoteId) return;
    const noteId = deletingNoteId;
    setRemovingNote(true);
    try {
      await removeNote({ incidentId: incident._id, noteId });
      setDeletingNoteId(null);
      noteRemovedToast({ onUndo: () => void handleRestoreNote(noteId) });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRemovingNote(false);
    }
  };

  return {
    notesOpen,
    setNotesOpen,
    note,
    setNote,
    editingNoteId,
    deletingNoteId,
    setDeletingNoteId,
    savingNote,
    removingNote,
    restoringNoteId,
    restoringVersionAt,
    handleNewNote,
    handleEditNote,
    handleCloseNote,
    handleSaveNote,
    handleRestoreNote,
    handleRestoreVersion,
    handleRemoveNote,
  };
}
