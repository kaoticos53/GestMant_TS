import { useState } from "react";
import { useMutation } from "convex/react";
import { FileText, RotateCcw, Truck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { formatDateTime, getErrorMessage } from "@/lib/workshop";
import type { ReceptionDoc } from "../types";

export interface MovementsSectionProps {
  receptions: ReceptionDoc[];
  canManage?: boolean;
}

/** Movimientos de recepción: cada entrada de un proveedor con su albarán. */
export function MovementsSection({
  receptions,
  canManage = false,
}: MovementsSectionProps) {
  const reverseReception = useMutation(api.purchasing.reverseReception);
  const [reversing, setReversing] = useState<ReceptionDoc | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (receptions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-sm">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
          <Truck className="size-5" />
        </span>
        <p className="mt-4 text-base font-semibold tracking-tight">
          No ha entrado material todavía
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
          Cada entrada de un proveedor deja aquí su movimiento con el albarán
          adjunto, y es lo que mete el stock en el almacén.
        </p>
      </div>
    );
  }

  const handleClose = () => {
    if (submitting) return;
    setReversing(null);
    setNote("");
  };

  const handleConfirmReverse = async () => {
    if (!reversing) return;
    const trimmed = note.trim();
    if (!trimmed) {
      toast.error("Indica el motivo de la reversión.");
      return;
    }
    setSubmitting(true);
    try {
      await reverseReception({ receptionId: reversing._id, note: trimmed });
      toast.success(`Recepción de ${reversing.orderReference} revertida.`);
      setReversing(null);
      setNote("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="grid gap-3">
        {receptions.map((row) => {
          const isReversed = row.reversedAt !== undefined;
          return (
            <Card key={row._id}>
              <CardContent className="grid gap-2 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">
                      {row.orderReference} · {row.supplier}
                    </p>
                    {isReversed && (
                      <Badge variant="outline" className="text-xs">
                        Revertida
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(row.receivedAt)} · {row.receivedBy}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {row.lines
                    .map(
                      (line) => `${line.code} · ${line.name} × ${line.quantity}`,
                    )
                    .join(" · ")}
                </p>
                {row.note && (
                  <p className="text-xs text-muted-foreground">{row.note}</p>
                )}
                {isReversed && (
                  <p className="rounded-md bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
                    Revertida el {formatDateTime(row.reversedAt!)} por{" "}
                    {row.reversedBy ?? "Sistema"}
                    {row.reversalNote ? `: ${row.reversalNote}` : ""}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  {row.deliveryNoteUrl ? (
                    <a
                      href={row.deliveryNoteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-fit items-center gap-1 text-xs text-signal underline"
                    >
                      <FileText className="size-3" />
                      {row.deliveryNote.name}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {row.deliveryNote.name} (ya no está disponible)
                    </span>
                  )}

                  {canManage && !isReversed && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => setReversing(row)}
                    >
                      <RotateCcw className="size-3.5" />
                      Revertir recepción
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={reversing !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) handleClose();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Revertir recepción ({reversing?.orderReference})
            </DialogTitle>
            <DialogDescription>
              Descontará del almacén las unidades recibidas en este albarán y
              volverá a abrir la orden para corregir o devolver el material al
              proveedor.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-2">
            <Label htmlFor="reverse-reception-note">
              Motivo de la reversión (obligatorio)
            </Label>
            <Textarea
              id="reverse-reception-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ej. Material llegado defectuoso (DOA) o cantidad mal anotada en albarán…"
              rows={3}
              maxLength={240}
              disabled={submitting}
            />
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
              variant="destructive"
              className="gap-2"
              onClick={() => void handleConfirmReverse()}
              disabled={submitting}
            >
              <RotateCcw className="size-4" />
              {submitting ? "Revirtiendo..." : "Confirmar reversión"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
