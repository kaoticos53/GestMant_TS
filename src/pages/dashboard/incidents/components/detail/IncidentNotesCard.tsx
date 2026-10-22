import { Pen } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Id } from "@/convex/_generated/dataModel";
import { liveNotes, retiredNotes } from "@/lib/workshop";
import { useIncidentNotes } from "../../hooks/useIncidentNotes";
import type { IncidentDoc } from "../../types";
import { IncidentNoteDialog } from "./notes/components/IncidentNoteDialog";
import { LiveNotesList } from "./notes/components/LiveNotesList";
import { RemoveNoteDialog } from "./notes/components/RemoveNoteDialog";
import { RetiredNotesCollapsible } from "./notes/components/RetiredNotesCollapsible";

export interface IncidentNotesCardProps {
  incident: IncidentDoc;
  currentUserId: Id<"users"> | null;
  canWork: boolean;
  canAssign: boolean;
}

export function IncidentNotesCard({
  incident,
  currentUserId,
  canWork,
  canAssign,
}: IncidentNotesCardProps) {
  const {
    notesOpen,
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
  } = useIncidentNotes(incident);

  const notes = liveNotes(incident.lifecycleNotes);
  const restorable = retiredNotes(incident.lifecycleNotes).filter(
    (entry) =>
      canAssign || (currentUserId !== null && entry.authorId === currentUserId),
  );

  if (!canWork && notes.length === 0) {
    return null;
  }

  return (
    <>
      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Notas a lo largo del ciclo de vida
          </p>
          {canWork && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={handleNewNote}
            >
              <Pen className="size-3.5" />
              Nueva nota
            </Button>
          )}
        </div>

        <LiveNotesList
          notes={notes}
          currentUserId={currentUserId}
          restoringVersionAt={restoringVersionAt}
          onEditNote={handleEditNote}
          onDeleteNote={setDeletingNoteId}
          onRestoreVersion={(noteId, versionIndex) =>
            void handleRestoreVersion(noteId, versionIndex)
          }
        />

        <RetiredNotesCollapsible
          restorable={restorable}
          restoringNoteId={restoringNoteId}
          onRestoreNote={(noteId) => void handleRestoreNote(noteId)}
        />
      </div>

      <IncidentNoteDialog
        open={notesOpen}
        reference={incident.reference}
        editingNoteId={editingNoteId}
        note={note}
        savingNote={savingNote}
        onChangeNote={setNote}
        onClose={handleCloseNote}
        onSave={handleSaveNote}
      />

      <RemoveNoteDialog
        open={Boolean(deletingNoteId)}
        reference={incident.reference}
        removingNote={removingNote}
        onCancel={() => setDeletingNoteId(null)}
        onConfirm={handleRemoveNote}
      />
    </>
  );
}
