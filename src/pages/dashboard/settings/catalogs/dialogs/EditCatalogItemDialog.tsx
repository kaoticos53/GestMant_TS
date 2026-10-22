import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EditingCatalogItem } from "../types";

interface EditCatalogItemDialogProps {
  item: EditingCatalogItem;
  singularLabel: string;
  onChangeName: (name: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export function EditCatalogItemDialog({
  item,
  singularLabel,
  onChangeName,
  onSave,
  onClose,
}: EditCatalogItemDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar {singularLabel.toLowerCase()}</DialogTitle>
          <DialogDescription>
            Actualiza el nombre oficial.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="edit-cat-name">Nombre canónico</Label>
            <Input
              id="edit-cat-name"
              value={item.name}
              onChange={(e) => onChangeName(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={onSave}>
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
