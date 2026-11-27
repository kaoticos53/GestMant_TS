import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { FileText, RotateCcw, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { DataTableToolbar } from "@/components/DataTableToolbar";
import { TablePagination } from "@/components/TablePagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { formatDateTime, getErrorMessage } from "@/lib/workshop";
import type { ReceptionDoc } from "../types";

export interface MovementsSectionProps {
  receptions: ReceptionDoc[];
  canManage?: boolean;
}

type MovementStatusFilter = "all" | "active" | "reversed";

/** Movimientos de recepción: cada entrada de un proveedor con su albarán. */
export function MovementsSection({
  receptions,
  canManage = false,
}: MovementsSectionProps) {
  const reverseReception = useMutation(api.purchasing.reverseReception);
  const removeDeliveryNote = useMutation(
    api.purchasing.removeReceptionDeliveryNote,
  );
  const [reversing, setReversing] = useState<ReceptionDoc | null>(null);
  const [removingNote, setRemovingNote] = useState<ReceptionDoc | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MovementStatusFilter>("all");

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return receptions.filter((row) => {
      const isReversed = row.reversedAt !== undefined;
      if (statusFilter === "active" && isReversed) return false;
      if (statusFilter === "reversed" && !isReversed) return false;
      if (!needle) return true;
      return (
        row.orderReference.toLowerCase().includes(needle) ||
        row.supplier.toLowerCase().includes(needle) ||
        row.receivedBy.toLowerCase().includes(needle) ||
        (row.deliveryNote?.name ?? "").toLowerCase().includes(needle) ||
        (row.note ?? "").toLowerCase().includes(needle) ||
        row.lines.some(
          (line) =>
            line.code.toLowerCase().includes(needle) ||
            line.name.toLowerCase().includes(needle),
        )
      );
    });
  }, [receptions, search, statusFilter]);

  const paging = useTablePagination({
    total: filtered.length,
    rowsFit: 12,
    resetKey: `${search}|${statusFilter}`,
  });
  const visible = filtered.slice(paging.from - 1, paging.to);
  const hasActiveFilters = search.trim() !== "" || statusFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

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
          Cada entrada de un proveedor deja aquí su movimiento (con su albarán
          si se adjuntó), y es lo que mete el stock en el almacén.
        </p>
      </div>
    );
  }

  const handleClose = () => {
    if (submitting) return;
    setReversing(null);
    setNote("");
  };

  const handleConfirmRemoveNote = async () => {
    if (!removingNote) return;
    try {
      await removeDeliveryNote({ receptionId: removingNote._id });
      toast.success("Albarán eliminado de la recepción.");
      setRemovingNote(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
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
        <DataTableToolbar
          className="rounded-xl border border-border/70 bg-card shadow-sm"
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar por orden, proveedor, artículo, albarán o usuario…"
          searchAriaLabel="Buscar movimientos"
          filters={
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as MovementStatusFilter)
              }
            >
              <SelectTrigger
                className="w-full sm:w-44"
                aria-label="Filtrar por estado"
              >
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="reversed">Revertidos</SelectItem>
              </SelectContent>
            </Select>
          }
          hasActiveFilters={hasActiveFilters}
          onResetFilters={clearFilters}
        />

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center shadow-sm">
            <p className="text-sm font-medium">
              Ningún movimiento coincide con los filtros actuales
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={clearFilters}
            >
              Limpiar filtros
            </Button>
          </div>
        ) : (
          visible.map((row) => {
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
                        (line) =>
                          `${line.code} · ${line.name} × ${line.quantity}`,
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
                    {row.deliveryNote ? (
                      row.deliveryNoteUrl ? (
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
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Sin albarán adjunto
                      </span>
                    )}

                    {canManage && (row.deliveryNote !== undefined || !isReversed) && (
                      <div className="flex flex-wrap items-center gap-2">
                        {row.deliveryNote && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => setRemovingNote(row)}
                            aria-label={`Eliminar albarán ${row.deliveryNote.name}`}
                          >
                            <Trash2 className="size-3.5" />
                            Eliminar adjunto
                          </Button>
                        )}
                        {!isReversed && (
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
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}

        {filtered.length > 0 && (
          <TablePagination
            className="rounded-xl border border-border/70 bg-card shadow-sm"
            paging={paging}
            singular="movimiento"
            plural="movimientos"
            detail={
              hasActiveFilters
                ? `${receptions.length} en total`
                : undefined
            }
          />
        )}
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

      {removingNote?.deliveryNote && (
        <DestructiveConfirmDialog
          onClose={() => setRemovingNote(null)}
          title={`¿Eliminar el albarán «${removingNote.deliveryNote.name}»?`}
          description={`Se quitará el archivo adjunto de esta recepción de ${removingNote.orderReference}. La recepción y el stock registrado se mantienen intactos.`}
          confirmLabel="Eliminar adjunto"
          busyLabel="Eliminando..."
          confirmIcon={<Trash2 className="size-4" />}
          onConfirm={handleConfirmRemoveNote}
        />
      )}
    </>
  );
}
