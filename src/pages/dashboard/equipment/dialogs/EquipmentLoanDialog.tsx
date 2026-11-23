import { useState, type FormEvent } from "react";
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
import { getErrorMessage, equipmentLabel } from "@/lib/workshop";
import type { EquipmentDoc } from "../types";

interface EquipmentLoanDialogProps {
  item: EquipmentDoc;
  onClose: () => void;
}

export function EquipmentLoanDialog({
  item,
  onClose,
}: EquipmentLoanDialogProps) {
  const loanOut = useMutation(api.equipment.loanOut);
  const [borrowerName, setBorrowerName] = useState("");
  const [location, setLocation] = useState("");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!borrowerName.trim()) {
      toast.error("Indica la persona o departamento receptor.");
      return;
    }
    setSaving(true);
    try {
      const expectedReturnAt = expectedReturnDate
        ? new Date(`${expectedReturnDate}T18:00:00`).getTime()
        : undefined;
      await loanOut({
        id: item._id,
        borrowerName: borrowerName.trim(),
        ...(location.trim() ? { location: location.trim() } : {}),
        ...(expectedReturnAt !== undefined && Number.isFinite(expectedReturnAt)
          ? { expectedReturnAt }
          : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      toast.success(`Préstamo registrado para ${equipmentLabel(item)}.`);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Prestar equipo temporalmente</DialogTitle>
          <DialogDescription>
            {item.code ? `${item.code} · ` : ""}
            {equipmentLabel(item)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="loan-borrower">Persona o departamento *</Label>
            <Input
              id="loan-borrower"
              value={borrowerName}
              onChange={(e) => setBorrowerName(e.target.value)}
              placeholder="Ej. Realización Plató 2"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="loan-location">Ubicación temporal</Label>
            <Input
              id="loan-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ej. Unidad Móvil 1"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="loan-return">Devolución prevista</Label>
            <Input
              id="loan-return"
              type="date"
              value={expectedReturnDate}
              onChange={(e) => setExpectedReturnDate(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="loan-notes">Notas</Label>
            <Input
              id="loan-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Accesorios incluidos, motivo..."
            />
          </div>
          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Registrar préstamo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
