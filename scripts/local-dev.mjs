// Un único comando para tener Pulso Taller en marcha en local. Se llama igual
// desde `npm start`, desde `npm run local` y desde los lanzadores de doble clic
// (`start.cmd` en Windows, `start.sh` en Linux y macOS): la lógica vive aquí una
// sola vez y lo demás son puertas a este mismo sitio.
//
//   npm start                levanta contenedores + arranca Vite y el observador de Convex;
//                            lo que ya está en marcha se reutiliza en vez de competir por
//                            los puertos (los contenedores del proyecto, el Vite que ya
//                            sirve la app y el `convex dev` que ya vigila, aunque los haya
//                            abierto otro terminal)
//   npm run local            lo mismo que `npm start` (se mantiene por costumbre)
//   npm run local -- --fresh  igual, pero antes borra la base de datos y carga la demo
//   npm run local -- --repair solo arregla lo que esté roto, sin tocar la base de datos
//   npm run local:check     solo comprueba que el entorno está sano
//   npm run local:stop      para el Vite que arrancó este script
//   npm run local -- --take-over  cierra el observador ajeno y arranca el suyo, en vez
//                            de convivir con los dos (útil tras `--fresh`: el ajeno se
//                            queda con la clave vieja y ya no puede desplegar)
//   --no-open               no abre el navegador al terminar (por defecto se abre solo)
//
// Lo último que imprime es la URL de la app: al terminar, lo que se busca es
// dónde entrar, así que es lo último que se lee —y el navegador se abre en esa
// misma URL, que es el paso siguiente.
//
// Es idempotente a propósito: se puede lanzar tantas veces como haga falta. En
// particular, **nunca rota las claves JWT** si ya existen, porque eso cerraría
// todas las sesiones abiertas. Solo las genera cuando faltan (deployment nuevo).
//
// `--repair` es el camino contrario a `--fresh`: arregla un entorno a medias
// —clave de administrador caducada, deployment sin variables de auth, funciones
// sin desplegar, contenedores o Vite parados— y **nunca borra datos**; nada de
// lo que hace aquí toca la base de datos.
//
// Usa solo módulos de Node para que funcione igual en Git Bash, Linux y macOS,
// y llama a los CLI por su ruta en `node_modules` (no por `npx`) para no
// depender de cómo se resuelvan los ejecutables en cada shell.

import { spawn, spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// El panel final, el veredicto de salud y la lectura de la lista de procesos
// viven aparte: son lo único de este script que se puede probar sin arrancar
// nada (ver `tests/localDev.test.ts`).
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
} from "./local-dev-lib.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const COMPOSE_FILE = "docker/convex/docker-compose.yml";
const COMPOSE = ["compose", "-f", COMPOSE_FILE];

const APP_PORT = 5173;
const BACKEND_URL = "http://127.0.0.1:3210";
const ACTIONS_URL = "http://127.0.0.1:3211";
const DASHBOARD_URL = "http://localhost:6791";

/** URL con la que el navegador habla con la app. */
const APP_URL = `http://localhost:${APP_PORT}`;

/** Claves que deben existir en `.env.local` (lo leen Vite y el CLI de Convex). */
const REQUIRED_LOCAL_KEYS = [
  "CONVEX_SELF_HOSTED_URL",
  "CONVEX_SELF_HOSTED_ADMIN_KEY",
  "VITE_CONVEX_URL",
  "CONVEX_SITE_URL",
  "SITE_URL",
];

/** Claves que deben existir en el deployment (viven en el backend, no en el repo). */
const REQUIRED_DEPLOYMENT_KEYS = [
  "SITE_URL",
  "VLY_CONVEX_AUTH_ISSUER",
  "JWT_PRIVATE_KEY",
  "JWKS",
];

/**
 * Techos de tiempo para todo lo que habla con Docker. Un motor colgado deja la
 * orden esperando indefinidamente —sin imprimir nada—, y un arranque que se
 * queda mudo delante es lo peor que puede pasar: por eso ninguna llamada a
 * Docker sale sin su techo, ni siquiera las de solo leer.
 */
const DOCKER_PROBE_MS = 20000;
const DOCKER_EXEC_MS = 60000;
const DOCKER_UP_MS = 600000;
const DOCKER_DOWN_MS = 120000;

/** Cuánto se espera a que un motor recién despertado vuelva a responder. */
const DOCKER_WAKE_MS = 180000;

/** Dónde vive Docker Desktop, para poder abrirlo sin depender de su CLI. */ const DOCKER_DESKTOP_EXE =
  "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe";
const DOCKER_DESKTOP_APP = "/Applications/Docker.app";

/** Los puertos que publica el backend (3210 y 3211) y el panel: no se comparten. */
const BACKEND_PORT = 3210;
const BACKEND_PORTS = [BACKEND_PORT, 3211, 6791];

/** La carpeta desde la que se levantan los contenedores, para reconocerlos. */
const COMPOSE_DIR = join(root, dirname(COMPOSE_FILE));

/**
 * Cómo se pide la lista de contenedores: nombre, puertos publicados y de dónde
 * salen (proyecto y carpeta de Compose). Con eso se sabe quién ocupa un puerto,
 * que es lo que convierte «port is already allocated» en algo accionable.
 */
const CONTAINERS_FORMAT =
  '{{.Names}}\t{{.Ports}}\t{{.Label "com.docker.compose.project"}}\t{{.Label "com.docker.compose.project.working_dir"}}';

const VITE_LOG = join(tmpdir(), "pulso-taller-vite.log");
const VITE_PID = join(tmpdir(), "pulso-taller-vite.pid");

// El observador de funciones (`convex dev`) corre en segundo plano igual que
// Vite —detached, con su log y su pid en un archivo temporal— para poder
// reutilizarlo entre arranques y pararlo con `--stop`.
const WATCH_LOG = join(tmpdir(), "pulso-taller-convex.log");
const WATCH_PID = join(tmpdir(), "pulso-taller-convex.pid");

/** Cuánto se espera al primer despliegue del observador antes de rendirse. */
const WATCH_TIMEOUT_MS = 180000;

/**
 * Cuánto se espera a que un observador ajeno se vaya tras pedírselo. Es un
 * cierre ordenado —`convex dev` cierra su conexión con el backend antes de
 * irse—: si con este margen no se ha ido, se insiste a la fuerza.
 */
const FOREIGN_STOP_MS = 8000;

/** Nombre visible de la cuenta de administrador que crea `--fresh`. */
const ADMIN_NAME = "Administración del taller";

/**
 * Las opciones de la línea de órdenes. Se leen aquí arriba, y no en el despacho
 * del final, porque no solo las usa ese despacho: la reparación también tiene que
 * saber si se le ha pedido hacerse cargo del observador ajeno (`--take-over`).
 */
const flags = new Set(process.argv.slice(2));

/**
 * `--take-over`: cuando el observador que vigila lo abrió otro terminal, se
 * cierra y se arranca el nuestro, en vez de convivir con los dos. Sin el flag
 * ese proceso no se toca (no es nuestro): se avisa y se arranca el nuestro.
 */
const takeOver = flags.has("--take-over");

const isWindows = process.platform === "win32";

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

const c = {
  bold: (s) => `\u001b[1m${s}\u001b[0m`,
  dim: (s) => `\u001b[2m${s}\u001b[0m`,
  green: (s) => `\u001b[32m${s}\u001b[0m`,
  red: (s) => `\u001b[31m${s}\u001b[0m`,
  yellow: (s) => `\u001b[33m${s}\u001b[0m`,
};

let stepNumber = 0;
const step = (text) => console.log(`\n${c.bold(`${++stepNumber}. ${text}`)}`);
const info = (text) => console.log(`   ${text}`);
const ok = (text) => console.log(`   ${c.green("✓")} ${text}`);
const warn = (text) => console.log(`   ${c.yellow("!")} ${text}`);

/** Corta el proceso con un mensaje claro en vez de con una traza de Node. */
function abort(text, hint) {
  console.error(`\n${c.red("✗")} ${text}`);
  if (hint) console.error(c.dim(hint));
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Se ejecuta siempre sin shell: así `process.execPath` (que en Windows suele
// vivir en una ruta con espacios) y los `.exe` de Docker se resuelven solos. El
// único caso que necesita shell es el `npm` de Windows, que es un `.cmd`.

/**
 * Ejecuta un comando heredando la salida (para que el usuario vea el progreso).
 * Con `timeoutMs` el proceso se corta al agotarlo: quien llama puede mirar
 * `error.code === "ETIMEDOUT"` para distinguir «tardó demasiado» de «falló».
 */
function run(cmd, args, { timeoutMs } = {}) {
  return spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    timeout: timeoutMs,
  });
}

/** Ejecuta un comando y captura su salida. */
function capture(cmd, args, { timeoutMs } = {}) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    timeout: timeoutMs,
  });
  return {
    status: result.status ?? 1,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
    timedOut: result.error?.code === "ETIMEDOUT",
  };
}

/** Las llamadas a Docker, siempre con techo: es lo que delata un motor colgado. */
const dockerRun = (args, timeoutMs = DOCKER_UP_MS) =>
  run("docker", args, { timeoutMs });
const dockerCapture = (args, timeoutMs = DOCKER_PROBE_MS) =>
  capture("docker", args, { timeoutMs });

/** La primera línea con algo, para enseñar el motivo que da Docker. */
function firstLine(text) {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line !== "") ?? ""
  );
}

/** `npm install` sin depender de cómo se llame al ejecutable en cada sistema. */
function runNpm(args) {
  // Cuando el script se lanza con `npm run local`, npm nos da la ruta de su
  // propio CLI: es la forma más fiable de invocarlo (también en Windows).
  const execpath = process.env.npm_execpath;
  if (execpath && existsSync(execpath)) {
    return run(process.execPath, [execpath, ...args]);
  }
  const result = spawnSync(isWindows ? "npm.cmd" : "npm", args, {
    cwd: root,
    stdio: "inherit",
    shell: isWindows,
  });
  return result;
}

