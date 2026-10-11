import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  deployState,
  dockerEngineAction,
  dockerEngineState,
  dockerRestartPlan,
  findConvexWatch,
  findVite,
  healthVerdict,
  holderLabel,
  panelLines,
  parseProcessList,
  portHolders,
  watchPlan,
} from "../scripts/local-dev-lib.mjs";

/**
 * El arranque local (`scripts/local-dev.mjs`) es un script que levanta
 * contenedores, despliega y arranca Vite: no se puede importar en una prueba sin
 * arrancar el taller entero. Por eso lo que se prueba aquí son las dos piezas
 * que sí son puras y que viven en `scripts/local-dev-lib.mjs` —el panel final y
 * el veredicto de la comprobación de salud—, más una pasada de verdad por el CLI
 * con el motor de Docker fuera de juego.
 */

/** El carácter de escape de las secuencias de color del script. */
const ESC = String.fromCharCode(27);

/** Quita los colores de la salida, para poder leerla tal cual. */
const stripAnsi = (text: string) =>
  text.replace(new RegExp(`${ESC}\\[[0-9;]*m`, "g"), "");

const script = fileURLToPath(
  new URL("../scripts/local-dev.mjs", import.meta.url),
);
const root = fileURLToPath(new URL("..", import.meta.url));

/** Los datos que cambian entre arranques; el resto del panel es fijo. */
const panelInput = {
  appUrl: "http://localhost:5173",
  apiUrl: "http://127.0.0.1:3210",
  dashboardUrl: "http://localhost:6791",
  watchLog: "C:\\Users\\kaoti\\AppData\\Local\\Temp\\pulso-taller-convex.log",
  email: "admin@taller.es",
};

const lastLine = (lines: string[]) => lines.at(-1) ?? "";

describe("panel del arranque", () => {
  test("termina siempre en la URL de la app, pase lo que pase", () => {
    const demo = { incidents: 20, requests: 44, parts: 18 };
    const arranques = [
      {},
      { browser: "opened" },
      { browser: "failed" },
      { fresh: true, demo },
      { repaired: true },
      { fresh: true, repaired: true, demo, browser: "failed" },
    ];

    for (const arranque of arranques) {
      const lines = panelLines({ ...panelInput, ...arranque });
      // La última línea es la URL: es lo que se busca al terminar de arrancar.
      expect(lastLine(lines)).toBe(`  Abre la app en ${panelInput.appUrl}`);
      // Y no queda nada detrás, ni siquiera una línea en blanco.
      expect(lines.filter((line) => line.trim() !== "").at(-1)).toBe(
        lastLine(lines),
      );
      expect(lines.slice(-1)).toEqual([lastLine(lines)]);
    }
  });

  test("solo habla del navegador cuando hay algo que decir", () => {
    const conNavegador = panelLines({ ...panelInput, browser: "opened" });
    expect(conNavegador).toContain(
      `  Navegador        abierto en ${panelInput.appUrl}`,
    );

    const sinNavegador = panelLines({ ...panelInput, browser: "off" });
    expect(sinNavegador.some((line) => line.includes("Navegador"))).toBe(false);

    const fallido = panelLines({ ...panelInput, browser: "failed" });
    expect(fallido).toContain(
      "  Navegador        no he podido abrirlo; entra con la URL de abajo",
    );
    expect(lastLine(fallido)).toBe(`  Abre la app en ${panelInput.appUrl}`);
  });

  test("con el observador de otro terminal, no enseña un log que no es el suyo", () => {
    const ajeno = panelLines({ ...panelInput, foreignWatchPid: 54228 });
    expect(ajeno).toContain(
      "  Observador       src/convex → lo dejó otro terminal (pid 54228)",
    );
    // Y la ruta de nuestro log no se cuela por ningún lado.
    expect(ajeno.some((line) => line.includes(panelInput.watchLog))).toBe(
      false,
    );
    expect(lastLine(ajeno)).toBe(`  Abre la app en ${panelInput.appUrl}`);
  });

  test("dice cuándo la app la sirve el Vite de otro terminal", () => {
    const nuestra = panelLines(panelInput);
    expect(nuestra).toContain(`  App              ${panelInput.appUrl}`);
    expect(nuestra.some((line) => line.includes("otro terminal"))).toBe(false);

    const ajena = panelLines({ ...panelInput, foreignAppPid: 1234 });
    expect(ajena).toContain(
      `  App              ${panelInput.appUrl} (la dejó otro terminal, pid 1234)`,
    );
    expect(lastLine(ajena)).toBe(`  Abre la app en ${panelInput.appUrl}`);
  });

  test("cuenta la demo y el arreglo sin perder la URL al final", () => {
    const lines = panelLines({
      ...panelInput,
      fresh: true,
      demo: { incidents: 20, requests: 44, parts: 18 },
    });
    expect(lines).toContain(
      "  Datos de ejemplo 20 incidencias · 44 peticiones · 18 repuestos",
    );
    expect(lines).toContain(
      `  Usuario ${panelInput.email} · la cuenta ya está creada y la demo cargada.`,
    );
    expect(lastLine(lines)).toBe(`  Abre la app en ${panelInput.appUrl}`);
  });
});

