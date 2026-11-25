import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { ClipboardCheck } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/workshop";
import type { PartDoc } from "../types";

export interface InventoryCountDialogProps {
  open: boolean;
  onClose: () => void;
  parts: PartDoc[];
}

export function InventoryCountDialog({
  open,
  onClose,
  parts,
}: InventoryCountDialogProps) {
  const applyInventoryCount = useMutation(api.spareParts.applyInventoryCount);
  const [search, setSearch] = useState("");
  const [countedByPart, setCountedByPart] = useState<Record<string, string>>(
    {},
  );
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const visibleParts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return parts;
    return parts.filter(
      (part) =>
        part.code.toLowerCase().includes(q) ||
        part.name.toLowerCase().includes(q) ||
        (part.location ?? "").toLowerCase().includes(q) ||
        part.category.toLowerCase().includes(q),
    );
  }, [parts, search]);

  const pendingDeltas = useMemo(() => {
    const list: Array<{
      sparePartId: Id<"spareParts">;
      code: string;
      countedStock: number;
      delta: number;
    }> = [];
    for (const part of parts) {
      const raw = countedByPart[part._id];
      if (raw === undefined || raw.trim() === "") continue;
      const num = Math.floor(Number(raw));
      if (!Number.isFinite(num) || num < 0) continue;
      if (num !== part.stock) {
        list.push({
          sparePartId: part._id,
          code: part.code,
          countedStock: num,
          delta: num - part.stock,
        });
      }
    }
    return list;
  }, [parts, countedByPart]);

  const handleClose = () => {
    if (submitting) return;
    setCountedByPart({});
    setNote("");
    setSearch("");
    onClose();
  };

  const handleSubmit = async () => {
    if (pendingDeltas.length === 0) {
      toast.info("No hay diferencias respecto al stock actual.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await applyInventoryCount({
        counts: pendingDeltas.map(({ sparePartId, countedStock }) => ({
          sparePartId,
          countedStock,
        })),
        note: note.trim() || undefined,
      });
      toast.success(
        `Recuento aplicado en ${res.updatedCount} repuesto(s).`,
      );
      setCountedByPart({});
      setNote("");
      setSearch("");
      onClose();
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Recuento físico de almacén</DialogTitle>
          <DialogDescription>
            Introduce la cantidad real contada en estantería. Solo se
            regularizarán los artículos con diferencia.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filtrar por código, nombre, ubicación o categoría…"
              aria-label="Filtrar repuestos"
              disabled={submitting}
            />
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Nota del recuento (opcional)…"
              aria-label="Nota del recuento"
              maxLength={160}
              disabled={submitting}
            />
          </div>

          <div className="max-h-[48vh] divide-y divide-border/60 overflow-y-auto rounded-lg border border-border/70">
            {visibleParts.map((part) => {
              const raw = countedByPart[part._id] ?? "";
              const parsed =
                raw.trim() === "" ? null : Math.floor(Number(raw));
              const valid =
                parsed !== null && Number.isFinite(parsed) && parsed >= 0;
              const delta = valid ? parsed - part.stock : 0;

              return (
                <div
                  key={part._id}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      <span className="font-mono text-xs">{part.code}</span> ·{" "}
                      {part.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Stock actual: {part.stock} {part.unit}
                      {part.location ? ` · Ubicación: ${part.location}` : ""}
                    </p>
                  </div>

                  <div className="w-24">
                    <Label htmlFor={`count-${part._id}`} className="sr-only">
                      Recuento de {part.code}
                    </Label>
                    <Input
                      id={`count-${part._id}`}
                      type="number"
                      min={0}
                      step={1}
                      placeholder={String(part.stock)}
                      value={raw}
                      onChange={(event) =>
                        setCountedByPart((prev) => ({
                          ...prev,
                          [part._id]: event.target.value,
                        }))
                      }
                      className="h-8 text-right tabular-nums"
                      disabled={submitting}
                    />
                  </div>

                  <span
                    className={cn(
                      "w-16 text-right text-xs font-medium tabular-nums",
                      delta < 0
                        ? "text-destructive"
                        : delta > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground",
                    )}
                  >
                    {valid && delta !== 0
                      ? delta > 0
                        ? `+${delta}`
                        : String(delta)
                      : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {pendingDeltas.length} artículo(s) con diferencia
          </span>
          <div className="flex gap-2">
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
              disabled={submitting || pendingDeltas.length === 0}
              onClick={() => void handleSubmit()}
            >
              <ClipboardCheck className="size-4" />
              {submitting ? "Aplicando..." : "Aplicar recuento"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
