import { ChevronDown, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { RichText } from "@/components/RichText";
import { formatDateTime } from "@/lib/workshop";
import { NoteHistory } from "../../../NoteHistory";
import type { RetiredNotesCollapsibleProps } from "../types";

export function RetiredNotesCollapsible({
  restorable,
  restoringNoteId,
  onRestoreNote,
}: RetiredNotesCollapsibleProps) {
  if (restorable.length === 0) return null;

  return (
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
          Una nota retirada no se pierde: vuelve al cuaderno tal y como estaba,
          en su sitio y con su firma, cuando se recupera.
        </p>
        <ul className="mt-2 space-y-2">
          {restorable.map((entry, index) => {
            const noteId = entry.id;
            return (
              <li
                key={noteId ?? `retirada-${entry.author}-${entry.at}-${index}`}
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
                    onClick={() => onRestoreNote(noteId)}
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
  );
}
