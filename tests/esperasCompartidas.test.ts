import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * Guardián de las esperas de los tests: una sola forma de dejar que la pantalla
 * termine, y ninguna que dependa de que pase un rato.
 *
 * Cada prueba de jsdom se había escrito su propio `settle` con
 * `setTimeout(resolve, 20 | 30 | 50)`. Dieciocho copias del mismo plazo son
 * dieciocho formas de que la suite dependa de la carga: en una máquina llena el
 * plazo se queda corto y el fallo sale como un test que agota su tiempo —o como
 * un clic contra un botón que aún no existe—, y en una vacía se pierde tiempo en
 * cada paso. El helper de `tests/settle.ts` hace lo que hace falta —darle vueltas
 * al bucle de eventos— sin apostar por una duración.
 *
 * Esto no juzga lo que un test espera: si necesita que algo esté delante, la
 * forma es esperar a esa condición (`vi.waitFor`). Lo que vigila es que nadie
 * vuelva a resolverlo con un plazo ni se traiga su propia copia del helper.
 *
 * Y vigila la misma apuesta hecha al revés: **medir** el reloj para deducir un
 * hecho. `expect(Date.now() - fila.createdAt).toBeLessThan(1000)` no pregunta si
 * el vale es nuevo, pregunta si la máquina llegó hasta ahí en menos de un
 * segundo —y en una máquina cargada la respuesta es que no, con el mismo fallo
 * que si el vale fuera viejo—. Un test que necesita saber si algo es nuevo se
 * toma un instante antes y compara con él: eso no depende de lo que tarde nadie.
 *
 * Se lee el código como texto, como `finalesDeLinea.test.ts`: aquí no hay nada
 * que ejecutar, se busca la firma del fallo. Los patrones se montan por trozos
 * para que este archivo no se encuentre a sí mismo.
 */

const DIR = fileURLToPath(new URL(".", import.meta.url));

/** Este mismo archivo, que no se mira: lleva los patrones y sus controles. */
const GUARDIAN = fileURLToPath(import.meta.url);

/** Todas las pruebas del directorio, también las que viven en subcarpetas. */
function pruebas(dir: string): string[] {
  const encontradas: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const completo = join(dir, entrada);
    if (completo === GUARDIAN) continue;
    if (statSync(completo).isDirectory()) {
      encontradas.push(...pruebas(completo));
    } else if (/\.test\.tsx?$/.test(entrada)) {
      encontradas.push(completo);
    }
  }
  return encontradas.sort();
}

/** Una copia local del helper: «async function settle», escrito por partes. */
const COPIA_LOCAL = new RegExp(`async function ${"settle"}\\(`);

/** La espera fija: un temporizador con un plazo dentro de una promesa. */
const ESPERA_FIJA = new RegExp(
  `new Promise\\(\\(resolve\\) => setTimeout\\(resolve, \\s*\\d`,
);

/**
 * La medida del reloj dentro de una aserción: `expect(Date.now() - …)`.
 *
 * Se pide el reloj como sujeto —justo después del paréntesis— y no en cualquier
 * parte de la línea: comparar dos fechas de los propios datos (`expect(fila.at)
 * .toBeLessThan(Date.now() - DAY)`) no apuesta por una duración y se deja pasar.
 */
const MEDIR_EL_RELOJ = new RegExp(`expect\\(\\s*${"Date.now"}\\(\\)\\s*-`);

describe("las esperas de los tests", () => {
  test("el detector ve una copia y un plazo cuando los hay", () => {
    // Control positivo: sin esto, un patrón roto dejaría el guardián pasando en
    // vacío, que es el modo de fallo que no se ve.
    expect(COPIA_LOCAL.test(`async function ${"settle"}() {`)).toBe(true);
    expect(
      ESPERA_FIJA.test(
        `await new Promise((resolve) => ${`setTimeout`}(resolve, 30));`,
      ),
    ).toBe(true);
    // Y no se lleva por delante el helper: sus vueltas no llevan plazo.
    expect(ESPERA_FIJA.test(`setTimeout(resolve, ${`turn`})`)).toBe(false);

    // El otro detector, con su control positivo y su frontera: mide el reloj
    // quien lo pide como sujeto, no quien compara una fecha de los datos.
    expect(
      MEDIR_EL_RELOJ.test(
        `expect(${"Date.now"}() - fila.createdAt).toBeLessThan(1000);`,
      ),
    ).toBe(true);
    expect(
      MEDIR_EL_RELOJ.test(
        `expect(fila.createdAt).toBeLessThan(${"Date.now"}() - DAY);`,
      ),
    ).toBe(false);
  });

  test("ninguna prueba se define su propio settle", () => {
    const copias = pruebas(DIR)
      .filter((file) => COPIA_LOCAL.test(readFileSync(file, "utf8")))
      .map((file) => relative(DIR, file));

    expect(
      copias.join("\n"),
      "Una prueba ha vuelto a definir su propio `settle`. El helper vive en\n" +
        '`tests/settle.ts` y se importa: `import { settle } from "./settle";`.\n' +
        "Si lo que hacía falta era esperar a que algo apareciera, la forma es\n" +
        "`vi.waitFor`, no un plazo.",
    ).toBe("");
  });

  test("ninguna prueba mide el reloj para saber si algo es nuevo", () => {
    const medidas = pruebas(DIR)
      .filter((file) => MEDIR_EL_RELOJ.test(readFileSync(file, "utf8")))
      .map((file) => relative(DIR, file));

    expect(
      medidas.join("\n"),
      "Una prueba mide el reloj para deducir un hecho: `expect(Date.now() - …)`\n" +
        "pregunta si la máquina llegó a tiempo, y en una máquina cargada la\n" +
        "respuesta es que no. Toma el instante antes (`const antes = Date.now()`)\n" +
        "y compara con él: eso no depende de lo que tarde nadie.",
    ).toBe("");
  });

  test("ninguna prueba espera un número de milisegundos", () => {
    const plazos = pruebas(DIR)
      .filter((file) => ESPERA_FIJA.test(readFileSync(file, "utf8")))
      .map((file) => relative(DIR, file));

    expect(
      plazos.join("\n"),
      "Una prueba vuelve a esperar un rato fijo. Un plazo no es un hecho: en una\n" +
        "máquina cargada se queda corto. Usa `settle` de `tests/settle.ts` para\n" +
        "vaciar lo pendiente, o `vi.waitFor` para esperar a una condición.",
    ).toBe("");
  });
});
