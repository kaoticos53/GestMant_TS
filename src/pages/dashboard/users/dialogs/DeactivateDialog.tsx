import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getErrorMessage } from "@/lib/workshop";
import { UserX } from "lucide-react";
import { useState } from "react";
import type { Member } from "../types";

interface DeactivateDialogProps {
  member: Member;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/**
 * Diálogo modal de confirmación para dar de baja a un usuario (revocar acceso).
 */
export function DeactivateDialog({
  member,
  onConfirm,
  onClose,
}: DeactivateDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="size-4" />
            Dar de baja
          </DialogTitle>
          <DialogDescription>
            {member.name ?? member.email ?? "Este usuario"} perderá el acceso a
            Pulso Taller y se cerrarán sus sesiones. Su historial se conserva y
            podrás reactivarlo cuando quieras.
          </DialogDescription>
        </DialogHeader>

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
            type="button"
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={busy}
          >
            {busy ? "Dando de baja..." : "Dar de baja"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
