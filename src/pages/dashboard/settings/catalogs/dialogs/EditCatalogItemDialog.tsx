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
import { cn } from "@/lib/utils";
import { SupplierDetailsFields } from "../components/SupplierDetailsFields";
import type { EditingCatalogItem, SupplierDetails } from "../types";

interface EditCatalogItemDialogProps {
  item: EditingCatalogItem;
  singularLabel: string;
  isSupplier?: boolean;
  onChangeName: (name: string) => void;
  onChangeSupplierDetails?: (next: SupplierDetails) => void;
  onSave: () => void;
  onClose: () => void;
}

export function EditCatalogItemDialog({
  item,
  singularLabel,
  isSupplier = false,
  onChangeName,
  onChangeSupplierDetails,
  onSave,
  onClose,
}: EditCatalogItemDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "max-h-[85dvh] overflow-y-auto",
          isSupplier ? "sm:max-w-lg" : "sm:max-w-md",
        )}
      >
        <DialogHeader>
          <DialogTitle>Editar {singularLabel.toLowerCase()}</DialogTitle>
          <DialogDescription>
            {isSupplier
              ? "Actualiza el nombre oficial y los datos de contacto."
              : "Actualiza el nombre oficial."}
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
          {isSupplier && onChangeSupplierDetails && (
            <SupplierDetailsFields
              idPrefix="edit-supplier"
              details={{
                address: item.address,
                contacts: item.contacts,
                notes: item.notes,
              }}
              onChange={onChangeSupplierDetails}
            />
          )}
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
