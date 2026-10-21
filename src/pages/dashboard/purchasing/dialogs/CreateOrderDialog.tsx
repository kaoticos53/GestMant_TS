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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { formatDate, getErrorMessage } from "@/lib/workshop";
import type { PurchaseRequestDoc } from "@/lib/purchasing";

export interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PurchaseRequestDoc[];
  onCreated: () => void;
}

/** Monta la orden con lo elegido: notas de la orden y nota de cada artículo. */
export function CreateOrderDialog({
  open,
  onOpenChange,
  items,
  onCreated,
}: CreateOrderDialogProps) {
  const crear = useMutation(api.purchasing.createOrder);
  const [solicitudeCode, setSolicitudeCode] = useState("");
  const [notes, setNotes] = useState("");
  const [lineNotes, setLineNotes] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const supplier = items[0]?.supplier ?? "";

  const enviar = async () => {
    setGuardando(true);
    try {
      const { reference } = await crear({
        purchaseRequestIds: items.map((row) => row._id),
        ...(solicitudeCode.trim() ? { solicitudeCode: solicitudeCode.trim() } : {}),
        ...(notes.trim() ? { notes } : {}),
        ...(Object.values(lineNotes).some((value) => value.trim())
          ? { lineNotes }
          : {}),
      });
      toast.success(`Orden ${reference} creada`, {
        description: `${items.length} artículo${items.length === 1 ? "" : "s"} para ${supplier}.`,
      });
      onCreated();
      setSolicitudeCode("");
      setNotes("");
      setLineNotes({});
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Orden de compra · {supplier}</DialogTitle>
          <DialogDescription>
            Se manda con la fecha de hoy y su número; cada artículo dice de qué
            petición sale. Las notas son para ti y para el proveedor.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="orden-solicitud">Código de solicitud de compra</Label>
            <Input
              id="orden-solicitud"
              value={solicitudeCode}
              onChange={(event) => setSolicitudeCode(event.target.value)}
              placeholder="Ej. 10034573 (opcional, por defecto vacío)"
            />
            <p className="text-xs text-muted-foreground">
              Número de solicitud o SolPed de compra para vincular con el histórico/Excel.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="orden-notas">Notas de la orden</Label>
            <Textarea
              id="orden-notas"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              placeholder="Plazo de entrega, forma de pago, quién la autoriza..."
            />
          </div>
          <div className="grid gap-2">
            <Label>Artículos</Label>
            {items.map((row) => (
              <div
                key={row._id}
                className="grid gap-1 rounded-lg border border-border px-3 py-2"
              >
                <p className="text-sm font-medium">
                  {row.code} · {row.name} — {row.quantity} {row.unit}
                </p>
                <p className="text-xs text-muted-foreground">
                  Desde {row.requestReference} · {formatDate(row.requestDate)}
                </p>
                <Input
                  value={lineNotes[row._id] ?? ""}
                  onChange={(event) =>
                    setLineNotes((actual) => ({
                      ...actual,
                      [row._id]: event.target.value,
                    }))
                  }
                  placeholder="Nota de este artículo"
                />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={guardando}
            onClick={() => void enviar()}
          >
            Crear la orden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
