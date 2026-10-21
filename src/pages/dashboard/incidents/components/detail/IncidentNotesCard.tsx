import { ChevronDown, Pen, Pencil, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { RichText } from "@/components/RichText";
import { RichTextEditor } from "@/components/RichTextEditor";
import type { Id } from "@/convex/_generated/dataModel";
import { richDocIsEmpty } from "@/lib/richDoc";
import {
  formatClockTime,
  formatDateTime,
  isNoteWithinEditWindow,
  liveNotes,
  noteEditDeadline,
  noteRestoration,
  retiredNotes,
} from "@/lib/workshop";
import { NoteHistory } from "../NoteHistory";
import { useIncidentNotes } from "../../hooks/useIncidentNotes";
import type { IncidentDoc } from "../../types";

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
        <ul className="mt-3 space-y-3">
          {notes.length === 0 && (
            <li className="text-sm text-muted-foreground">
              Todavía no hay notas en el ciclo de vida.
            </li>
          )}
          {notes.map((entry, index) => {
            const noteId = entry.id;
            const writtenAt = entry.createdAt ?? entry.at;
            const canEdit =
              currentUserId !== null &&
              entry.authorId === currentUserId &&
              isNoteWithinEditWindow(writtenAt);
            const restoration = noteRestoration(entry);

            return (
              <li
                key={noteId ?? `${entry.author}-${entry.at}-${index}`}
                className="flex gap-2 rounded-lg border border-border/60 bg-background/60 p-3 text-sm"
              >
                <Pen className="mt-0.5 shrink-0 size-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <RichText value={entry.note} className="text-foreground" />
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {entry.author} · {formatDateTime(entry.at)}
                    {entry.editedAt
                      ? restoration && restoration.at === entry.editedAt
                        ? ` · restaurada por ${restoration.by} el ${formatDateTime(
                            restoration.at,
                          )}`
                        : ` · corregida ${formatDateTime(entry.editedAt)}`
                      : ""}
                  </p>
                  {canEdit && noteId && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 px-2"
                        onClick={() => handleEditNote(noteId, entry.note)}
                      >
                        <Pencil className="size-3.5" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 px-2 text-destructive hover:text-destructive"
                        onClick={() => setDeletingNoteId(noteId)}
                      >
                        <Trash2 className="size-3.5" />
                        Borrar
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Se puede corregir hasta las{" "}
                        {formatClockTime(noteEditDeadline(writtenAt))}
                      </span>
                    </div>
                  )}
                  <NoteHistory
                    entry={entry}
                    canRestore={canEdit}
                    restoringVersion={restoringVersionAt}
                    onRestore={
                      noteId
                        ? (versionIndex) =>
                            void handleRestoreVersion(noteId, versionIndex)
                        : undefined
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>

        {restorable.length > 0 && (
          <Collapsible className="mt-3 border-t border-border/60 pt-3">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronDown className="size-3.5" />
                Notas retiradas ({restorable.length})
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Una nota retirada no se pierde: vuelve al cuaderno tal y como
                estaba, en su sitio y con su firma, cuando se recupera.
              </p>
              <ul className="mt-2 space-y-2">
                {restorable.map((entry, index) => {
                  const noteId = entry.id;
                  return (
                    <li
                      key={
                        noteId ??
                        `retirada-${entry.author}-${entry.at}-${index}`
                      }
                      className="rounded-lg border border-dashed border-border/70 bg-muted/30 p-3 text-sm"
                    >
                      <RichText
                        value={entry.note}
                        className="text-muted-foreground"
                      />
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {entry.author} · {formatDateTime(entry.at)}
                        {entry.deletedAt !== undefined
                          ? ` · retirada por ${entry.deletedBy ?? "—"} el ${formatDateTime(entry.deletedAt)}`
                          : ""}
                      </p>
                      <NoteHistory entry={entry} />
                      {noteId && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2 h-7 gap-1.5 px-2"
                          disabled={restoringNoteId === noteId}
                          onClick={() => void handleRestoreNote(noteId)}
                        >
                          <Undo2 className="size-3.5" />
                          Recuperar
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      {notesOpen && (
        <Dialog open onOpenChange={(open) => !open && handleCloseNote()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingNoteId ? "Corregir nota" : "Añadir nota"}
              </DialogTitle>
              <DialogDescription>
                {editingNoteId
                  ? `Corriges una nota de ${incident.reference}. La fecha del hilo y el lugar que ocupa en el cuaderno no cambian.`
                  : `Añade una nota a ${incident.reference}. Queda registrada con tu nombre y la fecha actual.`}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="note-input">Nota</Label>
                <RichTextEditor
                  id="note-input"
                  value={note}
                  onChange={setNote}
                  placeholder="p. ej. Diagnóstico en curso, se comprueba el cable..."
                  disabled={savingNote}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseNote}
                disabled={savingNote}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSaveNote}
                disabled={savingNote || richDocIsEmpty(note)}
              >
                {savingNote
                  ? "Guardando..."
                  : editingNoteId
                    ? "Guardar cambios"
                    : "Añadir nota"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {deletingNoteId && (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open && !removingNote) setDeletingNoteId(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Retirar la nota?</AlertDialogTitle>
              <AlertDialogDescription>
                Sale del cuaderno de {incident.reference}, pero no se pierde:
                podrás recuperarla desde la propia ficha si te has equivocado. El
                resto de notas y el historial de estados no cambian.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={removingNote}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                disabled={removingNote}
                onClick={(event) => {
                  event.preventDefault();
                  void handleRemoveNote();
                }}
              >
                {removingNote ? "Retirando..." : "Retirar nota"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