/**
 * El CLI de Convex se invoca con el Node del proyecto (ver generate-keys.mjs).
 *
 * Igual que con Docker, ninguna orden sale sin techo de tiempo: cuando el
 * backend no contesta, el CLI no falla, se queda **reintentando en bucle**
 * (WebSocket cerrado, espera creciente, otra vez) y sin techo el arranque se
 * queda mudo delante para siempre. Es el silencio más fácil de provocar de todo
 * el proyecto: basta con que los contenedores estén parados.
 */
const convexCli = join(root, "node_modules", "convex", "bin", "main.js");

/** Consultas y listados: si el backend está vivo, son cosa de segundos. */
const CLI_MS = 30000;

/** Órdenes con trabajo detrás (la semilla de la demo inserta mucho). */
const CLI_SLOW_MS = 120000;

const convexCliCapture = (args, timeoutMs = CLI_MS) =>
  capture(process.execPath, [convexCli, ...args], { timeoutMs });
const convex = (args, timeoutMs = CLI_MS) =>
  run(process.execPath, [convexCli, ...args], { timeoutMs });

/** `fetch` con techo de tiempo: devuelve el código HTTP o null si no responde. */
async function httpStatus(url, timeoutMs = 2500) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "manual",
    });
    return response.status;
  } catch {
    return null;
  }
}

/** Espera acotada: reintenta `probe` hasta que devuelva algo o se agote el tiempo. */
async function waitFor(probe, { timeoutMs = 120000, intervalMs = 1000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value) return value;
    if (Date.now() >= deadline) return null;
    await sleep(intervalMs);
  }
}

/** ¿Hay algo escuchando en ese puerto de loopback? */
function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    const done = (inUse) => {
      socket.destroy();
      resolve(inUse);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.setTimeout(1500, () => done(false));
  });
}

/** Mata el proceso indicado y sus hijos: en Windows el árbol, en Unix el grupo. */
function killTree(pid) {
  if (isWindows) {
    capture("taskkill", ["/PID", String(pid), "/T", "/F"]);
    return;
  }
  // Los procesos que lanza este script van `detached`, así que encabezan su
  // propio grupo: matar el grupo se lleva también a sus hijos.
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    // Ya no estaba en marcha: no hay nada que parar.
  }
}

/** El pid que dejó un arranque anterior, si el archivo guarda un número válido. */
function savedPid(file) {
  if (!existsSync(file)) return null;
  const pid = Number(readFileSync(file, "utf8").trim());
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

/** ¿Ese proceso sigue vivo? Un pid de otro usuario da EPERM en Windows. */
function isRunning(pid) {
  if (pid === null) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

/**
 * Los procesos que hay ahora mismo, con su pid y su línea de comandos. Se
 * pregunta al sistema de la forma más barata que traiga la línea entera: el
 * JSON de PowerShell en Windows y `ps` en Unix (en modo ancho, que una línea
 * cortada escondería justo la ruta que se busca).
 */
function listProcesses() {
  const result = isWindows
    ? capture("powershell", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress",
      ])
    : capture("ps", ["-A", "-ww", "-o", "pid=,command="]);
  if (result.status !== 0) return [];
  return parseProcessList(result.stdout, { platform: process.platform });
}

/**
 * La lista de procesos, pedida una sola vez por arranque: cuesta un proceso
 * entero y se pregunta varias veces (el observador, el Vite, la comprobación de
 * salud y el panel).
 */
let processList;
function processesOnce() {
  if (processList === undefined) processList = listProcesses();
  return processList;
}

/**
 * Un `convex dev` de este proyecto que no arrancó este script: el de otro
 * terminal, el de un agente, el que dejó un lanzador a medias. El CLI de Convex
 * no deja ningún archivo que diga «estoy vigilando», así que hay que mirarlo en
 * la lista de procesos; el porqué de la forma en que se reconoce está en
 * `findConvexWatch` (`local-dev-lib.mjs`).
 */
function foreignWatchProcess() {
  return findConvexWatch(processesOnce(), {
    projectDir: root,
    platform: process.platform,
  });
}

/**
 * Un Vite de este proyecto que no arrancó este script: el de otro terminal, el
 * de `npm run dev`, el que dejó un lanzador. Sirve para saber si el que contesta
 * en el 5173 es nuestro (y decirlo) y para no tomar por «la app» a cualquier
 * servidor que ocupe el puerto.
 */
function foreignViteProcess() {
  return findVite(processesOnce(), {
    projectDir: root,
    platform: process.platform,
  });
}

/**
 * Qué está vigilando `src/convex` ahora mismo: el observador que arrancó este
 * script (con su pid guardado), el que dejó otro terminal (sin pid file, pero
 * vivo) o nada.
 */
function watcherState() {
  const pid = savedPid(WATCH_PID);
  if (isRunning(pid) && isNodeProcess(pid)) return { kind: "own", pid };
  const foreign = foreignWatchProcess();
  if (foreign) return { kind: "foreign", pid: foreign.pid };
  return { kind: "none", pid: null };
}

/**
 * Quién sirve la app: el Vite que arrancó este script (con su pid guardado), el
 * que dejó otro terminal (sin pid file, pero vivo) o ninguno. Faltaba: el
 * arranque reutilizaba cualquier cosa que contestara en el 5173 sin saber qué
 * era ni poder decirlo, y `local:stop` no paraba nada de lo que no fuera suyo.
 */
function viteState() {
  const pid = savedPid(VITE_PID);
  if (isRunning(pid) && isNodeProcess(pid)) return { kind: "own", pid };
  const foreign = foreignViteProcess();
  if (foreign) return { kind: "foreign", pid: foreign.pid };
  return { kind: "none", pid: null };
}

/** Qué dice el log del observador de su último despliegue (ver `deployState`). */
function deployStateOf() {
  return deployState(logTail(WATCH_LOG));
}

/** El fallo de un despliegue en una línea: lo que dijo el CLI y su error. */
function deployFailureText(state) {
  return [state.message, state.detail].filter(Boolean).join(" — ");
}

/**
 * Cuenta lo que el log del observador dice de su último despliegue, cuando se
 * reutiliza uno que ya estaba en marcha. Sin esto, un esquema que el backend
 * rechaza se veía como un «ya estaba vigilando» tranquilizador: el observador
 * reintenta en cada guardado, falla igual y los cambios se quedan sin aplicar
 * sin que nadie lo diga. Aquí no se toca nada —el error es del código, no del
 * entorno, y el observador se recupera solo al guardar el arreglo—; solo se
 * avisa con el motivo delante.
 */
function reportDeployState() {
  const state = deployStateOf();
  if (state.state === "failed") {
    warn(`El último despliegue falló: ${deployFailureText(state)}`);
    info(
      c.dim(
        "El backend sigue sirviendo lo último que sí entró; el observador reintenta al guardar.",
      ),
    );
    info(c.dim(`El error completo está en el log: ${WATCH_LOG}`));
  } else if (state.state === "ready" && state.at) {
    info(c.dim(`Último despliegue correcto a las ${state.at}.`));
  }
}

/**
 * ¿Ese pid sigue siendo un `node`? Un pid guardado puede haberse reciclado —el
 * proceso murió y otro heredó su número—, y matar a quien no es sería peor que
 * dejar el pid viejo: antes de tocar nada se mira de quién es. Vite y el
 * observador de Convex corren con el Node del proyecto, así que ahí se vería.
 */
function isNodeProcess(pid) {
  if (!isWindows) {
    try {
      return readFileSync(`/proc/${pid}/cmdline`, "utf8").includes("node");
    } catch {
      // Sin /proc (macOS) no hay forma barata de mirarlo.
      return true;
    }
  }
  const list = capture("tasklist", [
    "/FI",
    `PID eq ${pid}`,
    "/FO",
    "CSV",
    "/NH",
  ]);
  if (list.status !== 0) return true;
  return /node\.exe/i.test(list.stdout);
}

/**
 * Abre la URL en el navegador por defecto y vuelve en cuanto arranca el lanzador
 * (no espera a que se cierre). Devuelve si llegó a arrancar: un sistema sin
 * navegador no puede tumbar el arranque, así que el fallo solo se cuenta en el
 * panel y la URL sigue estando ahí para abrirla a mano.
 */
function openInBrowser(url) {
  const [command, args] = isWindows
    ? // El título vacío evita que `start` se coma la URL como si fuera el título.
      ["cmd", ["/c", "start", "", url]]
    : process.platform === "darwin"
      ? ["open", [url]]
      : ["xdg-open", [url]];

  return new Promise((resolve) => {
    let settled = false;
    const settle = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    // Sin navegador, el lanzador no existe (ENOENT) o el sistema no lo encuentra:
    // se resuelve en falso y el arranque sigue.
    child.once("error", () => settle(false));
    child.once("spawn", () => {
      child.unref();
      settle(true);
    });
  });
}

/** El texto escrito en un log a partir de un byte dado (lo anterior es de otro). */
function logSince(file, offset) {
  try {
    return readFileSync(file).subarray(offset).toString("utf8");
  } catch {
    return "";
  }
}

/**
 * Lo último escrito en un log. El del observador crece durante toda la sesión
 * —cada cambio y cada log de función se suman—, así que se lee su final y no el
 * archivo entero.
 */
function logTail(file, maxBytes = 262144) {
  try {
    const buffer = readFileSync(file);
    return buffer
      .subarray(Math.max(0, buffer.length - maxBytes))
      .toString("utf8");
  } catch {
    return "";
  }
}

/** Las últimas líneas con contenido, para enseñar un log sin volcar entero. */
function tailLines(text, count = 12) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "")
    .slice(-count);
}

