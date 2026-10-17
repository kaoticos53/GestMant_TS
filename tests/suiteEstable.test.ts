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
 * La causa no estaba en las pruebas. La primera que levantaba el backend pagaba
 * la carga perezosa de su glob de módulos —transformar y evaluar las decenas de
 * módulos del backend—, y ese trabajo es del arnés. Al correr la suite entera,
 * veintisiete procesos compitiendo por la misma CPU estiraban esa carga por
 * encima del presupuesto de una prueba, y la cobraba la primera que llegaba a
 * tocarla.
 *
 * Así que el arreglo fue mover el coste, no ampliar el plazo: `tests/backend.ts`
 * guarda el glob y el esquema, los carga al evaluarse —antes de las pruebas— y
 * da la única puerta para levantar el backend, `backend()`. Medido, las pruebas
 * pasaron a ser el 3 % del tiempo rastreado y ninguna se acerca a los cinco
 * segundos; antes, la primera de un archivo pesado llegaba a 2,8 s.
 *
 * Y esto vigila las piezas, que se caen por su cuenta: que el glob viva en un
 * solo sitio y se espere; que nadie levante el backend por su cuenta con un
 * `convexTest` propio; que todo el que lo levanta pase por la línea compartida y
 * que no la importe quien no lo levanta —es trabajo regalado, y dentro de jsdom
 * cuesta más—; que la carga no vuelva a engancharse por `setupFiles`, que es la
 * forma de cobrársela a los ciento ocho archivos de prueba de una vez; y que
 * nadie suba el plazo, que taparía el síntoma y volvería a esconder el problema
 * la próxima vez que la máquina vaya cargada.
 *
 * Y vigila el pool, que resultó ser la mitad del asunto: con un proceso por
 * archivo cada proceso transformaba el grafo entero otra vez. Los hilos
 * comparten la caché del servidor y hacen la suite ocho veces más rápida sin
 * tocar una sola prueba.
 */

const RAIZ = fileURLToPath(new URL("..", import.meta.url));

/** El directorio de las pruebas, que es donde vive todo esto. */
const PRUEBAS = fileURLToPath(new URL(".", import.meta.url));

/** Este mismo archivo: lleva los patrones y no se mira a sí mismo. */
const GUARDIAN = fileURLToPath(import.meta.url);

/** La configuración de Vite, que es donde se engancharía un `setupFiles`. */
const CONFIG = join(RAIZ, "vite.config.ts");

/** El archivo que guarda el esquema, el glob y la puerta del backend. */
const COMPARTIDA = "tests/backend.ts";

/** Lo que Vitest da por defecto a una prueba y a un gancho, en milisegundos. */
const PLAZO_POR_DEFECTO = 5000;
const PLAZO_DE_GANCHO_POR_DEFECTO = 10000;

/**
 * El glob de módulos de convex-test, con su `!(*.*.*)` que deja fuera lo que no
 * es una función del backend. Se pide la forma entera y no un `glob` cualquiera:
 * `crons.test.ts` tiene el suyo, y es otra cosa —el inventario de funciones, con
 * `eager: true`, para comprobar que las tareas programadas apuntan a algo real—.
 */
const EL_GLOB_DEL_BACKEND = new RegExp(
  `import\\.meta\\.glob\\(\\s*"\\.\\./src/convex/\\*\\*/!\\(`,
);

/** Levantar el backend por la puerta compartida. Por trozos, como su hermano. */
const LEVANTA_EL_BACKEND = new RegExp(`\\b${"backend"}\\(`);

/** La importación de esa puerta, y solo esa: estática, al principio del archivo. */
const IMPORTA_LA_COMPARTIDA = new RegExp(`from "\\./${"backend"}"`);

/** Levantar Convex a mano, que es lo que ya no hace ningún archivo de prueba. */
const LLAMA_A_CONVEXTEST = new RegExp(`${"convex"}Test\\(`);

/**
 * Menos archivos que esto levantando el backend significaría que el detector se
 * ha roto —un patrón que no encuentra nada deja el guardián pasando en vacío—,
 * así que se exige un suelo: hoy son veintiocho.
 */
const MINIMO_CON_BACKEND = 20;

/** Todos los `.ts`/`.tsx` del directorio, también los de subcarpetas. */
function fuentes(dir: string): string[] {
  const encontradas: string[] = [];
  for (const entrada of readdirSync(dir)) {
    if (entrada === "node_modules") continue;
    const completo = join(dir, entrada);
    if (statSync(completo).isDirectory()) {
      encontradas.push(...fuentes(completo));
    } else if (/\.tsx?$/.test(entrada)) {
      encontradas.push(completo);
    }
  }
  return encontradas.sort();
}

/** Lo que se mira: todo menos este archivo. */
const todas = fuentes(PRUEBAS).filter((file) => file !== GUARDIAN);

