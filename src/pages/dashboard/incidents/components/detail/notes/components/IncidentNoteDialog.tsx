import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/RichTextEditor";
import { richDocIsEmpty } from "@/lib/richDoc";
import {
  getNoteDialogDescription,
  getNoteDialogTitle,
  getNoteSubmitLabel,
} from "../helpers";
import type { IncidentNoteDialogProps } from "../types";

export function IncidentNoteDialog({
  open,
  reference,
  editingNoteId,
  note,
  savingNote,
  onChangeNote,
  onClose,
  onSave,
}: IncidentNoteDialogProps) {
  if (!open) return null;

  const isEditing = Boolean(editingNoteId);

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{getNoteDialogTitle(isEditing)}</DialogTitle>
          <DialogDescription>
            {getNoteDialogDescription(isEditing, reference)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="note-input">Nota</Label>
            <RichTextEditor
              id="note-input"
              value={note}
              onChange={onChangeNote}
              placeholder="p. ej. Diagnóstico en curso, se comprueba el cable..."
              disabled={savingNote}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={savingNote}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={savingNote || richDocIsEmpty(note)}
          >
            {getNoteSubmitLabel(savingNote, isEditing)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
