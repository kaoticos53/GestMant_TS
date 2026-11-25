import { useState } from "react";
import { useMutation } from "convex/react";
import { ArchiveX, Plus, Trash2, Undo2 } from "lucide-react";
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
import { getErrorMessage } from "@/lib/workshop";
import type { Doc } from "@/convex/_generated/dataModel";
import type { EquipmentDoc } from "../types";

type PartDoc = Doc<"spareParts">;

export function DecommissionEquipmentDialog({
  open,
  onOpenChange,
  item,
  parts,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: EquipmentDoc;
  parts: PartDoc[];
  onDone?: () => void;
}) {
  const decommission = useMutation(api.equipment.decommission);
  const [reason, setReason] = useState("");
  const [salvaged, setSalvaged] = useState<
    Array<{ sparePartId: string; quantity: string }>
  >([]);
  const [busy, setBusy] = useState(false);

  const activeParts = parts.filter((p) => p.lifecycleStatus !== "discontinued");

  const handleAddPart = () => {
    if (activeParts.length === 0) return;
    setSalvaged((prev) => [
      ...prev,
      { sparePartId: activeParts[0]._id, quantity: "1" },
    ]);
  };

  const handleConfirm = async () => {
    const salvagedParts: Array<{
      sparePartId: Id<"spareParts">;
      quantity: number;
    }> = [];
    for (const row of salvaged) {
      const qty = Math.floor(Number(row.quantity));
      if (!Number.isFinite(qty) || qty < 1) {
        toast.error("Cada pieza recuperada debe tener al menos 1 unidad.");
        return;
      }
      salvagedParts.push({
        sparePartId: row.sparePartId as Id<"spareParts">,
        quantity: qty,
      });
    }

    setBusy(true);
    try {
      const res = await decommission({
        id: item._id,
        reason: reason.trim() || undefined,
        salvagedParts: salvagedParts.length > 0 ? salvagedParts : undefined,
      });
      toast.success(
        res.salvagedUnits > 0
          ? `${item.code} dado de baja (${res.salvagedUnits} ud(s) recuperadas al almacén).`
          : `${item.code} dado de baja definitiva.`,
      );
      onOpenChange(false);
      setReason("");
      setSalvaged([]);
      onDone?.();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Dar de baja ({item.code})</DialogTitle>
          <DialogDescription>
            Marca el equipo como retirado definitivamente y registra las piezas
            útiles recuperadas para el almacén.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="decomm-reason">Motivo de la baja (opcional)</Label>
            <Textarea
              id="decomm-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Irreparable según SAT, obsoleto…"
              rows={2}
              maxLength={200}
              disabled={busy}
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Piezas recuperadas (canibalización)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={handleAddPart}
                disabled={busy || activeParts.length === 0}
              >
                <Plus className="size-3.5" />
                Añadir repuesto
              </Button>
            </div>

            {salvaged.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  aria-label={`Repuesto recuperado ${idx + 1}`}
                  value={row.sparePartId}
                  onChange={(e) =>
                    setSalvaged((prev) =>
                      prev.map((entry, i) =>
                        i === idx
                          ? { ...entry, sparePartId: e.target.value }
                          : entry,
                      ),
                    )
                  }
                  disabled={busy}
                  className="flex h-9 flex-1 rounded-md border border-input bg-background px-2 text-xs shadow-xs"
                >
                  {activeParts.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.code} · {p.name}
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  aria-label={`Cantidad recuperada ${idx + 1}`}
                  value={row.quantity}
                  onChange={(e) =>
                    setSalvaged((prev) =>
                      prev.map((entry, i) =>
                        i === idx
                          ? { ...entry, quantity: e.target.value }
                          : entry,
                      ),
                    )
                  }
                  className="h-9 w-20 text-right tabular-nums"
                  disabled={busy}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Quitar repuesto ${idx + 1}`}
                  className="size-9 text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    setSalvaged((prev) => prev.filter((_, i) => i !== idx))
                  }
                  disabled={busy}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="gap-1.5"
            onClick={() => void handleConfirm()}
            disabled={busy}
          >
            <ArchiveX className="size-4" />
            {busy ? "Procesando..." : "Confirmar baja"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReturnLoanDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: EquipmentDoc;
}) {
  const returnLoan = useMutation(api.equipment.returnLoan);
  const [condition, setCondition] = useState<"ok" | "damaged">("ok");
  const [openIncident, setOpenIncident] = useState(true);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      const res = await returnLoan({
        id: item._id,
        condition,
        openIncident: condition === "damaged" ? openIncident : false,
        damageDescription:
          condition === "damaged" ? notes.trim() || undefined : undefined,
        notes: notes.trim() || undefined,
      });
      toast.success(
        res.incidentReference
          ? `Préstamo devuelto e incidencia ${res.incidentReference} abierta.`
          : `Préstamo de ${item.code} devuelto.`,
      );
      onOpenChange(false);
      setCondition("ok");
      setNotes("");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Devolver préstamo ({item.code})</DialogTitle>
          <DialogDescription>
            Registra la recepción del equipo y si vuelve con daños o anomalías.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="loan-condition">Estado en la devolución</Label>
            <select
              id="loan-condition"
              value={condition}
              onChange={(e) =>
                setCondition(e.target.value as "ok" | "damaged")
              }
              disabled={busy}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
            >
              <option value="ok">Correcto / Sin anomalías</option>
              <option value="damaged">Con daños o anomalías</option>
            </select>
          </div>

          {condition === "damaged" && (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={openIncident}
                onChange={(e) => setOpenIncident(e.target.checked)}
                disabled={busy}
                className="size-4 rounded border-input accent-primary"
              />
              Abrir incidencia automáticamente para revisión en taller
            </label>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="loan-notes">
              {condition === "damaged"
                ? "Descripción de los daños"
                : "Notas (opcional)"}
            </Label>
            <Textarea
              id="loan-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                condition === "damaged"
                  ? "Describe qué fallo o daño trae el equipo…"
                  : "Observaciones de la devolución…"
              }
              rows={2}
              maxLength={200}
              disabled={busy}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="gap-1.5"
            onClick={() => void handleConfirm()}
            disabled={busy}
          >
            <Undo2 className="size-4" />
            {busy ? "Registrando..." : "Registrar devolución"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