/** Lee un texto en formato `.env` como mapa (una clave por línea). */
function parseEnv(text) {
  const values = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

/** Lee `.env.local` como mapa. Solo se usan los valores para comprobar que están. */
function readLocalEnv() {
  const file = join(root, ".env.local");
  if (!existsSync(file)) return null;
  return parseEnv(readFileSync(file, "utf8"));
}

/** Cuerpo de `.env.example`, sin la cabecera `[TEMPLATE]` de la plantilla. */
function templateBody() {
  return readFileSync(join(root, ".env.example"), "utf8")
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("["))
    .join("\n");
}

/* ------------------------------------------------------------------ */
/* Arranque                                                            */
/* ------------------------------------------------------------------ */

/**
 * Credenciales de la cuenta de administrador documentadas en la página de
 * acceso. Se leen de `src/lib/roles.ts` para que no puedan separarse de la app.
 */
function adminCredentials() {
  const source = readFileSync(join(root, "src", "lib", "roles.ts"), "utf8");
  const read = (name) =>
    source.match(new RegExp(`${name}\\s*=\\s*"([^"]+)"`))?.[1] ?? null;
  const email = read("ADMIN_EMAIL");
  const password = read("ADMIN_PASSWORD");
  if (!email || !password) {
    abort(
      "No encuentro las credenciales de administrador en src/lib/roles.ts.",
      "El comando las lee de ahí (ADMIN_EMAIL y ADMIN_PASSWORD).",
    );
  }
  return { email, password };
}

/**
 * Clave de administrador que firma el backend en marcha. El backend imprime
 * una nueva en cada consulta y todas las de su instancia valen, así que sirve
 * para escribir una que funcione con este volumen de Docker.
 */
function adminKeyFromContainer() {
  const result = dockerCapture(
    [...COMPOSE, "exec", "-T", "backend", "./generate_admin_key.sh"],
    DOCKER_EXEC_MS,
  );
  // El script imprime la clave en la última línea con contenido.
  const key = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("convex-self-hosted|"))
    .pop();
  if (result.status !== 0 || !key) {
    abort(
      "No se ha podido obtener la clave de administrador del backend.",
      "Inténtalo a mano con: npm run convex:admin-key",
    );
  }
  return key;
}

