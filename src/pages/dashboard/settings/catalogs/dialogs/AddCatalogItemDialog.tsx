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

interface AddCatalogItemDialogProps {
  singularLabel: string;
  placeholder: string;
  name: string;
  onChangeName: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export function AddCatalogItemDialog({
  singularLabel,
  placeholder,
  name,
  onChangeName,
  onSubmit,
  onClose,
}: AddCatalogItemDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva {singularLabel.toLowerCase()}</DialogTitle>
          <DialogDescription>
            Añade una opción canónica al catálogo maestro.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="new-cat-name">Nombre</Label>
            <Input
              id="new-cat-name"
              value={name}
              onChange={(e) => onChangeName(e.target.value)}
              placeholder={placeholder}
              autoFocus
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
