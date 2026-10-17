import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import crons from "../src/convex/crons";

/**
 * Las tareas programadas, leídas como datos —qué se ejecuta, cada cuánto y a qué
 * función apunta— y comprobadas contra las dos cosas que puede tener delante: el
 * objeto que Convex programa de verdad y el árbol de funciones que exporta el
 * backend.
 *
 * Nació al añadir la purga de las ventanas del freno público, y mira lo que esas
 * tareas tienen de silencioso:
 *
 * - Una tarea que apunta a una función que ya no existe **no rompe la
 *   compilación** ni se queja al programarse. En tiempo de ejecución `internal`
 *   es un `anyApi` con proxy —contesta una referencia para cualquier nombre que
 *   le pidas—, así que un nombre viejo se programa tan contento y la tarea se
 *   queda sin hacer nada la noche que le toca. Por eso la función se busca donde
 *   vive de verdad: en los módulos del backend, no en el árbol de referencias.
 * - Una tarea que deja de estar programada tampoco avisa: la tabla que iba a
 *   limpiar sigue creciendo igual, solo que más despacio.
 *
 * El objeto de Convex guarda el nombre y el horario, pero no la función a la que
 * llama —vive en el cierre de cada `crons.*`—, así que la fuente se lee como se
 * leen los documentos: con un patrón sobre su forma, y comparando lo leído con lo
 * que el propio objeto declara. Si el fichero cambia de forma y el lector deja de
 * ver tareas, la comparación de nombres lo dice en vez de quedarse en verde.
 */

/** El fichero de las tareas, tal cual está escrito. */
const FUENTE = readFileSync(
  new URL("../src/convex/crons.ts", import.meta.url),
  "utf8",
);

/** Una tarea tal y como la escribe el fichero. */
interface ScheduledJob {
  /** `daily`, `hourly`, `weekly`… */
  kind: string;
  /** El nombre con el que se programa. */
  name: string;
  /** Su horario, en texto, para poder mirarlo en un fallo. */
  schedule: string;
  /** La ruta de la función dentro de `internal`, sin el `internal.` delante. */
  fn: string;
}

/**
 * Las tareas que declara la fuente: `crons.<tipo>("nombre", { horario }, internal.<ruta>, …)`.
 * Las cinco formas —interval, hourly, daily, weekly y monthly— son las que
 * ofrece Convex, y una nueva tendría que venir a contar su motivo aquí.
 */
const PATTERN =
  /crons\.(interval|hourly|daily|weekly|monthly)\(\s*"([^"]+)",\s*\{([^}]*)\},\s*internal\.([\w.]+),/g;

function scheduledJobs(): ScheduledJob[] {
  const jobs: ScheduledJob[] = [];
  for (const match of FUENTE.matchAll(PATTERN)) {
    jobs.push({
      kind: match[1],
      name: match[2],
      schedule: match[3].replace(/\s+/g, " ").trim(),
      fn: match[4],
    });
  }
  return jobs;
}

/**
 * Los módulos del backend, cargados como los carga el servidor de pruebas: es
 * donde las funciones existen de verdad —el árbol `internal` no sirve para
 * comprobarlo, porque contesta cualquier nombre—.
 */
const MODULOS = import.meta.glob("../src/convex/**/*.ts", {
  eager: true,
}) as Record<string, Record<string, unknown> | undefined>;

describe("las tareas programadas del backend", () => {
  test("lo que dice la fuente es lo que programa Convex, sin tareas escondidas", () => {
    const jobs = scheduledJobs();
    // El lector ve todas: una tarea programada que la fuente esconda —o un
    // fichero que cambie de forma y deje de leerse— deja esta comparación corta.
    expect(jobs.map((job) => job.name).sort()).toEqual(
      Object.keys(crons.crons).sort(),
    );
    for (const job of jobs) {
      expect(job.fn, `${job.name}: sin función`).not.toBe("");
      expect(job.schedule, `${job.name}: sin horario`).not.toBe("");
    }
  });

  test("cada tarea apunta a una función que existe, y no a un nombre viejo", () => {
    for (const job of scheduledJobs()) {
      const [modulo, fn] = job.fn.split(".");
      const what = `${job.name} → internal.${job.fn}`;
      const exports = MODULOS[`../src/convex/${modulo}.ts`];
      expect(exports, `${what}: ese módulo no existe`).toBeDefined();
      expect(typeof exports?.[fn], `${what}: esa función no existe`).toBe(
        "function",
      );
    }
  });

  test("el freno de la consulta pública se purga cada noche", () => {
    // Las ventanas caducadas no se van solas: la tabla es estado efímero y sin
    // una pasada se queda con todos los códigos seguidos alguna vez.
    const job = scheduledJobs().find(
      (candidate) => candidate.fn === "publicLookupLimits.purgeExpired",
    );
    expect(job, "la purga de las ventanas no está programada").toBeDefined();
    if (job === undefined) return;
    expect(job.kind).toBe("daily");
    expect(job.name).toBe("borrar las ventanas caducadas");
  });
});
