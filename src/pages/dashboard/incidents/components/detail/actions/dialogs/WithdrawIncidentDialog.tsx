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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface WithdrawIncidentDialogProps {
  reference: string;
  reason: string;
  busy: boolean;
  onChangeReason: (reason: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function WithdrawIncidentDialog({
  reference,
  reason,
  busy,
  onChangeReason,
  onConfirm,
  onClose,
}: WithdrawIncidentDialogProps) {
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Retirar la incidencia {reference}?</AlertDialogTitle>
          <AlertDialogDescription>
            La incidencia saldrá de la cola activa y se moverá a la papelera,
            donde se conservará unos días antes de borrarse definitivamente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2 py-2">
          <Label htmlFor="withdraw-reason">Motivo (opcional)</Label>
          <Input
            id="withdraw-reason"
            value={reason}
            onChange={(e) => onChangeReason(e.target.value)}
            placeholder="p. ej. Notificación duplicada o por error..."
            disabled={busy}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {busy ? "Retirando..." : "Retirar a la papelera"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
