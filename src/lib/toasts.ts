/**
 * Avisos (sonner) frente a diálogos. Los avisos se pintan fuera del diálogo que
 * los abre —el de la ficha de una incidencia, por ejemplo—, y para Radix eso es
 * «fuera»: pulsar el «Deshacer» de un aviso cerraría la ficha que tienes delante.
 * `isToastInteraction` deja distinguir ese caso para que el diálogo siga abierto.
 */

/** Marca que sonner pone en el contenedor de los avisos. */
export const TOASTER_SELECTOR = "[data-sonner-toaster]";

/** ¿La interacción nace dentro de un aviso? */
export function isToastInteraction(event: { target: EventTarget | null }): boolean {
  return (
    event.target instanceof Element &&
    event.target.closest(TOASTER_SELECTOR) !== null
  );
}