/**
 * La lista de procesos, tal y como la devuelve cada sistema. Los datos son los
 * de un taller de verdad en marcha: el node de Adobe, el npm de un
 * `npm run dev`, el Vite suelto y el observador de Convex.
 */
const PROYECTO = "C:\\taller\\pulso-taller";

const listaWindows = JSON.stringify([
  {
    ProcessId: 48084,
    CommandLine:
      '"C:\\Program Files\\Adobe\\node.exe" "C:\\Program Files\\Adobe\\main.js"',
  },
  {
    ProcessId: 57368,
    CommandLine:
      '"C:\\Program Files\\nodejs\\node.exe" "C:\\Program Files\\nodejs/node_modules/npm/bin/npm-cli.js" run dev',
  },
  {
    ProcessId: 62820,
    CommandLine: `"node"   "${PROYECTO}\\node_modules\\.bin\\..\\vite\\bin\\vite.js" `,
  },
  {
    ProcessId: 54228,
    CommandLine: `"C:\\Program Files\\nodejs\\node.exe" ${PROYECTO}\\node_modules\\convex\\bin\\main.js dev`,
  },
]);

/** Lo mismo visto desde Linux: cada línea es «pid comando» de `ps`. */
const listaUnix = [
  "      1 /sbin/init",
  "    421 node /otro/taller/node_modules/convex/bin/main.js dev",
  "    987 node /home/ana/pulso/node_modules/.bin/../convex/bin/main.js dev",
  "   1024 node /home/ana/pulso/node_modules/convex/bin/main.js env list",
  "",
].join("\n");

