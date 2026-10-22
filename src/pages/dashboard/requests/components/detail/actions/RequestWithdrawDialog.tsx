import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import type { RequestWithdrawDialogProps } from "./types";

export function RequestWithdrawDialog({
  open,
  onOpenChange,
  reference,
  withdrawReason,
  onWithdrawReasonChange,
  withdrawing,
  onWithdraw,
}: RequestWithdrawDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onOpenChange(false);
          onWithdrawReasonChange("");
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Retirar {reference}?</AlertDialogTitle>
          <AlertDialogDescription>
            Sale de la cola y del archivo: es para la petición pedida por error o
            el duplicado de otra. No se borra ahora: queda en la papelera —en el
            módulo Archivo— el plazo que tenga ajustado el taller, y desde ahí se
            recupera tal y como está, con sus repuestos asociados y sus
            decisiones. No toca el stock ni las compras que ya estén pedidas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="peticion-retirar-motivo">
            Por qué se retira (opcional)
          </Label>
          <Input
            id="peticion-retirar-motivo"
            value={withdrawReason}
            onChange={(event) => onWithdrawReasonChange(event.target.value)}
            placeholder="Duplicada, pedida por error…"
            maxLength={160}
            disabled={withdrawing}
          />
          <p className="text-xs text-muted-foreground">
            Se apunta en la papelera, para saber de un vistazo por qué está ahí.
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={withdrawing}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={withdrawing}
            className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(event) => {
              event.preventDefault();
              void onWithdraw();
            }}
          >
            <Trash2 className="size-4" />
            {withdrawing ? "Retirando..." : "Retirar a la papelera"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