/** Ejecuta una consulta de solo lectura contra el backend y devuelve su JSON. */
function inlineQuery(expression) {
  const result = convexCliCapture(["run", "--inline-query", expression]);
  if (result.status !== 0) {
    return null;
  }
  const text = result.stdout.trim();
  try {
    return JSON.parse(text);
  } catch {
    // Algunas salidas llevan un aviso delante: se busca el primer delimitador.
    const start = text.search(/[[{]/);
    if (start === -1) return null;
    try {
      return JSON.parse(text.slice(start));
    } catch {
      return null;
    }
  }
}

/**
 * Borra la base de datos: se lleva por delante los contenedores y el volumen
 * de Docker donde vive todo (esquema, datos, variables del deployment y claves
 * JWT). El arranque siguiente los vuelve a crear de cero.
 */
function wipeData() {
  step("Borrando la base de datos (volumen de Docker)");
  const result = dockerRun([...COMPOSE, "down", "-v"], DOCKER_DOWN_MS);
  if (result.status !== 0) {
    abort(
      "No se han podido parar y borrar los contenedores.",
      "Prueba a mano: npm run convex:down y luego docker volume rm convex_data",
    );
  }
  ok("Contenedores y volumen eliminados (la app empieza sin datos)");
}

/**
 * La sonda del motor: el CLI (`docker --version`, que no necesita motor) y el
 * servidor (`docker version`, que sí). `docker compose version` no vale para
 * esto —es del cliente y contesta aunque el motor esté muerto—, así que la
 * prueba de verdad es pedirle al servidor su versión, con techo de tiempo: un
 * motor colgado se queda ahí sin contestar y eso es lo que hay que ver.
 */
function probeDockerEngine() {
  const cli = capture("docker", ["--version"], { timeoutMs: DOCKER_PROBE_MS });
  const server = capture(
    "docker",
    ["version", "--format", "{{.Server.Version}}"],
    { timeoutMs: DOCKER_PROBE_MS },
  );
  return {
    state: dockerEngineState({
      cliOk: cli.status === 0,
      serverOk: server.status === 0,
      timedOut: server.timedOut,
    }),
    cliVersion: cli.stdout,
    serverVersion: server.stdout,
    // El motivo que da Docker, recortado: sus errores de conexión son una sola
    // línea larguísima y aquí solo hace falta reconocerlo.
    reason: firstLine(server.stderr).slice(0, 200),
  };
}

/**
 * Lo que dijo la última sonda del motor (la de `preflight`). Se guarda para no
 * volver a preguntar y, sobre todo, para no mandarle más órdenes a un motor que
 * ya se sabe que no contesta.
 */
let engineProbe = null;

/** Cómo se arranca o se reinicia el motor aquí (ver `dockerRestartPlan`). */
function dockerRestartPlanHere(state) {
  const desktopCli = dockerCapture(["desktop", "version"]).status === 0;
  const appPath = isWindows
    ? DOCKER_DESKTOP_EXE
    : process.platform === "darwin"
      ? DOCKER_DESKTOP_APP
      : null;
  return dockerRestartPlan({
    platform: process.platform,
    state,
    desktopCli,
    appPath: appPath !== null && existsSync(appPath) ? appPath : null,
  });
}

/**
 * Se asegura de que el motor de Docker responde; si no, lo arranca o lo reinicia
 * por su cuenta diciendo lo que hace. Un motor colgado es lo peor para un
 * arranque desatendido: `docker compose up` se queda esperando para siempre y el
 * script se queda mudo delante. Lo que no hace es tocar un motor que no hace
 * falta: si el backend ya está sirviendo, reiniciarlo pararía lo único que
 * funciona, así que se avisa y se deja en paz.
 */
async function ensureDockerEngine() {
  const probe = probeDockerEngine();
  engineProbe = probe;
  if (probe.state === "ok") return probe;

  if (probe.state === "missing") {
    abort(
      "No se encuentra Docker.",
      "Instala Docker Desktop (o el motor de Docker) y vuelve a ejecutar el comando.",
    );
  }

  const colgado = probe.state === "hung";
  const plan = dockerRestartPlanHere(probe.state);
  const backendHealthy = (await httpStatus(`${BACKEND_URL}/version`)) === 200;
  const action = dockerEngineAction({
    state: probe.state,
    backendHealthy,
    canRestart: plan.steps.length > 0,
  });

  if (action === "keep") {
    warn(
      colgado
        ? `El motor de Docker no contesta (${DOCKER_PROBE_MS / 1000} s sin responder).`
        : "El motor de Docker no está en marcha.",
    );
    info(
      c.dim(
        "El backend sigue sirviendo, así que no lo toco: reiniciarlo pararía lo que ya funciona.",
      ),
    );
    info(
      c.dim(
        `Reinícialo tú cuando te venga bien: ${
          plan.steps.length > 0 ? `hay que ${plan.steps[0].label}` : plan.manual
        }`,
      ),
    );
    return probe;
  }

  if (action === "manual") {
    abort(
      colgado
        ? "El motor de Docker está colgado: no contesta a ninguna orden."
        : "El motor de Docker no está en marcha.",
      plan.manual,
    );
  }

  warn(
    colgado
      ? "El motor de Docker está colgado: no contesta a ninguna orden."
      : "El motor de Docker no está en marcha.",
  );
  if (probe.reason) info(c.dim(`Docker dice: ${probe.reason}`));
  for (const step of plan.steps) warn(`Voy a ${step.label}.`);
  info(
    c.dim(
      "Los contenedores se paran un momento y vuelven solos: los datos están en su volumen, no se pierde nada.",
    ),
  );
  for (const step of plan.steps) {
    const result = run(step.command, step.args, { timeoutMs: DOCKER_PROBE_MS });
    // Que un paso proteste no decide nada por sí solo: lo que manda es si el
    // motor responde después, que es lo que se comprueba abajo.
    if (result.status !== 0) {
      info(c.dim(`(${step.label}: no ha salido bien, pero sigo)`));
    }
  }

  process.stdout.write("   esperando a que el motor de Docker responda...");
  const awake = await waitFor(
    async () => {
      const again = probeDockerEngine();
      return again.state === "ok" ? again : null;
    },
    { timeoutMs: DOCKER_WAKE_MS, intervalMs: 2000 },
  );
  console.log(awake ? " listo" : "");
  if (!awake) {
    abort(
      `El motor de Docker sigue sin responder tras ${DOCKER_WAKE_MS / 60000} minutos.`,
      `${plan.manual} Si sigue igual, reinicia el equipo o míralo a mano con \`docker desktop diagnose\`.`,
    );
  }
  ok(`Motor de Docker en marcha (v${awake.serverVersion})`);
  engineProbe = awake;
  return awake;
}

async function preflight() {
  step("Comprobando requisitos");

  const major = Number(process.versions.node.split(".")[0]);
  if (major < 20) {
    abort(
      `Necesitas Node 20 o superior; tienes ${process.versions.node}.`,
      "Descarga una versión reciente en https://nodejs.org",
    );
  }
  ok(`Node ${process.versions.node}`);

  if (!existsSync(join(root, "node_modules", "vite", "bin", "vite.js"))) {
    warn("Faltan las dependencias; instalando (npm install)...");
    // Puede tardar; se hereda la salida para ver el progreso.
    const result = runNpm(["install"]);
    if (result.status !== 0) {
      abort(
        "`npm install` ha fallado.",
        "Revisa los errores de arriba y reinténtalo.",
      );
    }
  }
  ok("Dependencias instaladas");

  // Primero el motor (y, si está colgado, se arranca o se reinicia solo) y
  // después el plugin de compose, que es del cliente: `docker compose version`
  // responde aunque el motor esté muerto, así que no sirve para probarlo.
  const engine = await ensureDockerEngine();
  const compose = dockerCapture([...COMPOSE, "version"]);
  if (compose.status !== 0) {
    abort(
      "Docker responde, pero falta el plugin `docker compose`.",
      "Actualiza Docker Desktop (o instala el plugin) y vuelve a ejecutar el comando.",
    );
  }
  ok(
    `Docker disponible (${engine.cliVersion || `motor v${engine.serverVersion}`})`,
  );
}

/** Los contenedores de este proyecto que ya están en marcha (`null` si no se sabe). */
function ourRunningContainers() {
  const listed = dockerCapture([
    ...COMPOSE,
    "ps",
    "--status",
    "running",
    "--format",
    "{{.Name}}",
  ]);
  if (listed.status !== 0) return null;
  return listed.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/** ¿Dos rutas son la misma? En Windows la caja no cuenta; en Unix sí. */
function samePath(a, b) {
  const clean = (value) =>
    (isWindows ? value.toLowerCase() : value)
      .replace(/\\/g, "/")
      .replace(/\/+$/, "");
  return clean(a) === clean(b);
}

/** Los contenedores que publican los puertos del backend, y de dónde salen. */
function backendPortHolders() {
  const list = dockerCapture(["ps", "--format", CONTAINERS_FORMAT]);
  return portHolders(list.stdout, BACKEND_PORTS);
}

/** El contenedor que sirve ese puerto, si lo publica alguno (`null` si no). */
function backendPortHolder(port) {
  return backendPortHolders().find((holder) => holder.port === port) ?? null;
}

/**
 * ¿Los contenedores que sirven el backend son los de este proyecto? `null`
 * cuando el puerto no lo publica ningún contenedor, que es no poder saberlo.
 */
function backendIsOurs() {
  const holders = backendPortHolders().filter(
    (holder) => holder.port === BACKEND_PORT,
  );
  if (holders.length === 0) return null;
  return holders.every(
    (holder) => holder.dir !== null && samePath(holder.dir, COMPOSE_DIR),
  );
}

/**
 * Quién tiene ocupado un puerto del anfitrión, si se puede saber. Es lo último
 * que se intenta cuando algo no responde y el puerto está cogido: un pid y un
 * nombre convierten «está ocupado» en algo que se puede cerrar. En Windows lo
 * dice el sistema; en Unix, `lsof`, que no está en todas partes (si no está, se
 * devuelve `null` y el mensaje se queda sin nombre).
 */
async function portOwner(port) {
  if (isWindows) {
    const listen = capture("powershell", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess`,
    ]);
    const pid = Number(listen.stdout.trim());
    if (!Number.isInteger(pid) || pid <= 0) return null;
    const named = capture("tasklist", [
      "/FI",
      `PID eq ${pid}`,
      "/FO",
      "CSV",
      "/NH",
    ]);
    return { pid, name: /^"([^"]+)"/.exec(named.stdout)?.[1] ?? "proceso" };
  }
  const found = capture("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]);
  if (found.status !== 0) return null;
  const pid = Number(found.stdout.split(/\r?\n/)[0]?.trim());
  if (!Number.isInteger(pid) || pid <= 0) return null;
  const comm = capture("ps", ["-p", String(pid), "-o", "comm="]);
  return { pid, name: comm.stdout.trim() || "proceso" };
}

/**
 * El choque de puertos contado como lo que es: quién lo tiene y qué hacer con
 * él. Es la única competición de verdad del arranque —Docker no puede publicar
 * un puerto ya cogido—, y sin esto se queda en un «port is already allocated»
 * que no dice ni quién ni dónde.
 */
async function portConflict() {
  for (const holder of backendPortHolders()) {
    if (holder.dir !== null && samePath(holder.dir, COMPOSE_DIR)) {
      return {
        what: `el contenedor ${holder.name} (de este proyecto) tiene el puerto ${holder.port} pero no responde`,
        hint: `Mira sus logs con \`npm run convex:logs\`; si sigue igual, ${isWindows ? "reinicia Docker Desktop" : "reinícialo"} y vuelve a intentarlo.`,
      };
    }
    return {
      what: `el puerto ${holder.port} lo tiene ${holderLabel(holder)}`,
      hint: `Páralo (\`docker stop ${holder.name}\`) o cambia el puerto en docker/convex/docker-compose.yml y en .env.local.`,
    };
  }
  const owner = await portOwner(BACKEND_PORT);
  if (owner !== null) {
    return {
      what: `el puerto ${BACKEND_PORT} lo tiene el proceso ${owner.pid} (${owner.name})`,
      hint: "Ciérralo y vuelve a ejecutar el comando (o cambia el puerto en el compose y en .env.local).",
    };
  }
  return null;
}

async function startContainers() {
  step("Levantando el backend de Convex (Docker)");

  // Con un motor que ya se sabe que no contesta no se intenta siquiera: la
  // orden se quedaría esperando (colgada) y lo que importa —la API— ya está
  // sirviendo. Se cuenta y se sigue, como cuando Docker no se deja gestionar.
  const reachable = engineProbe === null || engineProbe.state === "ok";

  // Lo que ya está en marcha se reutiliza, y se dice: `up -d` es idempotente,
  // pero sin esto el usuario no sabe si acaba de levantar el taller o si se ha
  // subido al que ya tenía (otro terminal, un lanzador, un arranque anterior).
  if (reachable) {
    const running = ourRunningContainers();
    if (running !== null && running.length > 0) {
      ok(
        `Ya estaba en marcha ${running.length} contenedor(es) de este proyecto: los reutilizo`,
      );
      info(c.dim(running.join(", ")));
    }
  }

  const result = reachable ? dockerRun([...COMPOSE, "up", "-d"]) : null;
  let managed = result !== null && result.status === 0;
  if (!managed) {
    // Un motor que se cuelga a mitad deja la orden esperando; con el techo de
    // tiempo puesto, aquí ya se sabe que no va a llegar nada.
    if (result?.error?.code === "ETIMEDOUT") {
      abort(
        `El motor de Docker no ha levantado los contenedores en ${DOCKER_UP_MS / 60000} minutos.`,
        "Si estaba colgado, prueba a reiniciarlo con `docker desktop restart` y vuelve a ejecutar el comando.",
      );
    }
    // Un motor de Docker que no se deja gestionar (Docker Desktop a medias, CLI
    // desincronizada) no tiene por qué parar el arranque si el backend ya está
    // sirviendo: lo que la app necesita es la API, no poder mirar los
    // contenedores. Cuando no responde, esto sigue siendo un muro.
    if ((await httpStatus(`${BACKEND_URL}/version`)) !== 200) {
      // Lo que más falla aquí es el puerto cogido por otro contenedor: si se
      // sabe quién lo tiene, se dice, en vez de dejar un error de Docker a pelo.
      const conflict = await portConflict();
      abort(
        conflict === null
          ? "No se han podido levantar los contenedores."
          : `No se han podido levantar los contenedores: ${conflict.what}.`,
        conflict === null
          ? "Prueba a ver los logs con: npm run convex:logs"
          : conflict.hint,
      );
    }
    if (backendIsOurs() === false) {
      warn(
        `Responde algo en el puerto ${BACKEND_PORT}, pero no es un contenedor de este proyecto: puede ser otro backend.`,
      );
      info(
        c.dim(
          "Si la app no te muestra tus datos, mira quién ocupa el puerto: docker ps",
        ),
      );
    } else {
      warn(
        "El motor de Docker no responde, pero el backend ya estaba en marcha: sigo con lo que hay.",
      );
    }
  }

  process.stdout.write("   esperando a que el backend responda...");
  const status = await waitFor(
    async () => (await httpStatus(`${BACKEND_URL}/version`)) === 200,
  );
  if (!status) {
    console.log("");
    abort(
      `El backend no responde en ${BACKEND_URL} tras 2 minutos.`,
      "Mira los logs con: npm run convex:logs",
    );
  }
  console.log(" listo");

  await waitFor(async () => (await httpStatus(ACTIONS_URL, 2000)) !== null, {
    timeoutMs: 30000,
  });
  ok(`API en ${BACKEND_URL}`);
  if (managed) {
    ok("Contenedores en marcha (backend + panel)");
  } else {
    warn("No he podido gestionar los contenedores: sigue el que ya estaba.");
    info(
      c.dim(
        "Reinicia Docker Desktop cuando te venga bien para volver a gestionarlos.",
      ),
    );
  }
}

/**
 * Crea `.env.local` desde la plantilla si falta, con la clave de admin del
 * backend. Con `rotateKey` refresca esa clave cuando ya no es la que firma el
 * backend: un backend rehecho firma con otro secreto y la del archivo dejaría
 * de valer. Con `fillMissing` (reparación) añade además las variables que
 * falten, sin tocar las líneas que ya están.
 *
 * Devuelve si la clave de administrador ha cambiado: el observador de Convex se
 * queda con la que leyó al arrancar, así que hay que reiniciarlo cuando pasa.
 */
async function ensureLocalEnv({ rotateKey = false, fillMissing = false } = {}) {
  step("Preparando .env.local");

  const body = templateBody();
  let values = readLocalEnv();
  let rotated = false;

  if (values === null) {
    info("No existe .env.local: lo creo desde .env.example.");
    writeFileSync(
      join(root, ".env.local"),
      body.replace(
        /^CONVEX_SELF_HOSTED_ADMIN_KEY=.*$/m,
        `CONVEX_SELF_HOSTED_ADMIN_KEY=${adminKeyFromContainer()}`,
      ),
    );
    values = readLocalEnv();
    rotated = true;
    ok(".env.local creado con la clave de administrador");
  } else if (rotateKey) {
    // El backend firma una clave nueva cada vez que se le pide, y todas las de
    // su instancia valen: se guarda la que acaba de imprimir. Es lo que arregla
    // una clave caducada (volumen rehecho, backend nuevo).
    const adminKey = adminKeyFromContainer();
    const file = join(root, ".env.local");
    const current = readFileSync(file, "utf8");
    if (!/^CONVEX_SELF_HOSTED_ADMIN_KEY=.*$/m.test(current)) {
      abort(
        ".env.local no tiene la línea CONVEX_SELF_HOSTED_ADMIN_KEY.",
        "Bórralo y vuelve a ejecutar el comando: se crea desde .env.example.",
      );
    }
    writeFileSync(
      file,
      current.replace(
        /^CONVEX_SELF_HOSTED_ADMIN_KEY=.*$/m,
        `CONVEX_SELF_HOSTED_ADMIN_KEY=${adminKey}`,
      ),
    );
    values = readLocalEnv();
    rotated = true;
    ok("Clave de administrador actualizada en .env.local");
  } else {
    ok(".env.local ya existía (no lo toco)");
  }

  let missing = REQUIRED_LOCAL_KEYS.filter((key) => !values?.[key]);
  if (missing.length > 0 && fillMissing) {
    // El archivo existe pero está a medias (p. ej. copiado sin una línea): se
    // añaden las que falten con el valor de la plantilla —la clave de admin,
    // del backend— y no se toca ninguna de las que ya estaban.
    const template = parseEnv(body);
    const filled = missing.map(
      (key) =>
        `${key}=${
          key === "CONVEX_SELF_HOSTED_ADMIN_KEY"
            ? adminKeyFromContainer()
            : (template[key] ?? "")
        }`,
    );
    const file = join(root, ".env.local");
    const current = readFileSync(file, "utf8");
    writeFileSync(
      file,
      `${current.replace(/\n?$/, "\n")}${filled.join("\n")}\n`,
    );
    values = readLocalEnv();
    missing = REQUIRED_LOCAL_KEYS.filter((key) => !values?.[key]);
    ok(`Añadidas a .env.local: ${filled.length} variable(s)`);
  }
  if (missing.length > 0) {
    abort(
      `.env.local no tiene valor para: ${missing.join(", ")}.`,
      "Compara tu archivo con .env.example; la clave de admin se obtiene con `npm run convex:admin-key`.",
    );
  }
  ok(`${REQUIRED_LOCAL_KEYS.length} variables de entorno presentes`);
  return { rotated };
}

/** Fija en el deployment lo que falte. No rota claves que ya existan. */
async function ensureDeploymentEnv() {
  step("Revisando las variables del deployment");

  const listed = convexCliCapture(["env", "list", "--names-only"]);
  if (listed.status !== 0) {
    abort(
      listed.timedOut
        ? "El CLI de Convex se ha quedado esperando al backend, que no responde."
        : "No se ha podido consultar el deployment.",
      "Comprueba que los contenedores están sanos (npm run convex:logs).",
    );
  }
  const names = new Set(
    listed.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== "" && !line.startsWith("(")),
  );

  const defaults = {
    SITE_URL: APP_URL,
    VLY_CONVEX_AUTH_ISSUER: "https://freebuff.com",
  };
  for (const [key, value] of Object.entries(defaults)) {
    if (names.has(key)) {
      ok(`${key} ya estaba definida`);
      continue;
    }
    if (convex(["env", "set", key, value]).status !== 0) {
      abort(`No se ha podido definir ${key} en el deployment.`);
    }
    ok(`${key} = ${value}`);
  }

  const keysMissing = ["JWT_PRIVATE_KEY", "JWKS"].filter(
    (key) => !names.has(key),
  );
  if (keysMissing.length === 0) {
    ok("JWT_PRIVATE_KEY y JWKS ya estaban definidas (no se rotan)");
    return;
  }

  warn(
    `Faltan ${keysMissing.join(", ")}: se generan ahora (deployment nuevo).`,
  );
  const generated = run(process.execPath, [
    join(root, "scripts", "generate-keys.mjs"),
    "--set",
  ]);
  if (generated.status !== 0) {
    abort("No se han podido generar las claves de Convex Auth.");
  }
  ok("Claves de Convex Auth generadas");
}

/**
 * Deja `convex dev` vigilando `src/convex` en segundo plano: es el mismo
 * observador que abre a mano quien trabaja en el backend, pero arrancado por el
 * script —log y pid en un archivo temporal, como Vite—. Así un cambio en una
 * función o en el esquema se despliega solo, sin volver a lanzar nada.
 *
 * Qué se hace con el que ya esté en marcha lo decide `watchPlan`
 * (`local-dev-lib.mjs`): se reutiliza el que sirve —también el que no arrancó
 * este script, el de otro terminal, porque dos observadores sobre el mismo
 * deployment se pisan— y se reinicia el nuestro cuando el entorno ha cambiado
 * (la clave de `.env.local` ya no es la que leyó al empezar).
 *
 * Con un observador ajeno y el entorno cambiado hay que elegir entre convivir con
 * los dos o quedarse con uno: por defecto se avisa y se arranca el nuestro —el
 * suyo ya no puede desplegar— sin tocar un proceso que no es nuestro; con
 * `--take-over` (`takeOver`) se cierra el ajeno y se arranca el nuestro, que es
 * lo que deja uno solo de verdad.
 *
 * La señal de que está listo es su primer despliegue: `convex dev` imprime
 * «Convex functions ready!» cada vez que empuja, y si se muere antes de
 * conseguirlo no tiene sentido seguir esperando.
 */
async function startConvexWatch({ restart = false, takeOver = false } = {}) {
  step("Dejando a Convex vigilando los ficheros del backend");

  const watching = watcherState();
  const plan = watchPlan({ kind: watching.kind, restart, takeOver });

  if (plan === "reuse") {
    if (watching.kind === "own") {
      ok(`Ya estaba vigilando (pid ${watching.pid})`);
      info(c.dim(`log: ${WATCH_LOG}`));
      reportDeployState();
    } else {
      ok(`Ya estaba vigilando (pid ${watching.pid}, lo arrancó otro terminal)`);
      info(
        c.dim(
          "Sus errores de despliegue salen en ese terminal, no aquí: solo leo el log del mío.",
        ),
      );
      info(
        c.dim(
          "No arranco otro: dos observadores sobre el mismo deployment se pisan.",
        ),
      );
      info(
        c.dim(
          "Para quedarte con uno solo, para el tuyo donde lo abriste o vuelve a ejecutar con `--take-over` y lo cierro yo.",
        ),
      );
    }
    return { started: false };
  }

  if (plan === "restart") {
    // El nuestro, con la clave vieja: no puede desplegar si no se rehace.
    info(
      c.dim("El entorno ha cambiado: reinicio el observador que ya estaba."),
    );
    stopWatcher();
  } else if (plan === "take-over") {
    const closed = await stopForeignProcess(watching.pid);
    if (closed) {
      ok(
        `He cerrado el observador ajeno (pid ${watching.pid}): me hago cargo con el mío`,
      );
    } else {
      warn(
        `No he podido cerrar el observador ajeno (pid ${watching.pid}): sigue en pie.`,
      );
      info(
        c.dim(
          "Ciérralo donde lo abriste; mientras tanto el mío deja el despliegue al día.",
        ),
      );
    }
  } else if (plan === "alongside") {
    warn(
      `Hay un \`convex dev\` en marcha (pid ${watching.pid}) que no arrancó este script.`,
    );
    info(
      c.dim(
        "El entorno ha cambiado, así que el suyo tiene la clave vieja y no puede desplegar.",
      ),
    );
    info(
      c.dim(
        "Arranco el mío para que el despliegue salga adelante; cuando cierres el otro, queda uno solo. Con `--take-over` lo cierro yo.",
      ),
    );
  }

  // El log se abre al final y se anota dónde empezaba: lo que se lea a partir de
  // ahí es de este arranque y no el «ready» de una ejecución anterior.
  const offset = existsSync(WATCH_LOG) ? statSync(WATCH_LOG).size : 0;
  const log = openSync(WATCH_LOG, "a");
  const child = spawn(process.execPath, [convexCli, "dev"], {
    cwd: root,
    detached: true,
    stdio: ["ignore", log, log],
  });
  child.unref();
  closeSync(log);
  writeFileSync(WATCH_PID, String(child.pid));

  process.stdout.write("   desplegando y empezando a vigilar...");
  const deadline = Date.now() + WATCH_TIMEOUT_MS;
  let ready = false;
  let alive = true;
  let failed = null;
  for (;;) {
    if (!isRunning(child.pid)) {
      alive = false;
      break;
    }
    const written = logSince(WATCH_LOG, offset);
    if (/Convex functions ready!/.test(written)) {
      ready = true;
      break;
    }
    // Un intento que ya ha fallado no se arregla esperando: el observador se
    // queda reintentando en cada guardado (es lo que pasa con un esquema que el
    // backend rechaza), así que se corta aquí y se cuenta el motivo, en vez de
    // gastar los tres minutos de margen para acabar diciendo que no desplegó.
    const state = deployState(written);
    if (state.state === "failed") {
      failed = state;
      break;
    }
    if (Date.now() >= deadline) break;
    await sleep(500);
  }
  console.log(ready ? " listo" : "");

  if (!ready) {
    // El porqué está en el log del observador: se enseñan sus últimas líneas
    // para no obligar a abrirlo cuando el fallo es el esquema o una función.
    for (const line of tailLines(logSince(WATCH_LOG, offset))) {
      console.log(c.dim(`   ${line}`));
    }
    if (failed) {
      abort(
        `El observador no ha podido desplegar: ${deployFailureText(failed)}`,
        `Arregla el error y guarda: lo reintenta solo. El log completo está en ${WATCH_LOG}.`,
      );
    }
    abort(
      alive
        ? "El observador de Convex no ha llegado a desplegar en 3 minutos."
        : "El observador de Convex se ha parado nada más arrancar.",
      `Mira el log completo en ${WATCH_LOG}, o el backend con: npm run convex:logs`,
    );
  }

  ok(`Funciones y esquema al día, y vigilando (pid ${child.pid})`);
  info(c.dim(`log: ${WATCH_LOG}`));
  return { started: true };
}

/**
 * Deja la demo lista sin pasos manuales. La cuenta de administrador se crea por
 * el mismo camino que usa la app en el primer «Entrar» (el store de Convex Auth
 * con el proveedor de contraseña), así que luego se puede entrar con las
 * credenciales documentadas; y los datos de ejemplo se cargan con la mutación
 * que ya usa el botón «Cargar datos de ejemplo», firmando como esa cuenta.
 */
async function bootstrapDemo() {
  step("Preparando la demo (cuenta de administrador y datos de ejemplo)");
  const { email, password } = adminCredentials();

  const payload = {
    args: {
      type: "createAccountFromCredentials",
      provider: "password",
      account: { id: email, secret: password },
      profile: { email, name: ADMIN_NAME, role: "admin", active: true },
      shouldLinkViaEmail: false,
    },
  };
  const created = convexCliCapture([
    "run",
    "auth:store",
    JSON.stringify(payload),
  ]);
  if (created.status !== 0) {
    abort(
      "No se ha podido crear la cuenta de administrador.",
      "Ejecuta `npm run convex:push` y vuelve a intentarlo; si sigue igual, mira los logs con `npm run convex:logs`.",
    );
  }

  // El id se lee de la base de datos en vez de la salida del comando: así no
  // hay que interpretar una respuesta que incluye el hash de la contraseña.
  const userId = inlineQuery(
    `const user = (await ctx.db.query("users").collect()).find((item) => item.email === ${JSON.stringify(email)}); return user?._id ?? null;`,
  );
  if (typeof userId !== "string" || userId === "") {
    abort(
      `La cuenta ${email} no ha quedado registrada en la base de datos.`,
      "Vuelve a ejecutar el comando; si se repite, mira los logs del backend.",
    );
  }
  ok(`Cuenta ${email} lista (administrador)`);

  const seeded = convexCliCapture(
    [
      "run",
      "seed:seedDemoData",
      "{}",
      "--identity",
      JSON.stringify({ subject: `${userId}|bootstrap` }),
    ],
    CLI_SLOW_MS,
  );
  if (seeded.status !== 0) {
    abort(
      "La cuenta se ha creado, pero la carga de datos de ejemplo ha fallado.",
      "Puedes intentarlo a mano desde la app con «Cargar datos de ejemplo».",
    );
  }

  const counts = inlineQuery(
    `const incidents = await ctx.db.query("incidents").collect(); const requests = await ctx.db.query("partRequests").collect(); const parts = await ctx.db.query("spareParts").collect(); return { incidents: incidents.length, requests: requests.length, parts: parts.length };`,
  );
  if (!counts || counts.incidents < 1) {
    abort(
      "La base de datos se ha quedado sin datos de ejemplo.",
      "Vuelve a ejecutar el comando para repetir la carga.",
    );
  }
  ok(
    `Datos de ejemplo cargados (${counts.incidents} incidencias, ${counts.requests} peticiones, ${counts.parts} repuestos)`,
  );
  return counts;
}

async function startVite() {
  step("Arrancando Vite");

  if ((await httpStatus(APP_URL)) !== null) {
    const { kind, pid } = viteState();
    if (kind === "foreign") {
      ok(
        `Ya hay un servidor sirviendo en ${APP_URL} (lo dejó otro terminal, pid ${pid})`,
      );
      info(
        c.dim(
          "No arranco otro: dos servidores sobre el mismo puerto se pisan. Para pararlo, ciérralo donde lo abriste.",
        ),
      );
    } else if (kind === "own") {
      ok(`Ya estaba sirviendo la app (pid ${pid})`);
    } else {
      // Contesta alguien, pero no es un Vite de este proyecto: puede ser otro
      // taller en el mismo puerto, y entonces la app que se abre no es esta.
      warn(
        `Responde algo en ${APP_URL}, pero no encuentro un Vite de este proyecto.`,
      );
      info(
        c.dim(
          `Comprueba que es esta app; si no lo es, cierra lo que ocupe el puerto ${APP_PORT} y vuelve a ejecutar el comando.`,
        ),
      );
    }
    return { started: false };
  }
  if (await portInUse(APP_PORT)) {
    const owner = await portOwner(APP_PORT);
    abort(
      `El puerto ${APP_PORT} está ocupado por un proceso que no responde como la app.`,
      `${
        owner === null ? "" : `Lo tiene el pid ${owner.pid} (${owner.name}). `
      }Libéralo (o ciérralo) y vuelve a ejecutar el comando.`,
    );
  }

  const viteCli = join(root, "node_modules", "vite", "bin", "vite.js");
  const log = openSync(VITE_LOG, "a");
  const child = spawn(process.execPath, [viteCli], {
    cwd: root,
    detached: true,
    stdio: ["ignore", log, log],
  });
  child.unref();
  closeSync(log);
  writeFileSync(VITE_PID, String(child.pid));

  const ready = await waitFor(async () => (await httpStatus(APP_URL)) === 200, {
    timeoutMs: 60000,
  });
  if (!ready) {
    abort(`Vite no responde en ${APP_URL}.`, `Revisa el log: ${VITE_LOG}`);
  }
  ok(`App en ${APP_URL} (pid ${child.pid})`);
  info(c.dim(`log: ${VITE_LOG}`));
  return { started: true };
}

/**
 * Cierra el observador que dejó otro terminal (el `convex dev` ajeno). El pid no
 * viene de ningún archivo —de un proceso que no arrancó este script no hay pid
 * guardado—, sino de la lista de procesos, que es donde se reconoció; aun así se
 * comprueba que siga siendo un `node` antes de tocarlo, igual que con los del pid
 * file: entre reconocerlo y llegar aquí pudo morir y su número ser ya de otra
 * cosa.
 *
 * No sirve `killTree`, que en Unix mata el *grupo* del pid: el proceso de otra
 * terminal encabeza el suyo, no un grupo nuestro. Ahí hay que matar el proceso
 * —primero pidiéndoselo (SIGTERM, que el CLI atiende cerrando su conexión) y, si
 * sigue en pie, a la fuerza—. En Windows, en cambio, el árbol es justo lo que
 * hace falta (`taskkill /T`, para que no quede ningún hijo colgando).
 *
 * Devuelve si de verdad se ha ido: un cierre pedido y no conseguido se tiene que
 * poder contar, porque después se arranca otro observador y no pueden quedar dos
 * desplegando sobre el mismo deployment. Solo se llama con `--take-over` de por
 * medio: apagar un proceso que no arrancó este comando no se hace por iniciativa
 * propia.
 */
async function stopForeignProcess(pid) {
  if (!isRunning(pid) || !isNodeProcess(pid)) return false;
  if (isWindows) {
    killTree(pid);
  } else {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      return false;
    }
  }
  const deadline = Date.now() + FOREIGN_STOP_MS;
  while (Date.now() < deadline) {
    await sleep(200);
    if (!isRunning(pid)) return true;
  }
  if (!isWindows) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Se fue entre la comprobación y el aviso: no hay nada que insistir.
    }
    await sleep(200);
  }
  return !isRunning(pid);
}

