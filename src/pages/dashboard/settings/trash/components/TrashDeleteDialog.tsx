import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatFileSize } from "@/lib/workshop";
import { Trash2 } from "lucide-react";
import type { DeletingEntity } from "../types";

interface TrashDeleteDialogProps {
  entity: DeletingEntity | null;
  busyId: string | null;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

/**
 * Diálogo modal unificado de confirmación de borrado definitivo irreversible.
 */
export function TrashDeleteDialog({
  entity,
  busyId,
  onClose,
  onConfirm,
}: TrashDeleteDialogProps) {
  if (!entity) return null;

  const isBusy = busyId === entity.item.id;

  const title =
    entity.type === "incident"
      ? `¿Borrar incidencia ${entity.item.reference} definitivamente?`
      : entity.type === "request"
        ? `¿Borrar petición ${entity.item.reference} definitivamente?`
        : "Borrar archivo de la papelera";

  const description =
    entity.type === "incident"
      ? "Se borrará ahora, sin esperar el plazo de la papelera, y con ella su expediente: sus documentos, sus notas y los avisos que la señalaban. Esta acción no se puede deshacer."
      : entity.type === "request"
        ? "Se borrará ahora, sin esperar el plazo de la papelera: la petición y los archivos que adjuntaba. Las compras que se pidieron por ella se quedan en su módulo. Esta acción no se puede deshacer."
        : `Se borrará del almacén este archivo (${formatFileSize(
            entity.item.size,
          )}) sin esperar a su plazo. Después ya no se puede recuperar.`;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isBusy}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="gap-2"
            disabled={isBusy}
            onClick={() => void onConfirm()}
          >
            <Trash2 className="size-4" />
            {isBusy ? "Borrando..." : "Borrar definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
