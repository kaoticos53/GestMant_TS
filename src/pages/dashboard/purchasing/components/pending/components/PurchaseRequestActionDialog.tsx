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
import { api } from "@/convex/_generated/api";
import { getErrorMessage } from "@/lib/workshop";
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import type { PurchaseActionTarget } from "../types";

export interface PurchaseRequestActionDialogProps {
  target: PurchaseActionTarget | null;
  onClose: () => void;
  onSuccess?: () => void;
}

/** Texto con el que arranca el campo según la acción elegida. */
function initialText({ request, action }: PurchaseActionTarget): string {
  if (action === "supplier") return request.supplier;
  if (action === "note") return request.notes ?? "";
  return "";
}

/**
 * Diálogo modal singleton elevado para modificar proveedor, nota o retirar
 * una petición de compra de la cola.
 *
 * El cuerpo se remonta con `key` (petición + acción): así el campo arranca con
 * el valor que toca sin sincronizarlo desde un efecto.
 */
export function PurchaseRequestActionDialog(
  props: PurchaseRequestActionDialogProps,
) {
  const { target } = props;
  if (!target) return null;
  return (
    <PurchaseRequestActionDialogBody
      key={`${target.request._id}:${target.action}`}
      {...props}
      target={target}
    />
  );
}

function PurchaseRequestActionDialogBody({
  target,
  onClose,
  onSuccess,
}: PurchaseRequestActionDialogProps & { target: PurchaseActionTarget }) {
  const setSupplier = useMutation(api.purchasing.setSupplier);
  const setNote = useMutation(api.purchasing.setNote);
  const cancelar = useMutation(api.purchasing.cancelPurchaseRequest);

  const [texto, setTexto] = useState(() => initialText(target));
  const [guardando, setGuardando] = useState(false);

  const { request, action } = target;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGuardando(true);
    try {
      if (action === "supplier") {
        await setSupplier({ id: request._id, supplier: texto });
        toast.success(`${request.reference}: proveedor ${texto.trim()}`);
      } else if (action === "note") {
        await setNote({ id: request._id, notes: texto });
        toast.success(
          texto.trim()
            ? `${request.reference}: nota guardada`
            : `${request.reference}: nota borrada`,
        );
      } else {
        await cancelar({ id: request._id, note: texto });
        toast.success(`${request.reference} retirada de la compra`);
      }
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setGuardando(false);
    }
  };

  const isSubmitDisabled = guardando || (action !== "note" && !texto.trim());

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {action === "supplier"
              ? `Proveedor de ${request.reference}`
              : action === "note"
                ? `Nota de ${request.reference}`
                : `Retirar ${request.reference}`}
          </DialogTitle>
          <DialogDescription>
            {action === "supplier"
              ? "Con este nombre se agrupa la compra: es la clave de la orden."
              : action === "note"
                ? "Queda en la ficha de la compra y viaja al artículo de la orden."
                : "Se retira de la compra. Lo que esté ya en una orden se quita desde la orden."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`campo-${request._id}`}>
              {action === "supplier"
                ? "Proveedor"
                : action === "note"
                  ? "Nota"
                  : "Motivo"}
            </Label>
            {action === "supplier" ? (
              <Input
                id={`campo-${request._id}`}
                value={texto}
                onChange={(event) => setTexto(event.target.value)}
                autoFocus
              />
            ) : (
              <Textarea
                id={`campo-${request._id}`}
                value={texto}
                onChange={(event) => setTexto(event.target.value)}
                rows={3}
                autoFocus
              />
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={guardando}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitDisabled}>
              {action === "cancel" ? "Retirar" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
