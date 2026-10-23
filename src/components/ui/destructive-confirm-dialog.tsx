import { useState, type MouseEvent, type ReactNode } from "react";
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

export interface DestructiveConfirmDialogProps {
  /** Si el diálogo está abierto. Quien lo monta condicionalmente puede omitirlo. */
  open?: boolean;
  /** Cierra el diálogo: cancelar, Escape o clic fuera. Se ignora mientras hay una operación en curso. */
  onClose: () => void;
  title: ReactNode;
  description: ReactNode;
  /** Texto del botón destructivo en reposo («Borrar equipo»). */
  confirmLabel: string;
  /** Texto del botón mientras la operación está en curso («Borrando...»). */
  busyLabel?: string;
  /** Texto del botón de cancelar. Por defecto «Cancelar». */
  cancelLabel?: string;
  /** Icono opcional delante del texto del botón destructivo. */
  confirmIcon?: ReactNode;
  /**
   * Operación en curso que lleva el padre (cuando la mutación vive fuera del
   * diálogo). Se suma al estado que el propio diálogo lleva si `onConfirm`
   * devuelve una promesa.
   */
  busy?: boolean;
  /** Oculta el botón destructivo: el diálogo solo informa de por qué no se puede. */
  hideConfirm?: boolean;
  /**
   * Ejecuta la acción. El diálogo **no se cierra solo**: quien confirma decide
   * cuándo cerrar (normalmente en su `finally`), igual que hacían los diálogos
   * que esta pieza sustituye. Si devuelve una promesa, el botón queda bloqueado
   * hasta que se resuelva, y un segundo clic no lanza la acción dos veces.
   * La acción debe tratar sus propios errores.
   */
  onConfirm: () => void | Promise<unknown>;
}

/**
 * Confirmación de una acción destructiva, con el aspecto y el comportamiento
 * accesible que comparten todos los borrados y retiradas de la aplicación.
 *
 * Es una carcasa: no sabe qué se borra ni cómo. El texto, el icono y la acción
 * los pone cada módulo; aquí viven lo que tiene que ser igual en todos —el
 * color del botón, bloquear el cierre y los botones mientras se guarda, y no
 * dejar que Radix cierre el diálogo antes de que acabe la operación.
 */
export function DestructiveConfirmDialog({
  open = true,
  onClose,
  title,
  description,
  confirmLabel,
  busyLabel = "Borrando...",
  cancelLabel = "Cancelar",
  confirmIcon,
  busy = false,
  hideConfirm = false,
  onConfirm,
}: DestructiveConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const isBusy = busy || pending;

  const handleConfirm = async (event: MouseEvent<HTMLButtonElement>) => {
    // Radix cierra el diálogo al pulsar la acción; aquí cierra quien confirma.
    event.preventDefault();
    if (isBusy) return;
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !isBusy) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isBusy}>{cancelLabel}</AlertDialogCancel>
          {!hideConfirm && (
            <AlertDialogAction
              disabled={isBusy}
              className="gap-2 bg-destructive text-white hover:bg-destructive/90"
              onClick={handleConfirm}
            >
              {confirmIcon}
              {isBusy ? busyLabel : confirmLabel}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
