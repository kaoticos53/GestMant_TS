import { act } from "react";

/**
 * Deja que la pantalla termine lo que tiene entre manos, sin esperar un rato fijo.
 *
 * Cada test de jsdom se había escrito su propio `settle` con
 * `await new Promise((resolve) => setTimeout(resolve, 20 | 30 | 50))`, con la
 * idea de que «Radix engancha sus escuchas en un temporizador». Esperar un plazo
 * no es esperar un hecho: en una máquina cargada el plazo se queda corto —y el
 * fallo aparece como un test que agota su tiempo, o como un clic contra un botón
 * que aún no existe—, y en una vacía se pierde tiempo en cada paso. Dieciocho
 * copias del mismo plazo son dieciocho formas de que la suite dependa de la
 * carga.
 *
 * Esto hace lo que hace falta de verdad, y siempre lo mismo:
 *
 * - `act` vacío: React aplica los efectos y las actualizaciones pendientes.
 * - unos turnos de temporizador de 0 ms: deja correr las promesas encadenadas y
 *   los `setTimeout(…, 0)` con los que Radix y los avisos enganchan lo suyo. El
 *   cero no es un plazo que se espere a que pase: es pedirle al bucle de eventos
 *   que dé una vuelta.
 *
 * Lo que **no** hace es comprobar que algo haya aparecido: cuando un test
 * necesita que un elemento esté delante, se espera a esa condición
 * (`vi.waitFor`), no a que pasen milisegundos. Esto solo vacía lo pendiente.
 *
 * `turns` existe para los pocos casos que encadenan varios turnos —un aviso que
 * se sustituye por el siguiente, un diálogo que se cierra mientras se abre
 * otro—: se piden más vueltas, no más tiempo.
 */
export async function settle(turns = 2): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < turns; turn += 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  });
}