/** Solo las pruebas, que es donde se levanta el backend. */
const dePrueba = todas.filter((file) => /\.test\.tsx?$/.test(file));

/** El contenido, tal cual está en el repositorio. */
const texto = (file: string) => readFileSync(file, "utf8");

/** La ruta como se lee en el repositorio, para que un fallo se lea de un vistazo. */
const corto = (file: string) => relative(RAIZ, file).split(sep).join("/");

const config = readFileSync(CONFIG, "utf8");

describe("la suite completa corre de una pieza", () => {
  test("el glob del backend vive en un solo sitio, y se espera", () => {
    const ruta = join(RAIZ, COMPARTIDA);
    expect(existsSync(ruta), `no existe ${COMPARTIDA}`).toBe(true);

    const duenios = todas
      .filter((file) => EL_GLOB_DEL_BACKEND.test(texto(file)))
      .map(corto);
    expect(
      duenios.join("\n"),
      `El glob que levanta el backend solo puede estar en ${COMPARTIDA}:\n` +
        "copiado en otro archivo, su carga vuelve a pagarse dentro de la primera\n" +
        "prueba de ese archivo. Usa `backend()`.",
    ).toBe(COMPARTIDA);

    // Y hay que esperarlo: un glob que se llama sin esperar deja la carga a
    // medias dentro de la primera prueba.
    expect(texto(ruta)).toMatch(/await\s+Promise\.all/);
  });

  test("nadie levanta el backend a mano", () => {
    const sueltos = todas
      .filter((file) => LLAMA_A_CONVEXTEST.test(texto(file)))
      .map(corto);

    expect(
      sueltos.join("\n"),
      `Solo ${COMPARTIDA} llama a \`convexTest\`: es ahí donde vive el esquema y\n` +
        "donde se espera la carga del grafo. Desde una prueba, `backend()`.",
    ).toBe(COMPARTIDA);
  });

  test("todos los que levantan el backend pasan por la línea compartida", () => {
    const conBackend = dePrueba.filter((file) =>
      LEVANTA_EL_BACKEND.test(texto(file)),
    );
    // El control: sin esta línea, un detector roto dejaría esta prueba en verde.
    expect(conBackend.length).toBeGreaterThan(MINIMO_CON_BACKEND);

    const sinCompartida = conBackend
      .filter((file) => !IMPORTA_LA_COMPARTIDA.test(texto(file)))
      .map(corto);

    expect(
      sinCompartida.join("\n"),
      `Estos archivos levantan el backend sin importarlo de ${COMPARTIDA}:\n` +
        'añade al principio: import { backend } from "./backend";',
    ).toBe("");
  });

  test("quien no levanta el backend no paga la carga", () => {
    // La puerta compartida no vive en `setupFiles` justamente por esto: importada
    // de más, cada archivo que no toca Convex —ochenta de ciento ocho— cargaría
    // el backend para nada, y dentro de jsdom además cuesta más.
    const deMas = dePrueba
      .filter((file) => IMPORTA_LA_COMPARTIDA.test(texto(file)))
      .filter((file) => !LEVANTA_EL_BACKEND.test(texto(file)))
      .map(corto);

    expect(
      deMas.join("\n"),
      "Estos archivos importan la puerta compartida sin levantar el backend:\n" +
        'quita el import de "./backend", que solo hace falta para llamar a `backend()`.',
    ).toBe("");
  });

  test("el arnés corre en hilos y no abre un proceso por archivo", () => {
    // Cada proceso del pool tiene su propia caché de transformación, así que con
    // procesos el grafo del backend se transforma otra vez en cada uno y el
    // resultado es un minuto de suite en lugar de siete segundos. Si alguien
    // vuelve a `forks`, que sea por una razón medida y cambie este guardián con
    // la misma medición en la mano.
    const [, pool] = /\bpool\s*:\s*["']([\w-]+)["']/.exec(config) ?? [];

    expect(
      pool,
      "vite.config.ts debe fijar `pool: \"threads\"`: con un proceso por archivo\n" +
        "la suite tarda 61 s y con hilos 7,4 s, porque cada proceso vuelve a\n" +
        "transformar el grafo del backend.",
    ).toBe("threads");
  });

  test("la carga no se le cobra a toda la suite de una vez", () => {
    // `setupFiles` corre en los ciento ocho archivos, así que enganchar ahí la
    // carga es volver al problema por la puerta de atrás: todos pagan por un
    // grafo que solo usan veintiocho.
    expect(
      /setupFiles/.test(config),
      "vite.config.ts no debe enganchar la carga del backend en `setupFiles`:\n" +
        "ahí la pagan los ciento ocho archivos de prueba. La importan solo los que\n" +
        `la usan, desde ${COMPARTIDA}.`,
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
