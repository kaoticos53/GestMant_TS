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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CatalogItemDoc, MergingCatalogItem } from "../types";

interface MergeCatalogItemDialogProps {
  item: MergingCatalogItem;
  targetMergeId: string;
  availableTargets: CatalogItemDoc[];
  onChangeTargetId: (targetId: string) => void;
  onMerge: () => void;
  onClose: () => void;
}

export function MergeCatalogItemDialog({
  item,
  targetMergeId,
  availableTargets,
  onChangeTargetId,
  onMerge,
  onClose,
}: MergeCatalogItemDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fusionar duplicado</DialogTitle>
          <DialogDescription>
            Reemplaza todas las apariciones de &quot;{item.name}&quot; por
            otro elemento canónico y elimina este duplicado.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Elemento canónico de destino</Label>
            <Select
              value={targetMergeId}
              onValueChange={onChangeTargetId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona el valor correcto..." />
              </SelectTrigger>
              <SelectContent>
                {availableTargets.map((opt) => (
                  <SelectItem key={opt._id} value={opt._id}>
                    {opt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
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
            variant="default"
            disabled={!targetMergeId}
            onClick={onMerge}
          >
            Fusionar y corregir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