describe("quién está vigilando `src/convex`", () => {
  test("lee la lista de procesos de los dos sistemas", () => {
    const windows = parseProcessList(listaWindows, { platform: "win32" });
    expect(windows).toHaveLength(4);
    expect(windows.at(-1)).toEqual({
      pid: 54228,
      command: `"C:\\Program Files\\nodejs\\node.exe" ${PROYECTO}\\node_modules\\convex\\bin\\main.js dev`,
    });

    const unix = parseProcessList(listaUnix, { platform: "linux" });
    expect(unix.map((entry) => entry.pid)).toEqual([1, 421, 987, 1024]);
    expect(unix[2].command).toBe(
      "node /home/ana/pulso/node_modules/.bin/../convex/bin/main.js dev",
    );
  });

  test("con un solo proceso, PowerShell manda un objeto y no una lista", () => {
    const uno = JSON.stringify({ ProcessId: 7, CommandLine: "node algo.js" });
    expect(parseProcessList(uno, { platform: "win32" })).toEqual([
      { pid: 7, command: "node algo.js" },
    ]);
  });

  test("una salida que no se entiende no inventa ningún proceso", () => {
    expect(parseProcessList("", { platform: "win32" })).toEqual([]);
    expect(parseProcessList("no es json", { platform: "win32" })).toEqual([]);
    expect(parseProcessList("\n\n", { platform: "linux" })).toEqual([]);
  });

  test("encuentra el observador del taller entre todo lo que hay en marcha", () => {
    const encontrado = findConvexWatch(
      parseProcessList(listaWindows, { platform: "win32" }),
      { projectDir: PROYECTO, platform: "win32" },
    );
    expect(encontrado?.pid).toBe(54228);
  });

  test("reconoce también la forma que deja un `npm run` o un `npx`", () => {
    const shim = `"node" "${PROYECTO}\\node_modules\\.bin\\..\\convex\\bin\\main.js" dev`;
    const procesos = parseProcessList(
      JSON.stringify([{ ProcessId: 99, CommandLine: shim }]),
      { platform: "win32" },
    );
    expect(
      findConvexWatch(procesos, { projectDir: PROYECTO, platform: "win32" })
        ?.pid,
    ).toBe(99);

    // Y con la barra doble que deja el lanzador de npm en Windows de verdad.
    const doble = `"node" "${PROYECTO}\\node_modules\\.bin\\\\..\\convex\\bin\\main.js" dev`;
    const procesos2 = parseProcessList(
      JSON.stringify([{ ProcessId: 98, CommandLine: doble }]),
      { platform: "win32" },
    );
    expect(
      findConvexWatch(procesos2, { projectDir: PROYECTO, platform: "win32" })
        ?.pid,
    ).toBe(98);
  });

  test("la carpeta del proyecto tiene que empezar donde empieza una ruta", () => {
    // `/taller` está dentro de `/otro/taller`: sin la frontera, el proceso del
    // taller vecino pasaría por nuestro y el arranque dejaría de levantar el suyo
    // (o se subiría al Vite de otro).
    const vecino = `node /otro/taller/node_modules/convex/bin/main.js dev`;
    expect(
      findConvexWatch([{ pid: 3, command: vecino }], {
        projectDir: "/taller",
        platform: "linux",
      }),
    ).toBeNull();
    expect(
      findConvexWatch([{ pid: 3, command: vecino }], {
        projectDir: "/otro/taller",
        platform: "linux",
      })?.pid,
    ).toBe(3);
  });

  test("no confunde el observador de otro taller con el nuestro", () => {
    const otro = `node C:\\otro\\taller\\node_modules\\convex\\bin\\main.js dev`;
    const procesos = parseProcessList(
      JSON.stringify([{ ProcessId: 5, CommandLine: otro }]),
      { platform: "win32" },
    );
    expect(
      findConvexWatch(procesos, { projectDir: PROYECTO, platform: "win32" }),
    ).toBeNull();

    // Y en Unix, con dos talleres en marcha, cada uno encuentra el suyo.
    const unix = parseProcessList(listaUnix, { platform: "linux" });
    expect(
      findConvexWatch(unix, {
        projectDir: "/home/ana/pulso",
        platform: "linux",
      })?.pid,
    ).toBe(987);
    expect(
      findConvexWatch(unix, { projectDir: "/otro/taller", platform: "linux" })
        ?.pid,
    ).toBe(421);
  });

  test("una llamada al CLI que no vigila no es un observador", () => {
    // El propio script llama al CLI a cada paso (`env list`, `run`): esos
    // procesos no son observadores, y confundirlos dejaría sin arrancar el
    // nuestro.
    const llamadas = [
      `node ${PROYECTO}\\node_modules\\convex\\bin\\main.js env list`,
      `node ${PROYECTO}\\node_modules\\convex\\bin\\main.js run incidents:list {}`,
    ];
    const procesos = parseProcessList(
      JSON.stringify(
        llamadas.map((CommandLine, index) => ({
          ProcessId: index + 1,
          CommandLine,
        })),
      ),
      { platform: "win32" },
    );
    expect(
      findConvexWatch(procesos, { projectDir: PROYECTO, platform: "win32" }),
    ).toBeNull();
  });

  test("una invocación relativa no se le atribuye a nadie", () => {
    // `node node_modules/convex/bin/main.js dev` no lleva delante la ruta del
    // proyecto: puede ser de cualquier taller, así que se deja en paz.
    const relativa = "node node_modules\\convex\\bin\\main.js dev";
    const procesos = parseProcessList(
      JSON.stringify([{ ProcessId: 3, CommandLine: relativa }]),
      { platform: "win32" },
    );
    expect(
      findConvexWatch(procesos, { projectDir: PROYECTO, platform: "win32" }),
    ).toBeNull();
  });

  test("en Windows la ruta no distingue mayúsculas; en Unix sí", () => {
    const gritando = `node ${PROYECTO.toUpperCase()}\\NODE_MODULES\\CONVEX\\BIN\\MAIN.JS dev`;
    expect(
      findConvexWatch([{ pid: 11, command: gritando }], {
        projectDir: PROYECTO,
        platform: "win32",
      })?.pid,
    ).toBe(11);
    expect(
      findConvexWatch([{ pid: 11, command: gritando }], {
        projectDir: PROYECTO,
        platform: "linux",
      }),
    ).toBeNull();
  });
});

