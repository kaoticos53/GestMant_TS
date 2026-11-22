/**
 * Punto de ruptura para probar la recuperación de una restauración cortada.
 *
 * La suite lo rellena con una tabla para que la inserción real falle ahí, como
 * si el backend hubiera caído entre el vaciado y el último lote. En producción
 * se queda en `null` y no hace nada: no es una tabla ni se expone al cliente.
 */
export const backupFaults: {
  failOnTable: string | null;
  /** Corta la acción sin dejar que recupere, como si el backend hubiera muerto. */
  simulateCrash: boolean;
} = {
  failOnTable: null,
  simulateCrash: false,
};