/**
 * Para un proceso lanzado en segundo plano por un arranque anterior, leyendo su
 * pid guardado. Antes de matarlo se comprueba que siga siendo un `node` nuestro:
 * un pid muerto puede haberse reciclado en cualquier otra cosa.
 */
function stopBackgroundProcess(pidFile, name) {
  const pid = savedPid(pidFile);
  if (isRunning(pid) && isNodeProcess(pid)) {
    killTree(pid);
    rmSync(pidFile, { force: true });
    return `${name} parado (pid ${pid})`;
  }
  rmSync(pidFile, { force: true });
  return `No había ningún ${name} que parar`;
}

/** Para el observador de Convex si es el nuestro. */
function stopWatcher() {
  const result = stopBackgroundProcess(WATCH_PID, "observador de Convex");
  return !result.startsWith("No había");
}

/**
 * Para lo que este script deja en segundo plano: el servidor de la app y el
 * observador de Convex. Los contenedores siguen (se paran con `convex:down`, que
 * conserva los datos).
 */
function stopBackground() {
  step("Parando lo que arrancó este script");
  ok(stopBackgroundProcess(VITE_PID, "Vite"));
  ok(stopBackgroundProcess(WATCH_PID, "observador de Convex"));
}

/* ------------------------------------------------------------------ */
/* Comprobación de salud                                               */
/* ------------------------------------------------------------------ */