/** Una comprobación de salud como las que devuelve el arranque. */
type CheckResult = {
  id: string;
  label: string;
  healthy: boolean;
  detail: string;
};

const checks = (...list: [string, boolean][]): CheckResult[] =>
  list.map(([id, healthy]) => ({
    id,
    label: id,
    healthy,
    detail: healthy ? "ok" : "no responde",
  }));

/**
 * Qué se hace con el observador que ya está vigilando `src/convex`. La decisión
 * es pura —de quién es, si el entorno ha cambiado y si se ha pedido hacerse cargo
 * del ajeno (`--take-over`)—, así que se prueban todos los casos sin tener un
 * `convex dev` delante.
 */
describe("el plan del observador", () => {
  test("sin observador, se arranca el nuestro", () => {
    expect(watchPlan({ kind: "none" })).toBe("start");
    expect(watchPlan({ kind: "none", restart: true, takeOver: true })).toBe(
      "start",
    );
  });

  test("el nuestro se reutiliza, y se reinicia si el entorno ha cambiado", () => {
    expect(watchPlan({ kind: "own" })).toBe("reuse");
    expect(watchPlan({ kind: "own", restart: true })).toBe("restart");
    // `--take-over` no toca lo que ya es nuestro: no hay nada ajeno que tomar.
    expect(watchPlan({ kind: "own", takeOver: true })).toBe("reuse");
    expect(watchPlan({ kind: "own", restart: true, takeOver: true })).toBe(
      "restart",
    );
  });

  test("el ajeno se reutiliza mientras sirva, y con el entorno cambiado se convive o se toma", () => {
    expect(watchPlan({ kind: "foreign" })).toBe("reuse");
    expect(watchPlan({ kind: "foreign", restart: true })).toBe("alongside");
    expect(watchPlan({ kind: "foreign", takeOver: true })).toBe("take-over");
    expect(watchPlan({ kind: "foreign", restart: true, takeOver: true })).toBe(
      "take-over",
    );
  });
});

describe("veredicto de la comprobación de salud", () => {
  const motorCaido = checks(
    ["containers", false],
    ["api", true],
    ["app", true],
  );

  test("con el motor de Docker caído, el diagnóstico no perdona ni una", () => {
    const { tolerated, failures } = healthVerdict(motorCaido);
    expect([...tolerated]).toEqual([]);
    expect(failures.map((result) => result.id)).toEqual(["containers"]);
  });

  test("el arranque sí perdona no poder *mirar* los contenedores si la API responde", () => {
    const { tolerated, failures } = healthVerdict(motorCaido, {
      tolerateUnmanagedContainers: true,
    });
    expect([...tolerated]).toEqual(["containers"]);
    expect(failures).toEqual([]);
  });

  test("pero no lo perdona si la API tampoco responde", () => {
    const sinApi = checks(["containers", false], ["api", false]);
    const { tolerated, failures } = healthVerdict(sinApi, {
      tolerateUnmanagedContainers: true,
    });
    expect([...tolerated]).toEqual([]);
    expect(failures.map((result) => result.id)).toEqual(["containers", "api"]);
  });

  test("el arranque perdona un despliegue que no entra, pero `--check` no", () => {
    const conDespliegueRoto = checks(
      ["api", true],
      ["app", true],
      ["deploy", false],
    );
    const estricto = healthVerdict(conDespliegueRoto);
    expect([...estricto.tolerated]).toEqual([]);
    expect(estricto.failures.map((result) => result.id)).toEqual(["deploy"]);

    const arranque = healthVerdict(conDespliegueRoto, {
      tolerateDeployErrors: true,
    });
    expect([...arranque.tolerated]).toEqual(["deploy"]);
    expect(arranque.failures).toEqual([]);
  });

  test("pero un despliegue roto no tapa lo que sí deja la app inservible", () => {
    const apagado = checks(["api", true], ["deploy", false], ["app", false]);
    const { tolerated, failures } = healthVerdict(apagado, {
      tolerateDeployErrors: true,
    });
    expect([...tolerated]).toEqual(["deploy"]);
    expect(failures.map((result) => result.id)).toEqual(["app"]);
  });

  test("la manga ancha es solo para los contenedores", () => {
    const conLaAppCaida = checks(
      ["containers", false],
      ["api", true],
      ["app", false],
    );
    const { tolerated, failures } = healthVerdict(conLaAppCaida, {
      tolerateUnmanagedContainers: true,
    });
    expect([...tolerated]).toEqual(["containers"]);
    expect(failures.map((result) => result.id)).toEqual(["app"]);
  });
});

