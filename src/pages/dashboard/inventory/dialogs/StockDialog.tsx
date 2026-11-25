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
import {
  STOCK_ADJUSTMENT_OPTIONS,
  type StockAdjustmentKind,
} from "@/lib/movements";
import { getErrorMessage } from "@/lib/workshop";
import type { PartDoc } from "../types";

export interface StockDialogProps {
  part: PartDoc;
  onClose: () => void;
}

/** Ajuste de stock a un valor concreto con tipificación real del motivo */
export function StockDialog({ part, onClose }: StockDialogProps) {
  const adjustStock = useMutation(api.spareParts.adjustStock);
  const [value, setValue] = useState(String(part.stock));
  const [kind, setKind] = useState<StockAdjustmentKind>("manual_adjust");
  const [reason, setReason] = useState("");
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
        kind,
        reason: reason.trim() || undefined,
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

        <div className="grid gap-3">
          <div className="grid gap-1.5">
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

          <div className="grid gap-1.5">
            <Label htmlFor="stock-kind">Motivo del movimiento</Label>
            <select
              id="stock-kind"
              value={kind}
              onChange={(event) =>
                setKind(event.target.value as StockAdjustmentKind)
              }
              disabled={busy}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {STOCK_ADJUSTMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="stock-reason">Detalle (opcional)</Label>
            <Input
              id="stock-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ej. Extraviado en estantería B-03…"
              maxLength={160}
              disabled={busy}
            />
          </div>
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