/**
 * Sonda las funciones desplegadas. `incidents:list` exige sesión, así que un
 * error de permisos demuestra que la función existe; lo que delata un despliegue
 * vacío es que Convex diga que no encuentra la función pública.
 */
async function functionsDeployed() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "incidents:list",
        args: {},
        format: "json",
      }),
      signal: AbortSignal.timeout(4000),
    });
    const body = await response.json();
    if (
      typeof body.errorMessage === "string" &&
      /could not find/i.test(body.errorMessage)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Ejecuta todas las comprobaciones. Cada resultado lleva su `id` además de la
 * etiqueta que se imprime: es lo que permite reparar justo lo que ha fallado
 * (ver `REPAIRS`).
 */
async function runChecks() {
  const results = [];
  const check = async (id, label, probe) => {
    let detail = "";
    let healthy = false;
    try {
      const value = await probe();
      if (typeof value === "string") {
        healthy = true;
        detail = value;
      }
    } catch (error) {
      detail = error instanceof Error ? error.message : String(error);
    }
    results.push({ id, label, healthy, detail });
  };

  // Una sola consulta autenticada por pasada: con ella se comprueba que la clave
  // de `.env.local` vale (¿responde el deployment?) y qué variables tiene. Si el
  // CLI se queda esperando al backend, eso no dice nada de la clave: la clave
  // está sin comprobar, y así se cuenta, en vez de darla por caducada.
  let deploymentNames;
  let deploymentGripe = null;
  let askedDeployment = false;
  const askDeployment = () => {
    if (!askedDeployment) {
      const listed = convexCliCapture(["env", "list", "--names-only"]);
      deploymentNames =
        listed.status === 0 ? new Set(linedNames(listed.stdout)) : null;
      deploymentGripe =
        deploymentNames === null
          ? listed.timedOut
            ? `el backend no responde (el CLI se ha quedado esperando ${CLI_MS / 1000} s)`
            : "el CLI no ha podido consultar el deployment (¿clave de administrador caducada?)"
          : null;
      askedDeployment = true;
    }
    return deploymentNames;
  };

  await check("containers", "Contenedores del backend en marcha", async () => {
    // Con techo de tiempo: un motor colgado no puede dejar colgado también al
    // diagnóstico, que es justo el que tiene que contarlo.
    const ps = dockerCapture([...COMPOSE, "ps", "-q", "backend"]);
    if (ps.timedOut) {
      throw new Error(
        `el motor de Docker no responde (${DOCKER_PROBE_MS / 1000} s sin contestar)`,
      );
    }
    if (ps.status !== 0 || ps.stdout === "") {
      // «No hay nada» y «lo tiene otro» no son lo mismo: con quién ocupa el
      // puerto delante, el aviso dice a quién parar en vez de mandar a mirar los
      // logs de un contenedor que aquí no existe (otro taller, otro arranque,
      // otro nombre de proyecto).
      const holder = backendPortHolder(BACKEND_PORT);
      throw new Error(
        holder === null
          ? "no encuentro el contenedor backend"
          : `el puerto ${BACKEND_PORT} lo tiene ${holderLabel(holder)}, no el contenedor de este proyecto`,
      );
    }
    return "contenedor presente";
  });

  await check("api", `API de Convex responde en ${BACKEND_URL}`, async () => {
    const status = await httpStatus(`${BACKEND_URL}/version`);
    if (status === null) throw new Error("sin respuesta");
    if (status !== 200) throw new Error(`HTTP ${status}`);
    return "HTTP 200";
  });

  await check(
    "actions",
    `HTTP actions de auth responden en ${ACTIONS_URL}`,
    async () => {
      const status = await httpStatus(ACTIONS_URL, 2000);
      if (status === null) throw new Error("sin respuesta");
      // Cualquier respuesta sirve: el puerto está escuchando (un 404 en "/" es
      // normal).
      return `HTTP ${status}`;
    },
  );

  await check("envFile", "`.env.local` completo", () => {
    const values = readLocalEnv();
    if (values === null) throw new Error("no existe .env.local");
    const missing = REQUIRED_LOCAL_KEYS.filter((key) => !values[key]);
    if (missing.length > 0) throw new Error(`faltan: ${missing.join(", ")}`);
    return `${REQUIRED_LOCAL_KEYS.length} variables`;
  });

  // Una clave con el formato correcto puede estar caducada (volumen rehecho,
  // `.env.local` copiado de otro sitio): la única prueba de que sirve es usarla
  // contra el backend, que es lo que responde a esta consulta.
  await check("adminKey", "Clave de administrador vigente", () => {
    if (!readLocalEnv()?.CONVEX_SELF_HOSTED_ADMIN_KEY) {
      throw new Error("no hay clave en .env.local");
    }
    if (askDeployment() === null) throw new Error(deploymentGripe);
    return "el backend la acepta";
  });

  await check("deploymentEnv", "Variables de auth del deployment", () => {
    const names = askDeployment();
    if (names === null) throw new Error(deploymentGripe);
    const missing = REQUIRED_DEPLOYMENT_KEYS.filter((key) => !names.has(key));
    if (missing.length > 0) throw new Error(`faltan: ${missing.join(", ")}`);
    return `${REQUIRED_DEPLOYMENT_KEYS.length} variables`;
  });

  await check("functions", "Funciones de Convex desplegadas", async () => {
    if (!(await functionsDeployed())) {
      throw new Error(
        `el backend no encuentra \`incidents:list\` (mira el log del observador: ${WATCH_LOG})`,
      );
    }
    return "sonda sobre incidents:list correcta";
  });

  // Sin observador, las funciones que hay desplegadas siguen valiendo, pero
  // cualquier cambio en `src/convex` se queda sin aplicar hasta que alguien
  // despliegue a mano: es justo lo que arranca `npm run local`. Vale el
  // observador que arrancó este script y el que dejó otro terminal: los dos
  // vigilan lo mismo, así que el entorno está igual de sano.
  await check("watcher", "Convex vigilando `src/convex`", () => {
    const { kind, pid } = watcherState();
    if (kind === "none") {
      throw new Error("no hay observador (lo arranca npm run local)");
    }
    return kind === "own"
      ? `pid ${pid}`
      : `pid ${pid} · lo arrancó otro terminal`;
  });

  // El observador puede seguir en marcha y, aun así, llevar un rato sin poder
  // desplegar: un esquema que el backend rechaza (o un typecheck roto) se
  // reintenta en cada guardado y falla igual, y lo desplegado sigue siendo la
  // versión de antes. La sonda de `functions` no lo ve —las funciones viejas
  // responden—, así que el único sitio donde está el porqué es su log.
  await check("deploy", "Observador desplegando sin errores", () => {
    const { kind } = watcherState();
    if (kind === "none") {
      throw new Error(
        "no hay observador: nadie aplica los cambios del backend",
      );
    }
    if (kind === "foreign") {
      return "es de otro terminal: sus errores salen donde lo abriste";
    }
    const state = deployStateOf();
    if (state.state === "failed") {
      throw new Error(`el último falló: ${deployFailureText(state)}`);
    }
    if (state.state === "pending") return "desplegando ahora mismo";
    if (state.state === "unknown") return "el log todavía no dice nada";
    return state.at ? `último correcto a las ${state.at}` : "correcto";
  });

  await check("app", `App servida en ${APP_URL}`, async () => {
    const status = await httpStatus(APP_URL);
    if (status === null) throw new Error("sin respuesta (¿Vite parado?)");
    if (status !== 200) throw new Error(`HTTP ${status}`);
    // Quién la sirve importa: `local:stop` solo para lo que arrancó este
    // script, así que conviene saber si el Vite que contesta es suyo.
    const { kind, pid } = viteState();
    if (kind === "foreign")
      return `HTTP 200 · lo dejó otro terminal (pid ${pid})`;
    if (kind === "none") {
      return "HTTP 200 · no es un Vite de este proyecto (¿otro servidor en el puerto?)";
    }
    return `HTTP 200 · pid ${pid}`;
  });

  return results;
}

/**
 * Qué se le cuenta al usuario de cada comprobación perdonada: sin esto, un «!»
 * en amarillo diría que algo va mal y no si hay que hacer algo al respecto.
 */
const TOLERATED_NOTES = {
  containers:
    "No puedo gestionar los contenedores, pero la API responde: reinicia Docker Desktop cuando te venga bien.",
  deploy:
    "El observador no puede desplegar (arriba está el motivo): la app sigue con lo último que sí entró. Arréglalo y guarda: reintenta solo.",
};

/**
 * Imprime la tabla de comprobaciones con su marca: ✓ en verde, ✗ en rojo y, en
 * amarillo, las que van en `tolerated` —cosas torcidas que no impiden usar la
 * app, como no poder gestionar los contenedores cuando el backend ya responde, o
 * un despliegue que no entra y deja al backend en su última versión buena—.
 */
function printResults(
  results,
  title = "Estado del entorno local",
  tolerated = new Set(),
) {
  console.log(`\n${c.bold(title)}`);
  for (const { id, label, healthy, detail } of results) {
    const mark = healthy
      ? c.green("✓")
      : tolerated.has(id)
        ? c.yellow("!")
        : c.red("✗");
    const extra = detail ? c.dim(` (${detail})`) : "";
    console.log(`  ${mark} ${label}${extra}`);
  }
  for (const id of tolerated) {
    const note = TOLERATED_NOTES[id];
    if (note) console.log(`\n  ${c.yellow("!")} ${c.dim(note)}`);
  }
}

/**
 * Las comprobaciones del arranque. Con `tolerateUnmanagedContainers` no cuenta
 * como fallo no poder gestionar los contenedores si la API ya responde: no
 * poder *mirarlos* no deja la app inservible. Con `tolerateDeployErrors` tampoco
 * cuenta un despliegue que no entra: el backend sigue sirviendo lo último que sí
 * entró, así que lo que toca al arrancar es avisar con el motivo y dejar seguir.
 * El diagnóstico (`--check`) va sin esa manga ancha, que ahí lo que se quiere
 * saber es justo lo que está torcido.
 */
async function healthCheck({
  tolerateUnmanagedContainers = false,
  tolerateDeployErrors = false,
} = {}) {
  const results = await runChecks();
  // Qué se perdona y qué no lo decide `healthVerdict` (en `local-dev-lib.mjs`),
  // que es la regla que prueban las pruebas.
  const { tolerated, failures } = healthVerdict(results, {
    tolerateUnmanagedContainers,
    tolerateDeployErrors,
  });
  printResults(results, undefined, tolerated);
  return failures.length;
}

function linedNames(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("("));
}