/**
 * Lo que deja `convex dev` en su log, tal y como sale de verdad: el color del
 * CLI, la línea del intento, la marca de terminado y los logs de las funciones
 * de la app por medio.
 */
const verde = `${ESC}[32m✔${ESC}[39m`;
const rojo = `${ESC}[31m✖${ESC}[39m`;
const listo = (hora: string) =>
  `${verde} ${hora} Convex functions ready! (3.75s)`;
const empieza = "- Preparing Convex functions...";
const logDeFuncion =
  "10/10/2026, 23:12:02 [CONVEX Q(incidents:list)] Uncaught ConvexError: Debes iniciar sesión para gestionar incidencias.";

const log = (...lines: string[]) => lines.join("\n");

describe("el último despliegue del observador", () => {
  test("un despliegue que entró, con sus logs de función por debajo", () => {
    const estado = deployState(
      log("", empieza, "", listo("23:11:20"), logDeFuncion),
    );
    expect(estado).toEqual({
      state: "ready",
      at: "23:11:20",
      message: null,
      detail: null,
    });
  });

  test("un esquema que el backend rechaza cuenta con su motivo", () => {
    // Es lo que imprime `convex dev` cuando la validación del esquema falla:
    // la marca del CLI, su mensaje y el error en crudo en la línea siguiente.
    const estado = deployState(
      log(
        empieza,
        "",
        `${rojo} Schema validation failed.`,
        'Document with ID "j57" in table "spareParts" is missing the required field "location".',
      ),
    );
    expect(estado.state).toBe("failed");
    expect(estado.message).toBe("Schema validation failed.");
    expect(estado.detail).toBe(
      'Document with ID "j57" in table "spareParts" is missing the required field "location".',
    );
  });

  test("de los fallos repetidos vale el último: es el que sigue en pie", () => {
    const estado = deployState(
      log(
        empieza,
        `${rojo} Bundling failed`,
        'error: Could not resolve "./nota"',
        empieza,
        `${rojo} Schema validation failed.`,
        "Index by_model already exists.",
      ),
    );
    expect(estado.message).toBe("Schema validation failed.");
    expect(estado.detail).toBe("Index by_model already exists.");
  });

  test("un fallo viejo seguido de un despliegue bueno es un entorno sano", () => {
    const estado = deployState(
      log(
        empieza,
        `${rojo} Schema validation failed.`,
        "Index by_model already exists.",
        empieza,
        listo("09:14:02"),
      ),
    );
    expect(estado.state).toBe("ready");
    expect(estado.at).toBe("09:14:02");
  });

  test("un intento sin desenlace todavía no es un fallo", () => {
    // A medio empujar tampoco se avisa: el desenlace llega en la misma pasada.
    const estado = deployState(
      log(empieza, "Pushing code to your Convex deployment..."),
    );
    expect(estado.state).toBe("pending");
  });

  test("un log sin nada del observador no inventa un fallo", () => {
    for (const texto of [
      "",
      "   ",
      logDeFuncion,
      "(node:1) ExperimentalWarning",
    ]) {
      expect(deployState(texto).state).toBe("unknown");
    }
  });

  test("un log de función con la palabra «error» no es un fallo del observador", () => {
    const estado = deployState(logDeFuncion);
    expect(estado.state).toBe("unknown");
  });

  test("un error larguísimo se recorta para que quepa en una línea", () => {
    const estado = deployState(
      log(empieza, `${rojo} Schema validation failed.`, "x".repeat(400)),
    );
    expect(estado.detail).not.toBeNull();
    expect((estado.detail ?? "").length).toBeLessThanOrEqual(161);
    expect(estado.detail?.endsWith("…")).toBe(true);
  });

  test("de un typecheck roto se enseña el error, no el aviso de cómo saltárselo", () => {
    // Es lo que imprimió `convex dev` de verdad con un `tsc` en rojo: la marca,
    // el mensaje, el aviso de `--typecheck=disable`, el recuento y, después, el
    // primer error, que es lo único que sirve para arreglarlo.
    const estado = deployState(
      log(
        empieza,
        `${rojo} TypeScript typecheck via \`tsc\` failed.`,
        "To ignore failing typecheck, use `--typecheck=disable`.",
        "- Collecting TypeScript errors",
        "",
        `src/convex/spareParts.ts:115:39 - error TS2345: Argument of type '{ purchaseUrl?: string | undefined; }' is not assignable.`,
      ),
    );
    expect(estado.state).toBe("failed");
    expect(estado.message).toBe("TypeScript typecheck via `tsc` failed.");
    expect(estado.detail).toMatch(/spareParts\.ts:115:39 - error TS2345/);
  });

  test("detrás de un fallo no se cuelga un log de función", () => {
    const estado = deployState(
      log(empieza, `${rojo} Schema validation failed.`, logDeFuncion),
    );
    expect(estado.state).toBe("failed");
    expect(estado.detail).toBeNull();
  });
});

