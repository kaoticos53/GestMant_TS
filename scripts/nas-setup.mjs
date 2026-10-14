// La puesta en marcha del NAS, en un solo comando idempotente: los pasos 1 a 5 de
// `SYNOLOGY.md`, de una vez y sin copiar nada a mano.
//
//   npm run nas -- --host IP-del-NAS \
//     --app-url https://taller.tudominio.com \
//     --api-url https://api.tudominio.com
//
// Y, para saber cómo está el taller sin cambiar nada:
//
//   npm run nas:check            (o: npm run nas -- --check --host IP-del-NAS)
//
// Se lanza **desde el ordenador** (con el proyecto clonado) y habla con el NAS por
// SSH, que es la única forma de hacer el paso 3 —llevar el código— sin copiar
// carpetas a mano. A partir de ahí, todo pasa dentro del NAS: el guion que se
// ejecuta allí (`setupScript` en `nas-setup-lib.mjs`) hace los pasos 1, 2, 4 y 5.
//
// Lo que hace este archivo, en orden:
//
//   1. Comprueba que se llega al NAS por SSH (y lo dice claro si no).
//   2. Prepara la carpeta del proyecto y deja allí el docker-compose.yml.
//   3. Lleva el código (tar por la conexión, sin node_modules ni dist ni .env.local).
//   4. Sube la plantilla del .env y el guion que se ejecuta dentro del NAS.
//   5. Lo lanza y espera: construye, arranca, pide la clave y despliega.
//
// Es idempotente a propósito, y en el mismo sentido que el arranque local: lo que
// ya está hecho no se rehace ni se pisa. Los datos no se tocan nunca —viven en el
// volumen del backend— y el secreto de la instancia y la clave de administrador
// solo se generan si faltan, porque rotarlos dejaría fuera a quien esté dentro.
//
// La contraseña del NAS se teclea **una sola vez**, y solo si hace falta: si la
// cuenta entra con clave SSH no se pide nada. Con ella entran todas las conexiones
// —por el ayudante de `ssh`— y también el `sudo` de dentro, que es lo que convertía
// esto en siete veces la misma contraseña. Los detalles, en `nas-clave-lib.mjs`.
//
// Los valores de configuración se leen de los flags y, si no están, del entorno
// (`NAS_HOST`, `NAS_PATH`, …), para no teclear el host del NAS en cada arranque.
//
// La última línea que imprime es la URL de la app: al terminar, lo que se busca es
// dónde entrar.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  doctorPanelLines,
  doctorReport,
  doctorScript,
  parseDoctorResult,
} from "./nas-doctor-lib.mjs";
import {
  apiModulesVerdict,
  checkPanelLines,
  checkReport,
  checkScript,
  listedModules,
  moduleEntries,
  moduleNames,
  panelLines,
  parseCheckResult,
  parseSetupResult,
  resolveConfig,
  packVerdict,
  scriptWords,
  setupScript,
  shQuote,
  tarArgs,
  unpackCommand,
  usage,
} from "./nas-setup-lib.mjs";
import { admiteAyudante, pedirClave, prepararAyudante } from "./nas-clave.mjs";
import {
  AVISO_ANTES,
  AVISO_SSH_SIN_AYUDANTE,
  conClave,
  envoltorioClave,
  haceFaltaClave,
} from "./nas-clave-lib.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

/** Los dos archivos del repositorio que viajan al NAS, además del código. */
const COMPOSE_FILE = join(root, "docker", "synology", "docker-compose.yml");
const ENV_EXAMPLE = join(root, "docker", "synology", ".env.example");

const c = {
  bold: (s) => `\u001b[1m${s}\u001b[0m`,
  dim: (s) => `\u001b[2m${s}\u001b[0m`,
  green: (s) => `\u001b[32m${s}\u001b[0m`,
  red: (s) => `\u001b[31m${s}\u001b[0m`,
  yellow: (s) => `\u001b[33m${s}\u001b[0m`,
};

let stepNumber = 0;
const step = (text) => console.log(`\n${c.bold(`${++stepNumber}. ${text}`)}`);
const ok = (text) => console.log(`   ${c.green("✓")} ${text}`);

/** Corta el proceso con un mensaje claro en vez de con una traza de Node. */
function abort(text, hint) {
  console.error(`\n${c.red("✗")} ${text}`);
  if (hint) console.error(c.dim(hint));
  process.exit(1);
}

