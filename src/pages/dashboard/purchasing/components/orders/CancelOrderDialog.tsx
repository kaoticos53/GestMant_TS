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
import { Textarea } from "@/components/ui/textarea";
import type { CancelOrderDialogProps } from "./types";

export function CancelOrderDialog({
  order,
  onClose,
  motivo,
  onMotivoChange,
  guardando,
  onConfirmCancel,
}: CancelOrderDialogProps) {
  const open = order !== null;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anular {order?.reference}</DialogTitle>
          <DialogDescription>
            Lo que no haya llegado vuelve a la cola de compras para poder
            montarlo otra vez. El material ya recibido no se devuelve solo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="motivo-anular">Motivo</Label>
          <Textarea
            id="motivo-anular"
            value={motivo}
            onChange={(event) => onMotivoChange(event.target.value)}
            rows={3}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={guardando}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={guardando || !motivo.trim()}
            onClick={() => void onConfirmCancel()}
          >
            {guardando ? "Anulando..." : "Anular la orden"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