/**
 * Quién sirve la app y quién ocupa los puertos: las dos piezas que hacen que el
 * arranque reutilice lo que ya está en marcha en vez de pelearse por los puertos
 * del taller.
 */
describe("quién sirve la app y quién ocupa los puertos", () => {
  const TALLER = "E:\\taller";

  test("reconoce el Vite de este proyecto venga de donde venga", () => {
    // Las tres formas que se ven de verdad: la que lanza el script (ruta
    // absoluta), la del acceso directo de `.bin` y la que deja un `npm run dev`
    // (`.bin\..\vite\bin\vite.js`, con sus barras de Windows).
    const formas = [
      `"C:\\Program Files\\nodejs\\node.exe" ${TALLER}\\node_modules\\vite\\bin\\vite.js`,
      `node ${TALLER}\\node_modules\\.bin\\vite`,
      `"node"   "${TALLER}\\node_modules\\.bin\\..\\vite\\bin\\vite.js" `,
      // La que deja de verdad un lanzador de npm en Windows: con la barra doble.
      `"node"   "${TALLER}\\node_modules\\.bin\\\\..\\vite\\bin\\vite.js" `,
    ];
    for (const command of formas) {
      const procesos = parseProcessList(
        JSON.stringify([{ ProcessId: 7, CommandLine: command }]),
        { platform: "win32" },
      );
      expect(
        findVite(procesos, { projectDir: TALLER, platform: "win32" })?.pid,
      ).toBe(7);
    }

    // Y en Unix, con el enlace de `.bin`.
    const unix = parseProcessList(
      `   900 node /home/ana/pulso/node_modules/.bin/vite\n`,
      { platform: "linux" },
    );
    expect(
      findVite(unix, { projectDir: "/home/ana/pulso", platform: "linux" })?.pid,
    ).toBe(900);
  });

  test("no confunde al Vite de otro taller, ni al observador de Convex", () => {
    const otro = `node /otro/taller/node_modules/vite/bin/vite.js`;
    const procesos = parseProcessList(
      JSON.stringify([{ ProcessId: 4, CommandLine: otro }]),
      { platform: "win32" },
    );
    expect(
      findVite(procesos, { projectDir: "/taller", platform: "win32" }),
    ).toBeNull();

    const observador = parseProcessList(
      `    421 node ${TALLER.replace(/\\/g, "/")}/node_modules/convex/bin/main.js dev`,
      { platform: "linux" },
    );
    expect(
      findVite(observador, {
        projectDir: TALLER.replace(/\\/g, "/"),
        platform: "linux",
      }),
    ).toBeNull();
  });

  test("en Windows el Vite no distingue mayúsculas; en Unix sí", () => {
    const gritando = `node ${TALLER.toUpperCase()}\\NODE_MODULES\\VITE\\BIN\\VITE.JS`;
    expect(
      findVite([{ pid: 11, command: gritando }], {
        projectDir: TALLER,
        platform: "win32",
      })?.pid,
    ).toBe(11);
    expect(
      findVite([{ pid: 11, command: gritando }], {
        projectDir: TALLER,
        platform: "linux",
      }),
    ).toBeNull();
  });

  test("saca quién publica cada puerto, sin repetirlo por IPv4 e IPv6", () => {
    // Lo que devuelve `docker ps` de verdad: el mismo puerto sale dos veces por
    // contenedor (la dirección de IPv4 y la de IPv6) y los del backend en rango.
    const list = [
      "convex-backend-1\t0.0.0.0:3210-3211->3210-3211/tcp, [::]:3210-3211->3210-3211/tcp\tconvex\tE:\\taller\\docker\\convex",
      "convex-dashboard-1\t0.0.0.0:6791->6791/tcp, [::]:6791->6791/tcp\tconvex\tE:\\taller\\docker\\convex",
      "otro-1\t127.0.0.1:8080->80/tcp\totro\tE:\\otro",
      "suelto\t3210/tcp\t\t",
    ].join("\n");

    const holders = portHolders(list, [3210, 3211, 6791, 5173]);
    expect(holders.map((holder) => `${holder.name}:${holder.port}`)).toEqual([
      "convex-backend-1:3210",
      "convex-backend-1:3211",
      "convex-dashboard-1:6791",
    ]);
    expect(holders[0].project).toBe("convex");
    expect(holders[0].dir).toBe("E:\\taller\\docker\\convex");
  });

  test("sin puerto publicado ni etiquetas de Compose, no inventa nada", () => {
    // Un contenedor con `docker run -p 3210:3210` no lleva etiquetas, y el que
    // solo expone el puerto (sin publicarlo) no ocupa nada en el anfitrión.
    const list = [
      "suelto\t3210/tcp\t\t",
      "mio\t0.0.0.0:3210->3210/tcp\t\t",
    ].join("\n");
    const holders = portHolders(list, [3210]);
    expect(holders).toEqual([
      { port: 3210, name: "mio", project: null, dir: null },
    ]);
  });

  test("al contenedor que ocupa el puerto lo nombra con lo que se sabe de él", () => {
    // Lo que se le dice al usuario es lo que necesita para actuar: el nombre
    // para pararlo, el proyecto y la carpeta para saber si es suyo o de otro
    // taller. Un contenedor suelto (sin etiquetas) no inventa proyecto ni ruta.
    expect(
      holderLabel({
        name: "convex-backend-1",
        project: "convex",
        dir: "E:\\taller\\docker\\convex",
      }),
    ).toBe(
      "el contenedor convex-backend-1 del proyecto «convex», arrancado desde E:\\taller\\docker\\convex",
    );
    expect(holderLabel({ name: "mio", project: null, dir: null })).toBe(
      "el contenedor mio",
    );
    expect(holderLabel({ name: "medio", project: "otro", dir: null })).toBe(
      "el contenedor medio del proyecto «otro»",
    );
  });
});

