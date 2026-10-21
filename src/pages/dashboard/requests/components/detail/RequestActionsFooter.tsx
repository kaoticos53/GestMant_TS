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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SheetFooter } from "@/components/ui/sheet";
import { canRequestStep, isRequestInMotion } from "@/lib/requestFlow";
import {
  Archive,
  Ban,
  Check,
  CirclePause,
  PackageCheck,
  RotateCcw,
  Trash2,
  Undo2,
  Wrench,
} from "lucide-react";
import type { RequestDoc } from "../../types";

export interface RequestActionsFooterProps {
  canManage: boolean;
  status: RequestDoc["status"];
  reference: string;
  noReference: boolean;
  onClose: () => void;
  onReject?: () => void;
  onApprove?: () => void;
  onAssociate?: () => void;
  onIssue?: () => void;
  onHold?: () => void;
  onResume?: () => void;
  resuming?: boolean;
  onReturn?: () => void;
  onCancel?: () => void;
  archiving: boolean;
  onArchive: () => Promise<void>;
  withdrawing: boolean;
  withdrawOpen: boolean;
  setWithdrawOpen: (open: boolean) => void;
  withdrawReason: string;
  setWithdrawReason: (reason: string) => void;
  onWithdraw: () => Promise<void>;
}

export function RequestActionsFooter({
  canManage,
  status,
  reference,
  noReference,
  onClose,
  onReject,
  onApprove,
  onAssociate,
  onIssue,
  onHold,
  onResume,
  resuming = false,
  onReturn,
  onCancel,
  archiving,
  onArchive,
  withdrawing,
  withdrawOpen,
  setWithdrawOpen,
  withdrawReason,
  setWithdrawReason,
  onWithdraw,
}: RequestActionsFooterProps) {
  return (
    <>
      <SheetFooter className="sticky bottom-0 z-20 border-t border-border/70 bg-background/95 px-4 py-4 backdrop-blur-sm sm:px-6">
        <div className="flex w-full flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cerrar
          </Button>

          {canManage && canRequestStep(status, "reject") && (
            <Button type="button" variant="outline" onClick={onReject}>
              Rechazar
            </Button>
          )}

          {canManage &&
            canRequestStep(status, "approve") &&
            (noReference ? (
              <Button
                type="button"
                className="gap-2"
                onClick={onAssociate}
              >
                <Wrench className="size-4" />
                Asociar repuesto
              </Button>
            ) : (
              <Button
                type="button"
                className="gap-2"
                onClick={onApprove}
              >
                <Check className="size-4" />
                Aprobar
              </Button>
            ))}

          {canManage && canRequestStep(status, "issue") && (
            <Button
              type="button"
              className="gap-2"
              onClick={onIssue}
            >
              <PackageCheck className="size-4" />
              Entregar material
            </Button>
          )}

          {canManage && canRequestStep(status, "hold") && (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={onHold}
            >
              <CirclePause className="size-4" />
              En espera
            </Button>
          )}

          {canManage && canRequestStep(status, "resume") && (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={resuming}
              onClick={onResume}
            >
              <RotateCcw className="size-4" />
              {resuming ? "Reanudando..." : "Reanudar"}
            </Button>
          )}

          {canManage && canRequestStep(status, "returnMaterial") && (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={onReturn}
            >
              <Undo2 className="size-4" />
              Devolver material
            </Button>
          )}

          {canManage && canRequestStep(status, "cancel") && (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={onCancel}
            >
              <Ban className="size-4" />
              Cancelar petición
            </Button>
          )}

          {canManage && !isRequestInMotion(status) && (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={archiving}
              onClick={() => void onArchive()}
            >
              <Archive className="size-4" />
              Archivar
            </Button>
          )}

          {canManage && (
            <Button
              type="button"
              variant="outline"
              className="gap-2 text-destructive hover:text-destructive"
              disabled={withdrawing}
              onClick={() => setWithdrawOpen(true)}
              title="Se guarda unos días en la papelera antes de borrarse de verdad"
            >
              <Trash2 className="size-4" />
              Retirar
            </Button>
          )}
        </div>
      </SheetFooter>

      <AlertDialog
        open={withdrawOpen}
        onOpenChange={(open) => {
          if (!open) {
            setWithdrawOpen(false);
            setWithdrawReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Retirar {reference}?</AlertDialogTitle>
            <AlertDialogDescription>
              Sale de la cola y del archivo: es para la petición pedida por
              error o el duplicado de otra. No se borra ahora: queda en la
              papelera —en el módulo Archivo— el plazo que tenga ajustado el
              taller, y desde ahí se recupera tal y como está, con sus repuestos
              asociados y sus decisiones. No toca el stock ni las compras que ya
              estén pedidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="peticion-retirar-motivo">
              Por qué se retira (opcional)
            </Label>
            <Input
              id="peticion-retirar-motivo"
              value={withdrawReason}
              onChange={(event) => setWithdrawReason(event.target.value)}
              placeholder="Duplicada, pedida por error…"
              maxLength={160}
              disabled={withdrawing}
            />
            <p className="text-xs text-muted-foreground">
              Se apunta en la papelera, para saber de un vistazo por qué está
              ahí.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={withdrawing}>
              Cancelar
            </AlertDialogCancel>
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
    </>
  );
}