/* ------------------------------------------------------------------ */
/* Reparación del entorno                                              */
/* ------------------------------------------------------------------ */

/**
 * Qué paso arregla cada comprobación rota, en el orden en que hay que aplicarlo:
 * primero el backend, después la clave con la que se le habla, luego sus
 * variables y las funciones, y al final el servidor de la app. Ninguno de estos
 * pasos toca la base de datos: lo único que borra datos es `--fresh`.
 */
const REPAIRS = [
  {
    ids: ["containers", "api", "actions"],
    label: "el backend de Convex",
    run: startContainers,
  },
  {
    ids: ["envFile", "adminKey"],
    label: "`.env.local` y la clave de administrador",
    // Rellenar una línea que falta no necesita tocar la clave: solo se refresca
    // cuando la comprobación dice que la del archivo ya no vale.
    run: async ({ broken }) => {
      const { rotated } = await ensureLocalEnv({
        // La clave solo se rota cuando el backend la ha rechazado con vida. Si
        // no contestaba (por eso falló la comprobación), la del archivo no está
        // probada de nada: rotarla obligaría a reiniciar el observador sin
        // motivo.
        rotateKey: broken.has("adminKey") && !broken.has("api"),
        fillMissing: true,
      });
      // El observador leyó la clave al arrancar: si ha cambiado, la suya ya no
      // vale para desplegar y hay que reiniciarlo, aunque siga en marcha.
      if (rotated) broken.add("watcher");
    },
  },
  {
    ids: ["deploymentEnv"],
    label: "las variables de auth del deployment",
    run: ensureDeploymentEnv,
  },
  {
    ids: ["functions", "watcher"],
    label: "las funciones de Convex y su observador",
    // Desplegar y quedarse vigilando es lo mismo para quien cambia el backend:
    // el observador empuja lo que ya hay y sigue pendiente de lo que venga.
    // Aquí el entorno ha cambiado casi por definición (es lo que se está
    // arreglando), así que si el observador que hay es de otro terminal es donde
    // tiene sentido el `--take-over`: cerrarlo y quedarse con el nuestro.
    run: () => startConvexWatch({ restart: true, takeOver }),
  },
  {
    ids: ["app"],
    label: "el servidor de la app",
    run: startVite,
  },
];