/**
 * Lo que el arranque hace con el motor de Docker. La decisión es pura —qué le
 * pasa, qué toca hacer y con qué se reinicia en cada sistema—, así que se puede
 * probar sin tener Docker delante.
 */
describe("el motor de Docker", () => {
  test("distingue un motor colgado de uno parado y de uno que no está", () => {
    expect(dockerEngineState({ cliOk: true, serverOk: true })).toBe("ok");
    // Falla en seguida: no está en marcha.
    expect(dockerEngineState({ cliOk: true, serverOk: false })).toBe("down");
    // Se queda colgado hasta agotar su tiempo: está ahí pero no contesta.
    expect(
      dockerEngineState({ cliOk: true, serverOk: false, timedOut: true }),
    ).toBe("hung");
    expect(dockerEngineState({ cliOk: false, serverOk: false })).toBe(
      "missing",
    );
  });

  test("distingue qué motor hay que tocar y cuál no", () => {
    expect(
      dockerEngineAction({
        state: "ok",
        backendHealthy: false,
        canRestart: true,
      }),
    ).toBe("ok");
    // Con el backend sirviendo, reiniciar el motor pararía lo único que funciona.
    expect(
      dockerEngineAction({
        state: "hung",
        backendHealthy: true,
        canRestart: true,
      }),
    ).toBe("keep");
    expect(
      dockerEngineAction({
        state: "down",
        backendHealthy: true,
        canRestart: true,
      }),
    ).toBe("keep");
    expect(
      dockerEngineAction({
        state: "hung",
        backendHealthy: false,
        canRestart: true,
      }),
    ).toBe("restart");
    // Sin forma de reiniciarlo desde aquí (Linux sin Docker Desktop) se le dice al
    // usuario lo que tiene que hacer, en vez de intentarlo y fallar.
    expect(
      dockerEngineAction({
        state: "down",
        backendHealthy: false,
        canRestart: false,
      }),
    ).toBe("manual");
  });

  test("con el CLI de Docker Desktop, reiniciarlo o arrancarlo según el estado", () => {
    const colgado = dockerRestartPlan({
      platform: "win32",
      state: "hung",
      desktopCli: true,
    });
    expect(colgado.steps).toEqual([
      {
        label: "reiniciar Docker Desktop (`docker desktop restart`)",
        command: "docker",
        args: ["desktop", "restart"],
      },
    ]);

    // Uno que no está en marcha no se reinicia: se arranca.
    const parado = dockerRestartPlan({
      platform: "linux",
      state: "down",
      desktopCli: true,
    });
    expect(parado.steps).toEqual([
      {
        label: "arrancar Docker Desktop (`docker desktop start`)",
        command: "docker",
        args: ["desktop", "start"],
      },
    ]);
  });

  test("sin ese CLI se abre la aplicación, cerrándola antes si está colgada", () => {
    const exe = "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe";
    const colgado = dockerRestartPlan({
      platform: "win32",
      state: "hung",
      appPath: exe,
    });
    expect(colgado.steps.map((step) => step.label)).toEqual([
      "cerrar Docker Desktop",
      "abrir Docker Desktop",
    ]);
    expect(colgado.steps[0].command).toBe("taskkill");
    expect(colgado.steps[1].command).toBe(exe);

    const parado = dockerRestartPlan({
      platform: "win32",
      state: "down",
      appPath: exe,
    });
    expect(parado.steps.map((step) => step.label)).toEqual([
      "abrir Docker Desktop",
    ]);

    const mac = dockerRestartPlan({ platform: "darwin", state: "down" });
    expect(mac.steps).toEqual([
      { label: "abrir Docker", command: "open", args: ["-a", "Docker"] },
    ]);
    // Uno colgado no lo arregla `open`: habría que cerrarlo, y eso es cosa suya.
    expect(
      dockerRestartPlan({ platform: "darwin", state: "hung" }).steps,
    ).toEqual([]);
  });

  test("cuando no hay forma de hacerlo desde aquí, dice qué hacer a mano", () => {
    // En Linux es el demonio del sistema: hace falta ser administrador.
    const linux = dockerRestartPlan({ platform: "linux", state: "hung" });
    expect(linux.steps).toEqual([]);
    expect(linux.manual).toMatch(/sudo systemctl restart docker/);

    // Y en Windows sin encontrar la aplicación, tampoco se inventa otra orden.
    const win = dockerRestartPlan({ platform: "win32", state: "hung" });
    expect(win.steps).toEqual([]);
    expect(win.manual).toMatch(/menú de inicio/);
  });
});

