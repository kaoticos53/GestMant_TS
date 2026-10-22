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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/RichTextEditor";
import type { Id } from "@/convex/_generated/dataModel";
import { UserPlus } from "lucide-react";
import { useNewMessageForm } from "../hooks/useNewMessageForm";
import type { Contact } from "../types";

export interface NewMessageDialogProps {
  contacts: readonly Contact[];
  onSent: (userId: Id<"users">, name: string) => void;
  onClose: () => void;
}

/**
 * Diálogo modal para iniciar una conversación con cualquier usuario del directorio.
 */
export function NewMessageDialog({
  contacts,
  onSent,
  onClose,
}: NewMessageDialogProps) {
  const {
    recipientId,
    setRecipientId,
    text,
    setText,
    busy,
    error,
    canSubmit,
    handleSubmit,
  } = useNewMessageForm({
    contacts,
    onSent,
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-4" />
            Nuevo mensaje
          </DialogTitle>
          <DialogDescription>
            Escribe a cualquier persona del taller. Verás la respuesta aquí
            mismo, en tiempo real.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="message-recipient">Para</Label>
            <Select
              value={recipientId}
              onValueChange={setRecipientId}
              disabled={busy}
            >
              <SelectTrigger id="message-recipient">
                <SelectValue placeholder="Elige un usuario" />
              </SelectTrigger>
              <SelectContent>
                {contacts.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No hay ningún usuario disponible
                  </SelectItem>
                ) : (
                  contacts.map((contact) => (
                    <SelectItem key={contact._id} value={contact._id}>
                      {contact.name}
                      {contact.position ? ` · ${contact.position}` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="message-text">Mensaje</Label>
            <RichTextEditor
              id="message-text"
              value={text}
              onChange={setText}
              placeholder="¿Me pasas el cable SDI del plató 2?"
              disabled={busy}
              compact
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="gap-2"
              disabled={busy || !canSubmit}
            >
              {busy ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