/** La primera línea con algo, para enseñar el motivo que da SSH. */
function firstLine(text) {
  return (
    String(text ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line !== "") ?? ""
  );
}

const config = resolveConfig(process.argv.slice(2), process.env);

if (config.help) {
  console.log(usage().join("\n"));
  process.exit(0);
}

if (config.errors.length > 0) {
  for (const error of config.errors) console.error(`${c.red("✗")} ${error}`);
  abort(
    "no puedo empezar con esto",
    "Mira «npm run nas -- --help» para ver las opciones.",
  );
}

const destino = `${config.user}@${config.host}`;
const destinoLargo = `${config.user}@${config.host}:${config.root}`;

/** Cómo se llama a SSH: puerto, sin colgarse y con la orden al final. */
const sshArgs = (extra = []) => [
  "-o",
  "ConnectTimeout=10",
  "-p",
  config.port,
  ...extra,
  destino,
];

// Con terminal delante se pide una seudo-terminal al NAS: es lo que hace que el
// `sudo` de dentro pueda pedir la contraseña. Sin terminal (una ejecución
// desatendida) se ahorra, porque no habría dónde teclearla.
const ttyArgs = () => (clave ? ["-T"] : process.stdin.isTTY ? ["-t"] : ["-T"]);

// Y con la contraseña ya tecleada no se pide ninguna: lo que hay que hacer dentro
// del NAS no pregunta nada —el `sudo` de dentro la recibe por la entrada estándar,
// mira `envoltorioClave`—, así que una seudo-terminal solo serviría para que la
// clave cruzara por un sitio donde el NAS la repite en pantalla.
//
// La contraseña del NAS, si ha habido que teclearla (**una sola vez**: mira
// `nas-clave.mjs`) y el ayudante con el que la reciben las conexiones siguientes.
// Vive aquí, en memoria, mientras dura el comando: no se escribe en ningún sitio.
let clave = null;
let ayudante = null;

/** El entorno de cada `ssh`: el de siempre, más el ayudante cuando lo hay. */
const entornoSsh = () => ({ ...process.env, ...(ayudante?.entorno ?? {}) });

/**
 * Lo que se le da a un `ssh` cuya orden empieza leyendo la clave: el entorno con el
 * ayudante —para que la conexión entre sin preguntar— y la clave por la entrada
 * estándar, que es de donde la lee el `read` del principio. Sin clave no se le manda
 * nada y la entrada queda como estaba (la terminal, para lo que pregunte).
 */
const conEntradaDeClave = () => ({
  env: entornoSsh(),
  input: clave ? `${clave}\n` : null,
});

/**
 * Ejecuta un comando y hereda la salida, para que el progreso se vea mientras
 * pasa. Con `capture` además se queda con lo que salió por la salida estándar
 * —hace falta para leer el resumen del guion del NAS— sin dejar de enseñarlo.
 */
function stream(
  command,
  args,
  { capture = false, input = null, env = process.env } = {},
) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      stdio: [
        input === null ? "inherit" : "pipe",
        capture ? "pipe" : "inherit",
        "inherit",
      ],
    });
    // Lo que se le manda por la entrada —la contraseña del NAS, cuando toca— va de
    // una vez y se cierra: lo que hay dentro la lee y no se queda esperando nada.
    if (input !== null) child.stdin?.end(input);
    let text = "";
    if (capture && child.stdout) {
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        text += chunk;
        process.stdout.write(chunk);
      });
    }
    child.on("error", (error) => resolve({ status: 1, stdout: text, error }));
    child.on("close", (code) => resolve({ status: code ?? 1, stdout: text }));
  });
}

/** Ejecuta y captura, sin heredar nada: para preguntar, no para trabajar. */
function capture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    ...options,
  });
  return {
    status: result.status ?? 1,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
    error: result.error,
  };
}

/** Deja un archivo de texto en el NAS, escribiéndolo por la conexión de SSH. */
function uploadText(path, text) {
  return capture("ssh", [...sshArgs(), `cat > ${shQuote(path)}`], {
    env: entornoSsh(),
    input: text,
  });
}

/**
 * Una orden que sí se ve: el progreso va a la terminal. Si falla, quien llama
 * decide qué decir; aquí solo se devuelve el resultado.
 */
