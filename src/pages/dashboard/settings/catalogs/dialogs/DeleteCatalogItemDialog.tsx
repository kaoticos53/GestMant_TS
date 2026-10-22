import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeleteCatalogItemDialogProps {
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteCatalogItemDialog({
  onConfirm,
  onClose,
}: DeleteCatalogItemDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Eliminar del catálogo?</DialogTitle>
          <DialogDescription>
            Se quitará esta sugerencia del autocompletado. Los registros que
            ya contengan este valor no se modificarán.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
          >
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
