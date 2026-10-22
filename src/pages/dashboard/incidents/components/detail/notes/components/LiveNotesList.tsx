import { Pen, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RichText } from "@/components/RichText";
import { NoteHistory } from "../../../NoteHistory";
import {
  canUserEditNote,
  formatNoteEditDeadlineNotice,
  formatNoteTimestamp,
  getNoteWrittenAt,
} from "../helpers";
import type { LiveNotesListProps } from "../types";

export function LiveNotesList({
  notes,
  currentUserId,
  restoringVersionAt,
  onEditNote,
  onDeleteNote,
  onRestoreVersion,
}: LiveNotesListProps) {
  if (notes.length === 0) {
    return (
      <ul className="mt-3 space-y-3">
        <li className="text-sm text-muted-foreground">
          Todavía no hay notas en el ciclo de vida.
        </li>
      </ul>
    );
  }

  return (
    <ul className="mt-3 space-y-3">
      {notes.map((entry, index) => {
        const noteId = entry.id;
        const writtenAt = getNoteWrittenAt(entry);
        const canEdit = canUserEditNote(entry, currentUserId);

        return (
          <li
            key={noteId ?? `${entry.author}-${entry.at}-${index}`}
            className="flex gap-2 rounded-lg border border-border/60 bg-background/60 p-3 text-sm"
          >
            <Pen className="mt-0.5 shrink-0 size-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <RichText value={entry.note} className="text-foreground" />
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatNoteTimestamp(entry)}
              </p>
              {canEdit && noteId && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2"
                    onClick={() => onEditNote(noteId, entry.note)}
                  >
                    <Pencil className="size-3.5" />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-destructive hover:text-destructive"
                    onClick={() => onDeleteNote(noteId)}
                  >
                    <Trash2 className="size-3.5" />
                    Borrar
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {formatNoteEditDeadlineNotice(writtenAt)}
                  </span>
                </div>
              )}
              <NoteHistory
                entry={entry}
                canRestore={canEdit}
                restoringVersion={restoringVersionAt}
                onRestore={
                  noteId
                    ? (versionIndex: number) =>
                        onRestoreVersion(noteId, versionIndex)
                    : undefined
                }
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
