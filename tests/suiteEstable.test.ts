import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
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
 * Así que el arreglo fue mover el coste, no ampliar el plazo: el grafo lo carga
 * `tests/precalentarModulos.ts`, y lo importan los archivos que levantan el
 * backend. Medido, las pruebas pasaron a ser el 3 % del tiempo rastreado y
 * ninguna se acerca a los cinco segundos; antes, la primera de un archivo pesado
 * llegaba a 2,8 s.
 *
 * Y esto vigila las piezas del arreglo, que son cuatro y se caen por su cuenta:
 * que la preparación siga cargando el grafo; que la importen **todos** los
 * archivos que levantan el backend; que no la importe quien no lo levanta —es
 * trabajo regalado, y dentro de jsdom cuesta más—; y que no vuelva a
 * engancharse por `setupFiles`, que es la forma de cobrarle la carga a los
 * ciento ocho archivos de prueba de una vez. El plazo, por último, no se toca:
 * subirlo taparía el síntoma y volvería a esconder el problema la próxima vez
 * que la máquina vaya cargada.
 */

const RAIZ = fileURLToPath(new URL("..", import.meta.url));

/** El directorio de las pruebas, que es donde vive todo esto. */
const PRUEBAS = fileURLToPath(new URL(".", import.meta.url));

/** Este mismo archivo: lleva los patrones y no se mira a sí mismo. */
const GUARDIAN = fileURLToPath(import.meta.url);

/** La configuración de Vite, que es donde se engancharía un `setupFiles`. */
const CONFIG = join(RAIZ, "vite.config.ts");

/** El archivo que carga el grafo del backend antes de las pruebas. */
const PREPARACION = "tests/precalentarModulos.ts";

/** Lo que Vitest da por defecto a una prueba y a un gancho, en milisegundos. */
const PLAZO_POR_DEFECTO = 5000;
const PLAZO_DE_GANCHO_POR_DEFECTO = 10000;

/** Quien levanta el backend en memoria. Por trozos, como en su guardián hermano. */
const LEVANTA_EL_BACKEND = new RegExp(`${"convexTest"}\\(`);

/** La importación que se cobra el grafo antes de las pruebas. */
const IMPORTA_LA_PREPARACION = new RegExp(
  `["']\\./${"precalentar"}[A-Za-z]*["']`,
);

/**
 * Menos archivos que esto levantando el backend significaría que el detector se
 * ha roto —un patrón que no encuentra nada deja el guardián pasando en vacío—,
 * así que se exige un suelo: hoy son veintiocho.
 */
const MINIMO_CON_BACKEND = 20;

/** Todas las pruebas del directorio, también las que vivan en subcarpetas. */
function pruebas(dir: string): string[] {
  const encontradas: string[] = [];
  for (const entrada of readdirSync(dir)) {
    if (entrada === "node_modules") continue;
    const completo = join(dir, entrada);
    if (statSync(completo).isDirectory()) {
      encontradas.push(...pruebas(completo));
    } else if (/\.test\.tsx?$/.test(entrada)) {
      encontradas.push(completo);
    }
  }
  return encontradas.sort();
}

/** Las pruebas que se miran: todas menos este archivo. */
const todas = pruebas(PRUEBAS).filter((file) => file !== GUARDIAN);

/** El contenido de una prueba, tal cual está en el repositorio. */
const texto = (file: string) => readFileSync(file, "utf8");

/** El nombre corto, para que un fallo se lea de un vistazo. */
const corto = (file: string) => relative(PRUEBAS, file).split(sep).join("/");

const config = readFileSync(CONFIG, "utf8");

describe("la suite completa corre de una pieza", () => {
  test("la preparación carga de verdad el grafo del backend", () => {
    const ruta = join(RAIZ, PREPARACION);
    expect(existsSync(ruta), `no existe ${PREPARACION}`).toBe(true);

    const contenido = readFileSync(ruta, "utf8");
    // El mismo glob que usan las pruebas: si cambia allí y no aquí, la
    // preparación no cargaría nada y el plazo volvería a pagarse solo.
    expect(contenido).toMatch(/import\.meta\.glob\(\s*"[^"]*src\/convex\//);
    // Y hay que esperarlo: un glob que no se llama no carga nada, y uno que se
    // llama sin esperar deja la carga a medias dentro de la primera prueba.
    expect(contenido).toMatch(/await\s+Promise\.all/);
  });

  test("todos los archivos que levantan el backend la importan", () => {
    const conBackend = todas.filter((file) =>
      LEVANTA_EL_BACKEND.test(texto(file)),
    );
    // El control: sin esta línea, un detector roto dejaría esta prueba en verde.
    expect(conBackend.length).toBeGreaterThan(MINIMO_CON_BACKEND);

    const sinPreparar = conBackend
      .filter((file) => !IMPORTA_LA_PREPARACION.test(texto(file)))
      .map(corto);

    expect(
      sinPreparar.join("\n"),
      `Estos archivos levantan el backend y no importan ${PREPARACION}:\n` +
        `su primera prueba pagará la carga del grafo dentro de su propio plazo,\n` +
        `que es lo que hacía fallar la suite entera según qué máquina.\n` +
        `Añade al principio: import "./precalentarModulos";`,
    ).toBe("");
  });

  test("quien no levanta el backend no paga la carga", () => {
    // La preparación no vive en `setupFiles` justamente por esto: importada de
    // más, cada archivo que no toca Convex —ochenta de ciento ocho— cargaría el
    // backend para nada, y dentro de jsdom además cuesta más.
    const deMas = todas
      .filter((file) => IMPORTA_LA_PREPARACION.test(texto(file)))
      .filter((file) => !LEVANTA_EL_BACKEND.test(texto(file)))
      .map(corto);

    expect(
      deMas.join("\n"),
      "Estos archivos importan la preparación sin levantar el backend: quita el\n" +
        `import de ${PREPARACION}, que solo hace falta donde hay \`convexTest\`.`,
    ).toBe("");
  });

  test("la carga no se le cobra a toda la suite de una vez", () => {
    // `setupFiles` corre en los ciento ocho archivos, así que enganchar ahí la
    // preparación es volver al problema por la puerta de atrás: todos pagan por
    // un grafo que solo usan veintiocho.
    expect(
      /setupFiles/.test(config),
      "vite.config.ts no debe enganchar la carga del backend en `setupFiles`:\n" +
        `ahí la pagan los ciento ocho archivos de prueba. La importan solo los que\n` +
        `la usan, desde ${PREPARACION}.`,
    ).toBe(false);
  });

  test("el plazo de las pruebas no se ha subido", () => {
    // Un `testTimeout` alto es la forma rápida de que esto se calle sin arreglar
    // nada: la prueba seguiría haciendo el trabajo del arnés y solo se tardaría
    // más en saberlo.
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