describe("el diagnóstico del script, de verdad", () => {
  test("sigue estricto cuando el motor de Docker no responde", () => {
    // Se lanza el script sin Docker en el PATH: el motor no responde, que es
    // el caso que se quiere fijar (y el único que el arranque perdona).
    const sinDocker = mkdtempSync(join(tmpdir(), "pulso-sin-docker-"));
    try {
      const env: NodeJS.ProcessEnv = { ...process.env };
      for (const key of Object.keys(env)) {
        if (/^path$/i.test(key)) delete env[key];
      }
      env.PATH = sinDocker;

      const child = spawnSync(process.execPath, [script, "--check"], {
        cwd: root,
        encoding: "utf8",
        timeout: 90000,
        // Sin terminal: ningún aviso de la CLI puede quedarse esperando.
        input: "",
        env,
      });
      const salida = stripAnsi(`${child.stdout ?? ""}${child.stderr ?? ""}`);

      // La comprobación de los contenedores sale en rojo con su motivo...
      expect(salida).toMatch(/✗ Contenedores del backend en marcha/);
      expect(salida).toContain("no encuentro el contenedor backend");
      // ...y el diagnóstico termina con error, sin perdonarla.
      expect(child.status).not.toBeNull();
      expect(child.status).toBeGreaterThan(0);
    } finally {
      rmSync(sinDocker, { recursive: true, force: true });
    }
  }, 120000);
});
