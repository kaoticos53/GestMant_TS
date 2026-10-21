import { toast } from "sonner";

/** Botón accesible de deshacer */
export const ARCHIVE_UNDO_LABEL = "Deshacer";

/**
 * Tiempo de decisión para deshacer un archivado (5 segundos de gracia).
 */
export const ARCHIVE_UNDO_DURATION_MS = 5000;

export interface ArchiveToastOptions {
  reference: string;
  noun?: string;
  onUndo: () => void | Promise<void>;
}

/**
 * Notificación Toast de éxito al archivar una incidencia o petición de repuesto.
 * Ofrece un botón directo `[Deshacer]` durante 5 segundos para revertir la acción
 * sin tener que navegar a la sección de Archivo.
 */
export function archiveWithUndoToast({
  reference,
  noun = "registro",
  onUndo,
}: ArchiveToastOptions): void {
  toast.success(`${reference} al archivo`, {
    description: `Puedes recuperar este ${noun} desde la pestaña Archivo o deshacer ahora.`,
    duration: ARCHIVE_UNDO_DURATION_MS,
    action: {
      label: ARCHIVE_UNDO_LABEL,
      onClick: () => {
        void onUndo();
      },
    },
  });
}

/**
 * Notificación Toast de confirmación tras deshacer con éxito el archivado.
 */
export function unarchiveSuccessToast({
  reference,
}: {
  reference: string;
}): void {
  toast.success(`${reference} recuperada del archivo`, {
    description: "Vuelve a estar disponible en su cola de trabajo habitual.",
  });
}
