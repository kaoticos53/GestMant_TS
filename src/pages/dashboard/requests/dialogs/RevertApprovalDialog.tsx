import { useState } from "react";
import { useMutation } from "convex/react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
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
import { Textarea } from "@/components/ui/textarea";
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
  const [adjustCatalogStockToZero, setAdjustCatalogStockToZero] =
    useState(true);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    if (submitting) return;
    onOpenChange(false);
    setNote("");
    setAdjustCatalogStockToZero(true);
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await revertApproval({
        requestId: request._id,
        adjustCatalogStockToZero,
        note: note.trim() || undefined,
      });
      toast.success(
        `Aprobación de ${request.reference} revertida a pendiente.`,
      );
      onOpenChange(false);
      setNote("");
      setAdjustCatalogStockToZero(true);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Revertir aprobación ({request.reference})</DialogTitle>
          <DialogDescription>
            Si no hay stock real en el almacén, la petición volverá a estado{" "}
            <strong>pendiente</strong> y se liberará la reserva para que puedas
            generar una petición de compra.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <label
            htmlFor="revert-adjust-stock-zero"
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 bg-muted/30 p-3"
          >
            <input
              id="revert-adjust-stock-zero"
              type="checkbox"
              checked={adjustCatalogStockToZero}
              onChange={(event) =>
                setAdjustCatalogStockToZero(event.target.checked)
              }
              disabled={submitting}
              className="mt-0.5 size-4 rounded border-input accent-primary"
            />
            <span className="grid gap-1 text-sm leading-snug">
              <span className="font-medium text-foreground">
                Ajustar el stock real del catálogo a 0
              </span>
              <span className="text-xs text-muted-foreground">
                Deja a 0 las existencias de los repuestos de esta petición y
                registra el ajuste manual en el historial de movimientos.
              </span>
            </span>
          </label>

          <div className="grid gap-2">
            <Label htmlFor="revert-approval-note">Motivo (opcional)</Label>
            <Textarea
              id="revert-approval-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ej. Stock físico agotado en almacén; pendiente de compra…"
              rows={3}
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
