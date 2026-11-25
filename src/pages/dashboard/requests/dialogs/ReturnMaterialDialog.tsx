import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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
import { lineDelivered, type ReturnDisposition } from "@/lib/requestFlow";
import { getErrorMessage } from "@/lib/workshop";
import type { RequestDoc } from "../types";

export interface ReturnMaterialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: RequestDoc;
}

export function ReturnMaterialDialog({
  open,
  onOpenChange,
  request,
}: ReturnMaterialDialogProps) {
  const returnMaterial = useMutation(api.partRequests.returnMaterial);
  const [qtyByPart, setQtyByPart] = useState<Record<string, string>>({});
  const [dispByPart, setDispByPart] = useState<
    Record<string, ReturnDisposition>
  >({});
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const deliveredLines = useMemo(
    () =>
      request.lines
        .map((line) => ({
          line,
          delivered: lineDelivered(line, request.status),
        }))
        .filter((item) => item.delivered > 0),
    [request.lines, request.status],
  );

  const resetForm = () => {
    setQtyByPart({});
    setDispByPart({});
    setNote("");
  };

  const handleClose = () => {
    if (submitting) return;
    onOpenChange(false);
    resetForm();
  };

  const handleConfirm = async () => {
    const entries: Array<{
      sparePartId: Id<"spareParts">;
      quantity: number;
      disposition: ReturnDisposition;
    }> = [];

    for (const { line, delivered } of deliveredLines) {
      const id = line.sparePartId;
      const raw = qtyByPart[id] ?? String(delivered);
      const qty = Math.floor(Number(raw));
      if (!Number.isFinite(qty) || qty < 0) {
        toast.error(`Cantidad no válida para ${line.code}.`);
        return;
      }
      if (qty > delivered) {
        toast.error(
          `De ${line.code} solo puedes devolver hasta ${delivered} unidad(es).`,
        );
        return;
      }
      if (qty > 0) {
        entries.push({
          sparePartId: id,
          quantity: qty,
          disposition: dispByPart[id] ?? "restock",
        });
      }
    }

    if (entries.length === 0) {
      toast.error("Indica al menos una unidad para devolver.");
      return;
    }

    setSubmitting(true);
    try {
      await returnMaterial({
        requestId: request._id,
        lines: entries,
        note: note.trim() || undefined,
      });
      toast.success(`Devolución registrada en ${request.reference}.`);
      onOpenChange(false);
      resetForm();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Devolver material ({request.reference})</DialogTitle>
          <DialogDescription>
            Indica cuántas unidades devuelve el técnico y si regresan útiles al
            stock del almacén o son merma/material dañado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-3 overflow-y-auto py-2 pr-1">
          {deliveredLines.map(({ line, delivered }) => {
            const id = line.sparePartId;
            const disposition = dispByPart[id] ?? "restock";
            return (
              <div
                key={id}
                className="grid gap-2.5 rounded-lg border border-border/70 bg-muted/20 p-3"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">
                    {line.code} · {line.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Entregadas: {delivered}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1">
                    <Label
                      htmlFor={`return-qty-${id}`}
                      className="text-xs text-muted-foreground"
                    >
                      Cantidad a devolver
                    </Label>
                    <Input
                      id={`return-qty-${id}`}
                      type="number"
                      min={0}
                      max={delivered}
                      step={1}
                      value={qtyByPart[id] ?? String(delivered)}
                      onChange={(event) =>
                        setQtyByPart((prev) => ({
                          ...prev,
                          [id]: event.target.value,
                        }))
                      }
                      disabled={submitting}
                    />
                  </div>

                  <div className="grid gap-1">
                    <Label
                      htmlFor={`return-disp-${id}`}
                      className="text-xs text-muted-foreground"
                    >
                      Destino
                    </Label>
                    <select
                      id={`return-disp-${id}`}
                      value={disposition}
                      onChange={(event) =>
                        setDispByPart((prev) => ({
                          ...prev,
                          [id]: event.target.value as ReturnDisposition,
                        }))
                      }
                      disabled={submitting}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="restock">Útil → vuelve al stock</option>
                      <option value="damaged">Dañada / merma</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="grid gap-2">
            <Label htmlFor="return-material-note">Motivo (opcional)</Label>
            <Textarea
              id="return-material-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ej. Sobrante tras reparación, pieza incompatible o llegada defectuosa…"
              rows={2}
              maxLength={240}
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="gap-2"
            onClick={() => void handleConfirm()}
            disabled={submitting}
          >
            <Undo2 className="size-4" />
            {submitting ? "Registrando..." : "Confirmar devolución"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
