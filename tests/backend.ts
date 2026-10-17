import { convexTest } from "convex-test";
import schema from "../src/convex/schema";

/**
 * El backend de pruebas, en una sola línea: el esquema y sus módulos.
 *
 * Levantar Convex era copiar dos cosas en cada archivo de prueba —el glob de los
 * módulos y el esquema—, y ese glob además se cargaba perezosamente en la primera
 * prueba que lo tocaba: media docena de archivos fallaban por «Test timed out in
 * 5000ms» al correr la suite entera, y siempre el primero de cada archivo, porque
 * ese primero pagaba —dentro de su propio plazo— transformar y evaluar las decenas
 * de módulos del backend. Ese trabajo es del arnés, no de la prueba.
 *
 * Así que las dos piezas viven aquí, una sola vez:
 *
 * - **el glob**, que se carga y se espera al evaluar este archivo. Quien lo importa
 *   paga la carga al importarlo, antes de sus pruebas, y su primer test encuentra
 *   el grafo puesto y conserva su tiempo entero. No se toca ningún plazo.
 * - **el esquema**, que es lo único que hace falta para levantar el taller.
 *
 * Y `backend()` es la puerta: `const t = backend();` y a escribir la prueba. El
 * glob no se copia en ningún otro archivo —tampoco su carga: quien no toca Convex
 * no la paga, ni dentro de jsdom, donde cargar el backend cuesta más y no sirve
 * para nada—. Que siga siendo un solo sitio, que lo importen todos los que
 * levantan el backend y que no lo importe quien no lo levanta lo vigila
 * `tests/suiteEstable.test.ts`.
 */
const modulos = import.meta.glob("../src/convex/**/!(*.*.*)*.*s");

await Promise.all(Object.values(modulos).map((cargar) => cargar()));

/** El taller entero, listo para levantar en una prueba. */
export function backend() {
  return convexTest(schema, modulos);
}
