import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import { getErrorMessage } from "@/lib/workshop";
import { useQuery } from "convex/react";
import { AlertTriangle, UserX } from "lucide-react";
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
  const summary = useQuery(
    api.members.getMemberSummary,
    member.active ? { userId: member._id } : "skip",
  );
  const activeIncidents = summary?.activeAssignedIncidents ?? 0;

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
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
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

        {member.active && activeIncidents > 0 && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              Este usuario tiene{" "}
              <strong>
                {activeIncidents}{" "}
                {activeIncidents === 1
                  ? "incidencia activa asignada"
                  : "incidencias activas asignadas"}
              </strong>
              . Al darle de baja, conviene reasignarlas a otro técnico.
            </span>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

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
