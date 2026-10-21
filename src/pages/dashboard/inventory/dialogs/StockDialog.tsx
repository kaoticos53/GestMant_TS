import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
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
import { api } from "@/convex/_generated/api";
import { getErrorMessage } from "@/lib/workshop";
import type { PartDoc } from "../types";

export interface StockDialogProps {
  part: PartDoc;
  onClose: () => void;
}

/** Ajuste de stock a un valor concreto */
export function StockDialog({ part, onClose }: StockDialogProps) {
  const adjustStock = useMutation(api.spareParts.adjustStock);
  const [value, setValue] = useState(String(part.stock));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    const target = Number(value.replace(",", "."));
    if (!Number.isFinite(target) || target < 0) {
      setError("Introduce un número positivo.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await adjustStock({
        id: part._id,
        delta: Math.round(target) - part.stock,
      });
      toast.success(
        `Stock de ${part.code}: ${Math.round(target)} ${part.unit}`,
      );
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Ajustar stock</DialogTitle>
          <DialogDescription>
            {part.code} · {part.name} — hay {part.stock} {part.unit}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="stock-target">Nuevo stock ({part.unit})</Label>
          <Input
            id="stock-target"
            type="number"
            min={0}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="tabular-nums"
            disabled={busy}
            autoFocus
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={busy}>
            {busy ? "Guardando..." : "Guardar stock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
