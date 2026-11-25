import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { RefreshCw } from "lucide-react";
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
import { lineDelivered } from "@/lib/requestFlow";
import { getErrorMessage } from "@/lib/workshop";
import type { PartDoc, RequestDoc } from "../types";

export interface ReplaceLineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: RequestDoc;
  parts: PartDoc[];
}

export function ReplaceLineDialog({
  open,
  onOpenChange,
  request,
  parts,
}: ReplaceLineDialogProps) {
  const replaceLine = useMutation(api.partRequests.replaceLine);
  const [selectedOldId, setSelectedOldId] = useState<string>(
    request.lines[0]?.sparePartId ?? "",
  );
  const currentLine = useMemo(
    () =>
      request.lines.find((line) => line.sparePartId === selectedOldId) ??
      request.lines[0],
    [request.lines, selectedOldId],
  );
  const currentPart = useMemo(
    () => parts.find((p) => p._id === currentLine?.sparePartId),
    [parts, currentLine],
  );
  const [newPartId, setNewPartId] = useState<string>(
    currentPart?.replacementPartId ?? currentLine?.sparePartId ?? "",
  );
  const [quantity, setQuantity] = useState<string>(
    String(currentLine?.quantity ?? 1),
  );
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!currentLine) return null;

  const delivered = lineDelivered(currentLine, request.status);
  const activeParts = parts.filter((p) => p.lifecycleStatus !== "discontinued");

  const handleSelectLine = (oldId: string) => {
    setSelectedOldId(oldId);
    const line = request.lines.find((l) => l.sparePartId === oldId);
    const part = parts.find((p) => p._id === oldId);
    if (line) {
      setNewPartId(part?.replacementPartId ?? line.sparePartId);
      setQuantity(String(line.quantity));
    }
  };

  const handleSubmit = async () => {
    const qty = Math.floor(Number(quantity));
    if (!Number.isFinite(qty) || qty < 1) {
      toast.error("Indica una cantidad válida (1 o más).");
      return;
    }
    setSubmitting(true);
    try {
      await replaceLine({
        requestId: request._id,
        oldSparePartId: currentLine.sparePartId,
        newSparePartId: (newPartId || currentLine.sparePartId) as Id<"spareParts">,
        quantity: qty,
        note: note.trim() || undefined,
      });
      toast.success(`Línea actualizada en ${request.reference}.`);
      onOpenChange(false);
      setNote("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sustituir o ajustar línea ({request.reference})</DialogTitle>
          <DialogDescription>
            Cambia un repuesto descatalogado por su equivalente o ajusta la
            cantidad solicitada antes de aprobar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          {request.lines.length > 1 && (
            <div className="grid gap-1.5">
              <Label htmlFor="replace-old-line">Línea de la petición</Label>
              <select
                id="replace-old-line"
                value={currentLine.sparePartId}
                onChange={(e) => handleSelectLine(e.target.value)}
                disabled={submitting}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
              >
                {request.lines.map((line) => (
                  <option key={line.sparePartId} value={line.sparePartId}>
                    {line.code} · {line.name} (×{line.quantity})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="replace-new-part">Repuesto</Label>
            <select
              id="replace-new-part"
              value={newPartId || currentLine.sparePartId}
              onChange={(e) => setNewPartId(e.target.value)}
              disabled={submitting || delivered > 0}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
            >
              {activeParts.map((part) => (
                <option key={part._id} value={part._id}>
                  {part.code} · {part.name} (stock: {part.stock})
                  {currentPart?.replacementPartId === part._id
                    ? " ★ Equivalente"
                    : ""}
                </option>
              ))}
            </select>
            {delivered > 0 && (
              <p className="text-xs text-muted-foreground">
                Ya tiene {delivered} ud(s) entregada(s): solo puedes ajustar la
                cantidad total.
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="replace-qty">Cantidad solicitada</Label>
            <Input
              id="replace-qty"
              type="number"
              min={Math.max(1, delivered)}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="replace-note">Motivo (opcional)</Label>
            <Input
              id="replace-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej. Referencia original descatalogada…"
              maxLength={180}
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="gap-2"
            onClick={() => void handleSubmit()}
            disabled={submitting}
          >
            <RefreshCw className="size-4" />
            {submitting ? "Guardando..." : "Guardar cambio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
