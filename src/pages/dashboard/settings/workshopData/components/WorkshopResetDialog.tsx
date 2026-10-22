import { Trash2 } from "lucide-react";
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
import type { WorkshopResetDialogProps } from "../types";

export function WorkshopResetDialog({
  open,
  phrase,
  canVaciar,
  resetting,
  confirmWord,
  onPhraseChange,
  onClose,
  onConfirmReset,
}: WorkshopResetDialogProps) {
  if (!open) return null;

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vaciar el taller</DialogTitle>
          <DialogDescription>
            Se borran <strong>todos</strong> los datos del trabajo: repuestos,
            equipos, incidencias, peticiones, compras, mantenimiento,
            manuales, mensajes y avisos. Las cuentas del taller, sus roles y
            los ajustes de fondo se conservan. Esta acción no se puede
            deshacer.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="vaciar-confirm" className="text-xs">
            {`Escribe ${confirmWord} para confirmar`}
          </Label>
          <Input
            id="vaciar-confirm"
            value={phrase}
            autoComplete="off"
            placeholder={confirmWord}
            onChange={(event) => onPhraseChange(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="gap-2"
            disabled={!canVaciar || resetting}
            onClick={onConfirmReset}
          >
            <Trash2 className="size-4" />
            {resetting ? "Vaciando..." : "Vaciar el taller"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
