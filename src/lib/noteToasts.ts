import { toast } from "sonner";

/**
 * Avisos del cuaderno de notas: lo que sale al devolver una nota a una versión
 * anterior, al deshacer esa restauración y al retirar o recuperar una nota.
 *
 * Viven aquí, y no dentro de la vista que los lanza, porque son parte de la
 * regla y no del pintado: el texto se lee tal cual, la duración es la que deja
 * decidir con el aviso delante y el «Deshacer» es el que devuelve la nota sin
 * abrir nada. Y porque los avisos se pulsan con la ficha abierta: quien los
 * enseña tiene que poder probarlos, y esas pruebas se montan sobre estas
 * funciones (ver `tests/noteToasts.test.tsx`).
 */

/** El botón de los avisos que dejan volver atrás. */
export const UNDO_LABEL = "Deshacer";

/**
 * Con deshacer, el aviso dura más: hay que poder leerlo y decidir. Sin él, el
 * de siempre: lo justo para leerlo de pasada.
 */
const UNDO_DURATION_MS = 10_000;

/**
 * Aviso al devolver una nota a una versión anterior de su historial. Si la
 * restauración cambió algo, el aviso deja deshacerla (`onUndo`): deshacer es
 * volver a donde la restauración archivó lo que se acaba de quitar. Si no
 * cambió nada —la nota ya decía eso—, no hay nada que deshacer y el aviso lo
 * dice.
 */
export function noteVersionRestoredToast({ onUndo }: { onUndo?: () => void } = {}): void {
  toast.success("Nota devuelta a la versión anterior", {
    description:
      onUndo === undefined
        ? "La nota ya decía eso: el historial no cambia."
        : "Lo que decía antes queda en el historial. Puedes deshacerlo desde este mismo aviso.",
    duration: UNDO_DURATION_MS,
    ...(onUndo === undefined
      ? {}
      : { action: { label: UNDO_LABEL, onClick: onUndo } }),
  });
}

/**
 * Aviso al deshacer una restauración. Este ya no ofrece deshacer: encadenar
 * vueltas dejaría el cuaderno sin saber dónde está.
 */
export function noteRestoreUndoneToast(): void {
  toast.success("Restauración deshecha", {
    description:
      "La nota vuelve a decir lo que decía antes de volver a la versión anterior.",
  });
}

/** Aviso al retirar una nota del cuaderno, con su deshacer. */
export function noteRemovedToast({ onUndo }: { onUndo: () => void }): void {
  toast.success("Nota retirada del cuaderno", {
    description:
      "Puedes deshacerlo ahora o recuperarla desde la ficha de la incidencia.",
    duration: UNDO_DURATION_MS,
    action: { label: UNDO_LABEL, onClick: onUndo },
  });
}

/** Aviso al devolver al cuaderno una nota retirada (o al recuperarla a mano). */
export function noteRestoredToast(): void {
  toast.success("Nota recuperada en el cuaderno");
}