const runVisible = (args, options = {}) =>
  stream("ssh", args, { env: entornoSsh(), ...options });

/**
 * La fecha del archivo más reciente dentro de una carpeta, en milisegundos;
 * `null` si ahí no hay nada que mirar. El código viaja al NAS con sus fechas —lo
 * empaqueta `tar`—, así que esta fecha es la del código que tiene el NAS: con la
 * de `src/convex` y la del último envío se sabe si al esquema le falta un viaje.
 */
function newestMtime(directory) {
  let newest = null;
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const path = join(directory, entry.name);
    let stamp = null;
    if (entry.isDirectory()) {
      stamp = newestMtime(path);
    } else {
      try {
        stamp = statSync(path).mtimeMs;
      } catch {
        stamp = null;
      }
    }
    if (stamp !== null && (newest === null || stamp > newest)) newest = stamp;
  }
  return newest;
}

/**
 * Todo lo que ha dicho SSH. Para **decidir** hay que mirarlo entero y no solo la
 * primera línea: un `ssh` que no puede entrar suelta antes otras cosas —la
 * advertencia de que la conexión no usa tal o cual cifrado, sin ir más lejos—, y el
 * motivo de verdad viene detrás.
 */
function textoDeSsh(result = {}) {
  return [result.stderr, result.stdout, result.error?.message]
    .filter(Boolean)
    .join("\n");
}

/**
 * Y lo que se le enseña a quien llama: la primera línea que dice algo. Las que
 * empiezan por `**` son advertencias de la conexión, no motivos por los que se ha
 * quedado fuera.
 */
function motivoDeSsh(result = {}) {
  const linea = [result.stderr, result.stdout]
    .filter(Boolean)
    .join("\n")
    .split(/\r?\n/)
    .map((one) => one.trim())
    .find((one) => one !== "" && !one.startsWith("**"));
  return linea ?? result.error?.message ?? "";
}

/**
 * ¿Se llega al NAS por SSH? Es lo primero de las tres formas de llamar —la puesta
 * en marcha, la comprobación y el doctor—, y lo único que no se puede intentar sin
 * conseguirlo. De aquí sale además la contraseña, cuando hace falta.
 *
 * Se comprueba **sin preguntar nada**: `BatchMode` convierte «hace falta
 * contraseña» en un fallo inmediato en vez de en una pregunta en la terminal, y eso
 * es lo que deja decidir aquí si hay que pedirla, cómo y cuándo. Una cuenta que
 * entra con clave SSH —o una ejecución desatendida— pasa por aquí sin teclear nada.
 *
 * Y si el NAS la pide, se teclea **una vez**: a ciegas, por esta terminal, y de ahí
 * sale todo lo demás —el ayudante de `ssh` y el `sudo` de dentro—, así que las siete
 * veces de antes se quedan en una. El segundo intento es lo que lo confirma: si el
 * NAS no la acepta, se dice aquí y no a mitad de camino, con el código a medias.
 */
