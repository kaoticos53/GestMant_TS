import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * La suite entera tiene que correr entera, no solo archivo por archivo.
 *
 * Correr la suite completa dejaba media docena de pruebas en «Test timed out in
 * 5000ms», y el que fallaba cambiaba de una corrida a otra: un día `seed`, otro
 * `compras`, otro `repuestos`, `profiles` o `maquinasPermisos`. Siempre era la
 * misma clase de prueba —**la primera de su archivo**— y ninguna era lenta: cada
 * archivo, en solitario, tarda menos de lo que dura un parpadeo.
 *
 * La causa no estaba en las pruebas. La primera que llama a `convexTest` paga la
 * carga perezosa de `import.meta.glob("../src/convex/**")` —transformar y evaluar
 * las decenas de módulos del backend—, y ese trabajo es del arnés. Al correr la
 * suite entera, veintisiete procesos compitiendo por la misma CPU estiraban esa
 * carga por encima del presupuesto de una prueba, y la cobraba la primera que
 * llegaba a tocarla.
 *
 * Así que el arreglo fue mover el coste, no ampliar el plazo: el grafo se carga
 * en un archivo de preparación, antes de que empiecen las pruebas. Medido, las
 * pruebas pasaron a ser el 3 % del tiempo rastreado y ninguna se acerca a los
 * cinco segundos; antes, la primera de un archivo pesado llegaba a 2,8 s.
 *
 * Y esto vigila que el arreglo no se deshaga: que la preparación siga puesta,
 * que siga cargando el grafo y que el plazo no se haya tocado. Subirlo taparía
 * el síntoma —la prueba seguiría cargando módulos en su tiempo— y volvería a
 * esconder el problema la próxima vez que la máquina vaya cargada.
 */

const RAIZ = fileURLToPath(new URL("..", import.meta.url));

/** La configuración de Vite, que es donde vive el bloque de pruebas. */
const CONFIG = join(RAIZ, "vite.config.ts");

/** El archivo que carga el grafo del backend antes de las pruebas. */
const PREPARACION = "tests/setup/precalentarModulos.ts";

/** Lo que Vitest da por defecto a una prueba y a un gancho, en milisegundos. */
const PLAZO_POR_DEFECTO = 5000;
const PLAZO_DE_GANCHO_POR_DEFECTO = 10000;

const config = readFileSync(CONFIG, "utf8");

describe("la suite completa corre de una pieza", () => {
  test("el arnés carga el grafo de Convex antes de las pruebas", () => {
    // Sin esta preparación, la primera prueba de cada archivo vuelve a pagar la
    // carga de los módulos del backend dentro de su propio plazo.
    const preparaciones = /setupFiles\s*:\s*\[([^\]]*)\]/.exec(config)?.[1];
    expect(preparaciones, "vite.config.ts no declara setupFiles").toBeDefined();
    expect(preparaciones).toContain(PREPARACION);
  });

  test("esa preparación carga de verdad el grafo del backend", () => {
    const ruta = join(RAIZ, PREPARACION);
    expect(existsSync(ruta), `no existe ${PREPARACION}`).toBe(true);

    const contenido = readFileSync(ruta, "utf8");
    // El mismo glob que usan las pruebas: si cambia allí y no aquí, la
    // preparación cargaría otra cosa —o nada— y el plazo volvería a pagarse solo.
    expect(contenido).toMatch(/import\.meta\.glob\(\s*"[^"]*src\/convex\//);
    // Y hay que esperarlo: un glob que no se llama no carga nada.
    expect(contenido).toMatch(/Promise\.all\(/);
    expect(contenido).toMatch(/await\s+Promise\.all/);
  });

  test("el plazo de las pruebas no se ha subido", () => {
    // Un `testTimeout` alto es la forma rápida de que esto se calle sin arreglar
    // nada: la prueba seguiría haciendo el trabajo del arnés y solo se tardaría
    // más en saberlo. Si de verdad hace falta más tiempo, la causa está en otro
    // sitio —mira el comentario de `tests/setup/precalentarModulos.ts`—.
    const plazos = [
      ...config.matchAll(/\b(testTimeout|hookTimeout)\s*:\s*(\d[\d_]*)/g),
    ].map(([, clave, valor]) => ({
      clave,
      ms: Number(valor.replaceAll("_", "")),
      tope:
        clave === "testTimeout"
          ? PLAZO_POR_DEFECTO
          : PLAZO_DE_GANCHO_POR_DEFECTO,
    }));

    const subidos = plazos.filter(({ ms, tope }) => ms > tope);
    expect(subidos, "el plazo no se sube: se arregla lo que lo agota").toEqual(
      [],
    );
  });
});
