import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { RotateCcw } from "lucide-react";
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
import { lineDelivered, lineRemaining } from "@/lib/requestFlow";
import type { RequestDoc } from "../types";

export interface RevertApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: RequestDoc;
  onReverted?: () => void;
}

export function RevertApprovalDialog({
  open,
  onOpenChange,
  request,
  onReverted,
}: RevertApprovalDialogProps) {
  const revertApproval = useMutation(api.partRequests.revertApproval);
  const [adjustCatalogStock, setAdjustCatalogStock] = useState(true);
  const [deliverByPart, setDeliverByPart] = useState<Record<string, string>>(
    {},
  );
  const [targetStockByPart, setTargetStockByPart] = useState<
    Record<string, string>
  >({});
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const pendingLines = useMemo(
    () =>
      request.lines
        .map((line) => ({
          line,
          delivered: lineDelivered(line, request.status),
          remaining: lineRemaining(line, request.status),
        }))
        .filter((item) => item.remaining > 0),
    [request.lines, request.status],
  );

  const resetForm = () => {
    setDeliverByPart({});
    setTargetStockByPart({});
    setNote("");
    setAdjustCatalogStock(true);
  };

  const handleClose = () => {
    if (submitting) return;
    onOpenChange(false);
    resetForm();
  };

  const handleConfirm = async () => {
    const deliverLines: Array<{
      sparePartId: Id<"spareParts">;
      quantity: number;
    }> = [];
    const stockAdjustments: Array<{
      sparePartId: Id<"spareParts">;
      targetStock: number;
    }> = [];

    for (const { line, remaining } of pendingLines) {
      const id = line.sparePartId;
      const rawDeliver = deliverByPart[id] ?? "0";
      const parsedDeliver = Math.floor(Number(rawDeliver));
      if (!Number.isFinite(parsedDeliver) || parsedDeliver < 0) {
        toast.error(`Cantidad a entregar no válida en ${line.code}.`);
        return;
      }
      if (parsedDeliver > remaining) {
        toast.error(
          `En ${line.code} solo quedan ${remaining} unidades pendientes por entregar.`,
        );
        return;
      }
      if (parsedDeliver > 0) {
        deliverLines.push({ sparePartId: id, quantity: parsedDeliver });
      }

      if (adjustCatalogStock) {
        const rawTarget = targetStockByPart[id] ?? "0";
        const parsedTarget = Math.floor(Number(rawTarget));
        if (!Number.isFinite(parsedTarget) || parsedTarget < 0) {
          toast.error(`El stock final para ${line.code} debe ser 0 o mayor.`);
          return;
        }
        stockAdjustments.push({ sparePartId: id, targetStock: parsedTarget });
      }
    }

    setSubmitting(true);
    try {
      await revertApproval({
        requestId: request._id,
        deliverLines: deliverLines.length > 0 ? deliverLines : undefined,
        stockAdjustments: adjustCatalogStock ? stockAdjustments : undefined,
        note: note.trim() || undefined,
      });
      toast.success(
        `Aprobación de ${request.reference} revertida a pendiente.`,
      );
      onOpenChange(false);
      resetForm();
      onReverted?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo revertir la aprobación.",
      );
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
          <DialogTitle>Revertir aprobación ({request.reference})</DialogTitle>
          <DialogDescription>
            Si no hay stock suficiente en el almacén, puedes entregar ahora las
            unidades disponibles y devolver lo pendiente a estado{" "}
            <strong>pendiente</strong> para tramitar la compra.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-4 overflow-y-auto py-2 pr-1">
          {pendingLines.map(({ line, delivered, remaining }) => {
            const id = line.sparePartId;
            return (
              <div
                key={id}
                className="grid gap-2.5 rounded-lg border border-border/70 bg-muted/20 p-3"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {line.code} · {line.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {delivered > 0
                      ? `Entregadas: ${delivered} · Pendientes: ${remaining}`
                      : `Pendientes: ${remaining}`}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1">
                    <Label
                      htmlFor={`revert-deliver-${id}`}
                      className="text-xs text-muted-foreground"
                    >
                      Entregar ahora (máx. {remaining})
                    </Label>
                    <Input
                      id={`revert-deliver-${id}`}
                      type="number"
                      min={0}
                      max={remaining}
                      step={1}
                      value={deliverByPart[id] ?? "0"}
                      onChange={(event) =>
                        setDeliverByPart((prev) => ({
                          ...prev,
                          [id]: event.target.value,
                        }))
                      }
                      disabled={submitting}
                    />
                  </div>

                  {adjustCatalogStock && (
                    <div className="grid gap-1">
                      <Label
                        htmlFor={`revert-target-stock-${id}`}
                        className="text-xs text-muted-foreground"
                      >
                        Stock final en catálogo
                      </Label>
                      <Input
                        id={`revert-target-stock-${id}`}
                        type="number"
                        min={0}
                        step={1}
                        value={targetStockByPart[id] ?? "0"}
                        onChange={(event) =>
                          setTargetStockByPart((prev) => ({
                            ...prev,
                            [id]: event.target.value,
                          }))
                        }
                        disabled={submitting}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <label
            htmlFor="revert-adjust-stock"
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 bg-muted/30 p-3"
          >
            <input
              id="revert-adjust-stock"
              type="checkbox"
              checked={adjustCatalogStock}
              onChange={(event) =>
                setAdjustCatalogStock(event.target.checked)
              }
              disabled={submitting}
              className="mt-0.5 size-4 rounded border-input accent-primary"
            />
            <span className="grid gap-1 text-sm leading-snug">
              <span className="font-medium text-foreground">
                Ajustar stock real del catálogo al revertir
              </span>
              <span className="text-xs text-muted-foreground">
                Deja el stock de cada repuesto en el valor indicado (0 por
                defecto, o las unidades reales que queden) registrando el ajuste
                manual.
              </span>
            </span>
          </label>

          <div className="grid gap-2">
            <Label htmlFor="revert-approval-note">Motivo (opcional)</Label>
            <Textarea
              id="revert-approval-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ej. Entregadas las unidades disponibles; resto pendiente de compra…"
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
            <RotateCcw className="size-4" />
            {submitting ? "Revirtiendo..." : "Revertir a pendiente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
