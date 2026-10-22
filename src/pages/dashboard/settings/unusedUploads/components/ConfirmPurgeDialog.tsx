import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cleanupTicketsLabel, cleanupUnreadableLabel } from "@/lib/cleanupLog";
import { formatFileSize } from "@/lib/workshop";
import { Trash2 } from "lucide-react";

export interface ConfirmPurgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imagesCount: number;
  totalBytes: number;
  ticketsCount: number;
  unreadableCount: number;
  retentionDays: number;
  purging: boolean;
  onConfirm: () => void;
}

export function ConfirmPurgeDialog({
  open,
  onOpenChange,
  imagesCount,
  totalBytes,
  ticketsCount,
  unreadableCount,
  retentionDays,
  purging,
  onConfirm,
}: ConfirmPurgeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Purgar sin esperar a la noche</DialogTitle>
          <DialogDescription>
            {`Se retirarán ${imagesCount} ${
              imagesCount === 1 ? "imagen" : "imágenes"
            } (${formatFileSize(totalBytes)})`}
            {ticketsCount > 0
              ? ` y ${cleanupTicketsLabel(ticketsCount)}`
              : ""}
            {unreadableCount > 0
              ? `, y ${cleanupUnreadableLabel(
                  unreadableCount,
                )}, que se irán sin dejar nada en la papelera`
              : ""}
            {`. No están en ninguna incidencia, así que no se pierde nada del expediente: se quedan ${retentionDays} días en la papelera, por si hay que volver a por ellas.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="gap-2"
            disabled={purging}
            onClick={onConfirm}
          >
            <Trash2 className="size-4" />
            {purging ? "Purgando..." : "Purgar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