async function ensureReachable() {
  const ping = capture(
    "ssh",
    ["-o", "BatchMode=yes", ...sshArgs(), "echo hola"],
    { env: entornoSsh() },
  );
  if (ping.status === 0) {
    ok(`entra ${destino} sin pedir contraseña`);
    return;
  }

  const dicho = textoDeSsh(ping);
  if (!haceFaltaClave(dicho) || !process.stdin.isTTY) {
    abort(
      `no he podido entrar en ${destino} por SSH`,
      [
        motivoDeSsh(ping),
        pistaDeEntrada(dicho),
        "Comprueba la dirección y el usuario, y que entras a mano con esa misma cuenta:",
        `«ssh ${destino}» tiene que dejarte en la línea del NAS.`,
        process.stdin.isTTY
          ? "Si ahí te pide la contraseña, aquí también te la va a pedir: se teclea igual."
          : "Sin terminal delante hace falta entrar con clave SSH (el NAS no puede preguntar nada).",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  console.log(c.dim(`   ${AVISO_ANTES}`));
  clave = await pedirClave();
  if (!clave) {
    abort(
      "no hay contraseña con la que entrar en el NAS",
      [
        "Se teclea a ciegas y no se ve nada mientras se escribe: vuelve a lanzar el comando",
        "y escríbela entera, o entra con clave SSH para no tener que teclearla.",
      ].join("\n"),
    );
  }

  // El ayudante es lo que hace que las demás conexiones no vuelvan a preguntar. Sin
  // él —el `ssh` de Windows, que no lo admite, o un `/tmp` donde no se puede
  // escribir— se dice y se sigue: preguntará cada conexión, como preguntaba antes.
  ayudante = admiteAyudante() ? prepararAyudante(clave) : null;
  if (!ayudante) console.log(c.dim(`   (${AVISO_SSH_SIN_AYUDANTE})`));

  const otra = capture(
    "ssh",
    ["-o", "BatchMode=no", ...sshArgs(), "echo hola"],
    { env: entornoSsh() },
  );
  if (otra.status !== 0) {
    const segundo = textoDeSsh(otra);
    abort(
      "el NAS no me ha dejado entrar con esa contraseña",
      [
        motivoDeSsh(otra),
        pistaDeEntrada(segundo),
        "Se teclea a ciegas, así que puede ser un despiste: vuelve a lanzar el comando.",
        `Y si «ssh ${destino}» no te pide contraseña, esa cuenta entra con clave: la del NAS`,
        "solo hace falta para sudo, y se pide cuando toque.",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  ok(
    `entra ${destino} (la contraseña, tecleada una vez para todas las conexiones)`,
  );
}

/**
 * La pista que toca cuando SSH no ha dejado entrar y el motivo no es la
 * contraseña. La de la clave del servidor es la que más se ve de las dos: la
 * conexión la desconoce hasta que alguien la acepta una vez a mano.
 */
function pistaDeEntrada(dicho = "") {
  if (/host key verification failed/i.test(dicho)) {
    return `Acepta antes la clave del NAS, que esta conexión no la tiene: «ssh ${destino}» una vez a mano y contesta que sí.`;
  }
  return "";
}

/* ------------------------------------------------------------------ */
/* --check: mirar cómo está el taller, sin tocar nada                  */
/* ------------------------------------------------------------------ */

if (config.check) {
  console.log(
    `\n${c.bold("Pulso Taller · cómo está el NAS")} ${c.dim(`· ${destinoLargo}`)}`,
  );
  console.log(
    c.dim(
      "Solo mira: los contenedores, el .env y si el esquema está al día. No construye, no arranca y no sube nada.",
    ),
  );

  step("Comprobar que se llega al NAS");
  await ensureReachable();

  step("Mirar el taller desde dentro del NAS");
  // El guion viaja por la conexión —troceado y en palabras sueltas, ver
  // `scriptWords`—, no se sube a ningún sitio: la comprobación no deja ni un
  // archivo en el NAS. Cuando la contraseña se ha tecleado, va delante de todo para
  // que el `sudo` de dentro la tenga y no pregunte nada.
  const result = await stream(
    "ssh",
    [
      ...sshArgs(ttyArgs()),
      ...scriptWords(checkScript({ root: config.root }), {
        clave: Boolean(clave),
      }),
    ],
    { capture: true, ...conEntradaDeClave() },
  );
  const summary = parseCheckResult(result.stdout);
  if (result.status !== 0 || !summary) {
    abort(
      "no he podido mirar cómo está el taller",
      [
        "Arriba está el motivo, tal como lo ha contado el NAS.",
        "Comprueba el host y la carpeta (--host, --path) y vuelve a intentarlo: la comprobación no toca nada, así que repetirla es gratis.",
      ].join("\n"),
    );
  }

  // La fecha del código de este ordenador: con ella y la del último envío se sabe
  // si al esquema le falta un viaje.
  const codeMtime = newestMtime(join(root, "src", "convex"));
  const report = checkReport(summary, { codeMtime });
  for (const line of checkPanelLines({
    host: config.host,
    user: config.user,
    root: config.root,
    result: summary,
    codeMtime,
    report,
  })) {
    console.log(line);
  }
  // El código de salida es el de la comprobación: 0 si todo está en pie y 1 si hay
  // algo que mirar, para que sirva también desde un guion.
  process.exit(report.every((finding) => finding.ok) ? 0 : 1);
}

/* ------------------------------------------------------------------ */
/* --doctor: el entorno del NAS, sin tocar nada                        */
/* ------------------------------------------------------------------ */

if (config.doctor) {
  console.log(
    `\n${c.bold("Pulso Taller · el entorno del NAS")} ${c.dim(`· ${destinoLargo}`)}`,
  );
  console.log(
    c.dim(
      "Solo mira el entorno: Docker y su sudo, Compose, los contenedores y dónde van las copias. No cambia nada.",
    ),
  );

  step("Comprobar que se llega al NAS");
  // La contraseña se teclea aquí, una sola vez y a ciegas (lo peor de pedirla es que
  // parezca que el comando se ha colgado, así que lo avisa `ensureReachable`).
  await ensureReachable();

  step("Mirar el entorno desde dentro del NAS");
  // El guion viaja por la conexión —troceado y en palabras sueltas, ver
  // `scriptWords`— y no deja ni un archivo en el NAS. En un Synology la cuenta normal
  // no habla con Docker, así que hay que poder usar `sudo`: con la contraseña ya
  // tecleada, el guion la recibe y no pregunta; sin ella se usa la seudo-terminal, y
  // sin terminal se miran solo las cosas que no necesitan permiso, diciendo lo que
  // ha quedado sin mirar.
  const result = await stream(
    "ssh",
    [
      ...sshArgs(ttyArgs()),
      ...scriptWords(
        doctorScript({
          root: config.root,
          interactive: Boolean(process.stdin.isTTY),
        }),
        { clave: Boolean(clave) },
      ),
    ],
    { capture: true, ...conEntradaDeClave() },
  );
  const summary = parseDoctorResult(result.stdout);
  if (result.status !== 0 || !summary) {
    abort(
      "no he podido mirar el entorno del NAS",
      [
        "Arriba está el motivo, tal como lo ha contado el NAS.",
        "Comprueba el host y la carpeta (--host, --path) y vuelve a intentarlo: el doctor no toca nada, así que repetirlo es gratis.",
      ].join("\n"),
    );
  }

  const report = doctorReport(summary, {
    reachable: true,
    host: config.host,
    user: config.user,
    port: config.port,
  });
  for (const line of doctorPanelLines({
    host: config.host,
    user: config.user,
    port: config.port,
    root: config.root,
    result: summary,
    report,
  })) {
    console.log(line);
  }
  // El código de salida es el del doctor: 0 si el entorno está listo y 1 si hay
  // algo que mirar, para que sirva también desde un guion.
  process.exit(report.every((finding) => finding.ok) ? 0 : 1);
}

/* ------------------------------------------------------------------ */
/* Paso a paso                                                        */
/* ------------------------------------------------------------------ */

console.log(
  `\n${c.bold("Pulso Taller en el NAS")} ${c.dim(`· ${destinoLargo}`)}`,
);
console.log(
  c.dim(
    "Los pasos 1 a 5 de SYNOLOGY.md, de una vez. Se puede repetir sin miedo: nada de esto toca los datos.",
  ),
);

step("Comprobar que se llega al NAS");
await ensureReachable();

step("Paso 1 — la carpeta del proyecto en el NAS");
{
  // La carpeta se crea como root (en DSM el usuario normal no puede escribir en
  // /volume1/docker) y se queda a nombre del usuario que entra, que es quien va a
  // escribir el resto. Es el paso 1 de la guía, con su `chown`.
  // Este paso va como un guion —y no como una orden suelta— para poder ponerle
  // delante el envoltorio de la clave: el `sudo` de aquí dentro también tiene que
  // saber de dónde leerla, igual que el de los guiones. Sin él, `sudo` contesta que
  // necesita una terminal para preguntarla, y ahí no hay ninguna (mira
  // `envoltorioClave`).
  const preparar = [
    envoltorioClave(),
    `sudo mkdir -p ${shQuote(config.root)}`,
    `sudo chown -R ${shQuote(config.user)} ${shQuote(config.root)}`,
    `mkdir -p ${shQuote(`${config.root}/.setup`)}`,
  ].join("\n");
  const result = await runVisible(
    [
      ...sshArgs(ttyArgs()),
      ...scriptWords(preparar, { clave: Boolean(clave) }),
    ],
    { capture: true, ...conEntradaDeClave() },
  );
  if (result.status !== 0) {
    abort(
      "no he podido preparar la carpeta del proyecto",
      [
        "Arriba está el motivo, tal como lo ha contado el NAS.",
        `Puede que la cuenta ${config.user} no pueda usar sudo en el NAS, o que la contraseña no sea la de esa cuenta.`,
        "La carpeta se puede crear a mano (paso 1 de SYNOLOGY.md) y volver a lanzar el comando.",
      ].join("\n"),
    );
  }
  ok(`${config.root} lista`);

  const compose = readFileSync(COMPOSE_FILE, "utf8");
  const upload = uploadText(
    `${config.root}/.setup/docker-compose.yml`,
    compose,
  );
  if (upload.status !== 0) {
    abort(
      "no he podido dejar el docker-compose.yml en el NAS",
      firstLine(upload.stderr) || firstLine(upload.error?.message),
    );
  }
  ok(
    "docker-compose.yml en su sitio (el del NAS se conserva si tiene cambios propios)",
  );
}

step("Paso 2 — la plantilla del .env");
{
  // El .env se escribe dentro del NAS, y solo si no está: lleva el secreto de la
  // instancia y la clave del backend, y esos no se tocan nunca. Aquí solo viaja la
  // plantilla del repositorio, con sus explicaciones, para que quede a mano.
  const example = readFileSync(ENV_EXAMPLE, "utf8");
  const upload = uploadText(`${config.root}/.setup/env.example`, example);
  if (upload.status !== 0) {
    abort(
      "no he podido dejar la plantilla del .env en el NAS",
      firstLine(upload.stderr) || firstLine(upload.error?.message),
    );
  }
  ok("plantilla en el NAS (el .env que ya exista no se pisa)");
}

step("Paso 3 — llevar el código");
{
  // Antes de empaquetar, el índice de módulos: `_generated/api.d.ts` es lo que
  // `tsc -b` lee para saber qué funciones existen. Si se quedó atrás —un módulo
  // nuevo sin regenerar, un módulo borrado que el índice sigue nombrando—, la
  // compilación falla **dentro del NAS**, al construir la imagen, que es donde ya
  // no se puede arreglar. Aquí es el último momento en el que arreglarlo es
  // barato, así que se para antes de mandar nada.
  const apiPath = join(root, "src", "convex", "_generated", "api.d.ts");
  let apiText = "";
  try {
    apiText = readFileSync(apiPath, "utf8");
  } catch {
    abort(
      "no encuentro el índice de módulos que la app necesita: src/convex/_generated/api.d.ts",
      [
        "Es código generado: lo escribe el CLI de Convex al desplegar, y sin él la app no compila.",
        "Con el backend local a mano: «npm run convex:up» y «npm run convex:push».",
        "O contra tu deployment: «npx convex codegen».",
      ].join("\n"),
    );
  }
  const verdict = apiModulesVerdict({
    modules: moduleNames(
      moduleEntries(join(root, "src", "convex"), {
        existsSync,
        readFileSync,
        readdirSync,
      }),
    ),
    listed: listedModules(apiText),
  });
  if (!verdict.ok) {
    abort(`no puedo llevar el código: ${verdict.detail}`, verdict.fix);
  }
  ok(verdict.detail);

  // Se manda comprimido por la misma conexión y se descomprime en una carpeta
  // nueva, que sustituye a la anterior solo si llegó entera. Lo que no viaja:
  // `node_modules/` (los binarios del ordenador no valen en el NAS), `dist/` (lo
  // construye la imagen) y `.env.local` (lleva la clave del entorno local).
  const code = await new Promise((resolve) => {
    const tar = spawn("tar", tarArgs("."), {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const ssh = spawn("ssh", [...sshArgs(), unpackCommand(config.root)], {
      cwd: root,
      env: entornoSsh(),
      stdio: ["pipe", "inherit", "inherit"],
    });
    // Lo que `tar` dice por su error se sigue viendo tal cual, y además se guarda:
    // sus avisos son los que distinguen un envío que fue bien de uno que no.
    let tarStderr = "";
    tar.stderr?.on("data", (chunk) => {
      tarStderr += chunk;
      process.stderr.write(chunk);
    });
    // Si la conexión se cae a mitad, la tubería avisa por los dos lados: sin esto
    // sería una traza de Node en vez del mensaje que viene después. Y con la
    // interrogación porque, si el comando no existe, no hay tubería que nada.
    tar.stdout?.on("error", () => {});
    ssh.stdin?.on("error", () => {});
    tar.stdout?.pipe(ssh.stdin);
    tar.on("error", (error) =>
      resolve({
        tar: { error, stderr: tarStderr },
        ssh: { status: 1, stderr: "" },
      }),
    );
    ssh.on("error", (error) =>
      resolve({ tar: { error: null }, ssh: { error, status: 1, stderr: "" } }),
    );
    let tarCode = null;
    let sshCode = null;
    ssh.on("close", (code) => {
      sshCode = { status: code ?? 1, stderr: "", error: null };
      if (tarCode) resolve({ tar: tarCode, ssh: sshCode });
    });
    tar.on("close", (code) => {
      tarCode = { status: code ?? 1, error: null, stderr: tarStderr };
      if (sshCode) resolve({ tar: tarCode, ssh: sshCode });
    });
  });
  if (code.tar?.error?.code === "ENOENT") {
    abort(
      "no encuentro el comando «tar» en el ordenador",
      "Instala tar (en Windows viene con Git, que ya usas para esta terminal) y vuelve a lanzar el comando.",
    );
  }
  // Y qué se hace con lo que ha dicho `tar` lo decide `packVerdict`, que se prueba
  // aparte: aquí solo queda manejar las tuberías.
  const empaquetado = packVerdict(code.tar);
  if (!empaquetado.ok) {
    abort(
      "no he podido empaquetar el código del proyecto",
      code.tar?.error?.message ?? empaquetado.reason,
    );
  }
  if (empaquetado.warning !== "") {
    console.log(
      c.dim(
        "   (tar avisó de .git: el git del ordenador estaba escribiendo mientras se empaquetaba; el código viaja igual)",
      ),
    );
  }
  if (code.ssh?.error || code.ssh?.status !== 0) {
    abort(
      "la conexión se ha cortado llevando el código",
      code.ssh?.error?.message ??
        "Vuelve a lanzar el comando: la carpeta anterior queda intacta hasta que el nuevo código llegue entero.",
    );
  }
  ok(`el código está en ${config.root}/codigo`);
}

step("Pasos 4 y 5 — construir, arrancar y desplegar");
{
  // El guion del NAS hace lo que queda: escribir el .env si falta, generar el
  // secreto, construir las imágenes, esperar al backend, pedirle la clave de
  // administrador y esperar a que el contenedor de las funciones termine.
  const script = setupScript({
    root: config.root,
    instance: config.instance,
    appUrl: config.appUrl,
    apiUrl: config.apiUrl,
    forceCompose: config.forceCompose,
    newKey: config.newKey,
    build: config.build,
  });
  const upload = uploadText(`${config.root}/.setup/setup.sh`, script);
  if (upload.status !== 0) {
    abort(
      "no he podido dejar el guion en el NAS",
      firstLine(upload.stderr) || firstLine(upload.error?.message),
    );
  }

  console.log(
    c.dim(
      "   (la primera vez tarda unos minutos: el NAS compila el sitio dentro de su propia imagen)",
    ),
  );
  const guion = `sh ${shQuote(`${config.root}/.setup/setup.sh`)}`;
  const result = await stream(
    "ssh",
    [...sshArgs(ttyArgs()), clave ? conClave(guion) : guion],
    { capture: true, ...conEntradaDeClave() },
  );
  const summary = parseSetupResult(result.stdout);
  if (result.status !== 0 || !summary) {
    abort(
      "la puesta en marcha no ha terminado",
      [
        "Arriba está el motivo, tal como lo ha contado el NAS. Lo que ya estaba hecho sigue hecho:",
        "vuelve a lanzar el comando cuando lo hayas mirado, o «npm run nas -- --new-key» si lo que",
        "falla es la clave de administrador.",
        `Lo que ha pasado, en detalle, está en el apartado «Problemas frecuentes» de SYNOLOGY.md.`,
      ].join("\n"),
    );
  }

  // El panel es lo último: se enseña aquí (y no desde el NAS) para que sea el
  // mismo texto siempre, y para que la última línea sea la URL de la app.
  const app = summary.app || config.appUrl;
  const api = summary.api || config.apiUrl;
  for (const line of panelLines({
    appUrl: app,
    apiUrl: api,
    host: config.host,
    user: config.user,
    root: config.root,
    result: summary,
    firstTime: summary.clave === "pedida",
  })) {
    console.log(line);
  }
}