/**
 * Revisa el entorno, arregla lo que esté roto —contenedores o Vite parados,
 * clave de administrador caducada, variables de auth que falten, funciones sin
 * desplegar— y lo vuelve a comprobar. A diferencia de `--fresh`, no borra ni
 * carga datos: la base de datos se queda exactamente como estaba.
 */
async function repairEnvironment() {
  await preflight();

  const before = await runChecks();
  printResults(before, "Diagnóstico del entorno local");
  const broken = new Set(
    before.filter((result) => !result.healthy).map((result) => result.id),
  );

  if (broken.size === 0) {
    ok("No hay nada roto: no se toca nada");
  } else {
    warn(
      `Hay ${broken.size} cosa(s) rota(s): se arreglan sin tocar la base de datos.`,
    );
    for (const repair of REPAIRS) {
      if (!repair.ids.some((id) => broken.has(id))) continue;
      // Sin número: cada reparación imprime sus propios pasos numerados.
      console.log(`\n${c.bold(`Arreglando ${repair.label}`)}`);
      await repair.run({ broken });
    }
  }

  const results = await runChecks();
  printResults(results);
  const failed = results.filter((result) => !result.healthy);
  if (failed.length > 0) {
    abort(
      `${failed.length} comprobación(es) siguen en rojo.`,
      `Revisa las líneas marcadas con ✗; si el backend no responde, mira los logs con \`npm run convex:logs\`, y si es el despliegue, el motivo está en su log: ${WATCH_LOG}`,
    );
  }
  printPanel({ repaired: broken.size > 0 });
}

/**
 * El panel final. El texto lo compone `panelLines` (en `local-dev-lib.mjs`),
 * que es lo que prueban las pruebas; aquí solo se le dan las URLs y se imprime.
 * La última línea es la URL de la app, a propósito: es lo que se busca al
 * terminar, y por eso la compone el mismo sitio que imprime el resto.
 */
function printPanel(options = {}) {
  const { email } = adminCredentials();
  // Se vuelve a preguntar quién vigila, y no se recuerda lo que dijo el arranque:
  // el panel cuenta cómo queda el entorno ahora (también vale para `--repair`).
  const { kind, pid } = watcherState();
  const app = viteState();
  const lines = panelLines(
    {
      ...options,
      email,
      appUrl: APP_URL,
      apiUrl: BACKEND_URL,
      dashboardUrl: DASHBOARD_URL,
      watchLog: WATCH_LOG,
      foreignWatchPid: kind === "foreign" ? pid : null,
      foreignAppPid: app.kind === "foreign" ? app.pid : null,
    },
    c,
  );
  for (const line of lines) console.log(line);
}

/* ------------------------------------------------------------------ */

if (flags.has("--help") || flags.has("-h")) {
  console.log(`Uso: npm start [-- --fresh | --repair | --check | --stop | --take-over | --no-open]
     (o npm run local: es el mismo script)

  (sin opciones)  levanta contenedores, prepara el entorno, despliega, arranca Vite
                  y deja convex dev vigilando src/convex (los cambios del backend
                  se aplican solos, sin volver a lanzar nada). Lo que ya está en
                  marcha se reutiliza en vez de competir por los puertos: los
                  contenedores del proyecto, el Vite que ya sirve la app y el
                  convex dev que ya vigila, aunque los haya abierto otro terminal
  --fresh         empieza de cero: borra la base de datos, la rehace y carga los datos de ejemplo
  --repair        arregla un entorno roto (clave caducada, variables de auth que falten,
                  funciones sin desplegar, observador o Vite parados) sin borrar datos
  --check         solo comprueba que el entorno local está sano
  --stop          para el Vite y el observador de Convex que arrancó este script
  --take-over     si el observador que ya está vigilando lo abrió otro terminal, lo cierra
                  y arranca el suyo (útil cuando el entorno ha cambiado, porque el ajeno
                  se queda con la clave vieja y no puede desplegar)
  --no-open       no abre el navegador al terminar (por defecto sí lo abre, en la URL)

También se puede arrancar con doble clic: start.cmd (Windows) o start.sh.
Al terminar imprime la comprobación de salud y, en la última línea, la URL.

Si el motor de Docker está colgado (no contesta a ninguna orden) o parado, el
arranque lo dice y lo reinicia o lo arranca él mismo antes de seguir; si el
backend ya estaba sirviendo no lo toca, porque reiniciarlo pararía lo que
funciona.`);
  process.exit(0);
}

if (flags.has("--stop")) {
  stopBackground();
  process.exit(0);
}

if (flags.has("--check")) {
  const failed = await healthCheck();
  process.exit(failed === 0 ? 0 : 1);
}

if (flags.has("--repair")) {
  // Reparar es lo contrario de empezar de cero (`--fresh` borra los datos) y
  // trae su propia comprobación, así que no se combina con nada más.
  const incompatible = ["--fresh", "--check", "--stop"].filter((flag) =>
    flags.has(flag),
  );
  if (incompatible.length > 0) {
    abort(
      `--repair no se combina con ${incompatible.join(", ")}.`,
      "Arregla el entorno con: npm run local -- --repair",
    );
  }
  console.log(c.bold("Pulso Taller · reparar el entorno local"));
  info(
    c.dim(
      "Solo se arregla lo que esté roto; la base de datos no se toca (para empezar de cero, --fresh).",
    ),
  );
  await repairEnvironment();
  process.exit(0);
}

const fresh = flags.has("--fresh");
// `--no-open` desactiva el navegador: para scripts, terminales compartidas o
// quien ya tiene la pestaña abierta.
const noOpen = flags.has("--no-open");

console.log(
  c.bold(
    fresh
      ? "Pulso Taller · entorno local (demo desde cero)"
      : "Pulso Taller · entorno local",
  ),
);
if (fresh) {
  info(
    c.dim(
      "Se borran los datos de este entorno: vuelve a crearse la base de datos con la demo cargada.",
    ),
  );
}

await preflight();
if (fresh) wipeData();
await startContainers();
// Con `--fresh` la clave de administrador se refresca: el observador que hubiera
// en marcha se quedaría con la vieja, así que se reinicia.
const { rotated } = await ensureLocalEnv({ rotateKey: fresh });
await ensureDeploymentEnv();
await startConvexWatch({ restart: rotated, takeOver });
const demo = fresh ? await bootstrapDemo() : null;
await startVite();

// En el arranque se toleran las dos cosas que no dejan la app inservible: un
// Docker que no se deja gestionar (lo que importa es que la API y la app
// respondan) y un despliegue que no entra (el backend sigue con lo último que sí
// entró). Las dos se imprimen para no dejarlas pasar en silencio; el diagnóstico
// estricto es `local:check`.
const failed = await healthCheck({
  tolerateUnmanagedContainers: true,
  tolerateDeployErrors: true,
});
if (failed > 0) {
  abort(
    `${failed} comprobación(es) han fallado.`,
    "Revisa las líneas marcadas con ✗ antes de abrir la app.",
  );
}

// Se abre solo al final y solo si el entorno está sano: lo que se busca al
// arrancar es entrar en la app, y a estas alturas la app ya responde.
const browser = noOpen
  ? "off"
  : (await openInBrowser(APP_URL))
    ? "opened"
    : "failed";
printPanel({ fresh, demo, browser });
