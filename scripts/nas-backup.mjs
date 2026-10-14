// La copia previa del taller, para lanzarla desde el ordenador antes de cada
// actualización:
//
//   npm run nas:backup -- --host IP-del-NAS
//
// Habla por SSH con el NAS —como `npm run nas` y `npm run nas:check`— y lanza
// allí `docker/synology/copia-previa.sh`, que es quien hace el trabajo: el export
// lógico (la base de datos y los archivos) y la copia en frío del volumen.
//
// El guion **viaja por la conexión**, como el de la comprobación: no se deja en
// el NAS y siempre es el de este repositorio, también la primera vez —cuando en
// el NAS todavía está el código de antes de tener este guion—. Se puede lanzar
// con el taller en marcha: no cambia datos, no toca el `.env` y no imprime
// ningún secreto.
//
// La contraseña del NAS se teclea **una sola vez**, y solo si hace falta: si la
// cuenta entra con clave SSH no se pide nada. Con ella entran todas las conexiones
// —por el ayudante de `ssh`— y también el `sudo` de dentro, que es quien hace el
// export y la copia en frío. Los detalles, en `nas-clave-lib.mjs`.
//
// Los valores de configuración se leen de los flags y, si no están, del entorno
// (`NAS_HOST`, `NAS_PATH`, `NAS_RESPALDOS`, `NAS_KEEP`, …), igual que en la
// puesta en marcha.
//
// La última línea que imprime es dónde han quedado las copias: es lo que se
// busca al terminar.

import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  backupWords,
  panelLines,
  parseBackupResult,
  resolveConfig,
  usage,
} from "./nas-backup-lib.mjs";
import { admiteAyudante, pedirClave, prepararAyudante } from "./nas-clave.mjs";
import {
  AVISO_ANTES,
  AVISO_SSH_SIN_AYUDANTE,
  haceFaltaClave,
} from "./nas-clave-lib.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

/** El guion que hace la copia, que se lanza dentro del NAS. */
const BACKUP_SCRIPT = join(root, "docker", "synology", "copia-previa.sh");

const c = {
  bold: (s) => `\u001b[1m${s}\u001b[0m`,
  dim: (s) => `\u001b[2m${s}\u001b[0m`,
  green: (s) => `\u001b[32m${s}\u001b[0m`,
  red: (s) => `\u001b[31m${s}\u001b[0m`,
  yellow: (s) => `\u001b[33m${s}\u001b[0m`,
};

let stepNumber = 0;
const step = (text) => console.log(`\n${c.bold(`${++stepNumber}. ${text}`)}`);

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
    "Mira «npm run nas:backup -- --help» para ver las opciones.",
  );
}

const destino = `${config.user}@${config.host}`;

/** Cómo se llama a SSH: puerto, sin colgarse y con la orden al final. */
const sshArgs = (extra = []) => [
  "-o",
  "ConnectTimeout=10",
  "-p",
  config.port,
  ...extra,
  destino,
];

// Con terminal delante se pide una seudo-terminal: es lo que hace que el `sudo`
// de dentro pueda pedir la contraseña. Sin terminal (una ejecución desatendida)
// se ahorra, porque no habría dónde teclearla.
//
// Y con la contraseña ya tecleada no se pide ninguna: lo que hay que hacer dentro
// del NAS no pregunta nada —el `sudo` de dentro la recibe por la entrada estándar,
// mira `envoltorioClave`—, así que una seudo-terminal solo serviría para que la
// clave cruzara por un sitio donde el NAS la repite en pantalla.
const ttyArgs = () => (clave ? ["-T"] : process.stdin.isTTY ? ["-t"] : ["-T"]);

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

/**
 * Ejecuta y hereda la salida, para que el progreso del NAS se vea mientras pasa;
 * con `capture` además se queda con lo que salió por la salida estándar —hace
 * falta para leer el resumen del guion— sin dejar de enseñarlo.
 */
function stream(
  command,
  args,
  { capture: keep = false, input = null, env = process.env } = {},
) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      stdio: [
        input === null ? "inherit" : "pipe",
        keep ? "pipe" : "inherit",
        "inherit",
      ],
    });
    // Lo que se le manda por la entrada —la contraseña del NAS, cuando toca— va de
    // una vez y se cierra: lo que hay dentro la lee y no se queda esperando nada.
    if (input !== null) child.stdin?.end(input);
    let text = "";
    if (keep && child.stdout) {
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
  const linea = textoDeSsh(result)
    .split(/\r?\n/)
    .map((one) => one.trim())
    .find((one) => one !== "" && !one.startsWith("**"));
  return linea ?? result.error?.message ?? "";
}

/**
 * ¿Se llega al NAS por SSH? Es lo primero de la copia y lo único que no se puede
 * intentar sin conseguirlo. De aquí sale además la contraseña, cuando hace falta.
 *
 * Se comprueba **sin preguntar nada**: `BatchMode` convierte «hace falta
 * contraseña» en un fallo inmediato en vez de en una pregunta en la terminal, y eso
 * es lo que deja decidir aquí si hay que pedirla, cómo y cuándo. Una cuenta que
 * entra con clave SSH —o una ejecución desatendida— pasa por aquí sin teclear nada.
 *
 * Y si el NAS la pide, se teclea **una vez**: a ciegas, por esta terminal, y de ahí
 * sale todo lo demás —el ayudante de `ssh` y el `sudo` de dentro, que es quien hace
 * el export y la copia en frío—, así que las veces de antes se quedan en una. El
 * segundo intento es lo que lo confirma: si el NAS no la acepta, se dice aquí y no
 * a mitad de camino, con el backend parado a medias.
 */
async function ensureReachable() {
  const ping = capture(
    "ssh",
    ["-o", "BatchMode=yes", ...sshArgs(), "echo hola"],
    { env: entornoSsh() },
  );
  if (ping.status === 0) {
    console.log(`   ${c.green("✓")} entra ${destino} sin pedir contraseña`);
    return;
  }

  const dicho = textoDeSsh(ping);
  if (!haceFaltaClave(dicho) || !process.stdin.isTTY) {
    abort(
      `no he podido entrar en ${destino} por SSH`,
      [
        motivoDeSsh(ping) || firstLine(ping.stdout),
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
    abort(
      "el NAS no me ha dejado entrar con esa contraseña",
      [
        motivoDeSsh(otra),
        "Se teclea a ciegas, así que puede ser un despiste: vuelve a lanzar el comando.",
        `Y si «ssh ${destino}» no te pide contraseña, esa cuenta entra con clave: la del NAS`,
        "solo hace falta para sudo, y se pide cuando toque.",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  console.log(
    `   ${c.green("✓")} entra ${destino} (la contraseña, tecleada una vez para todas las conexiones)`,
  );
}

console.log(
  `\n${c.bold("Pulso Taller · copia previa del NAS")} ${c.dim(`· ${destino}`)}`,
);
console.log(
  c.dim(
    "El export lógico y la copia en frío del volumen, en el NAS. No cambia datos ni imprime secretos.",
  ),
);

step("Comprobar que se llega al NAS");
await ensureReachable();

step("Copiar el taller desde dentro del NAS");
// El guion vive en el repositorio y viaja por la conexión: no se deja en el NAS
// ni depende de la versión del código que haya allí ahora mismo. Cómo viaja
// —troceado, en palabras sueltas y con lo que hay que copiar dentro— lo arma
// `backupWords`, que es la parte que se puede probar sin un NAS delante.
const guion = readFileSync(BACKUP_SCRIPT, "utf8");
const orden = backupWords({
  script: guion,
  root: config.path,
  backups: config.backups,
  keep: config.keep,
  clave: Boolean(clave),
});

const result = await stream("ssh", [...sshArgs(ttyArgs()), ...orden], {
  capture: true,
  ...conEntradaDeClave(),
});
const summary = parseBackupResult(result.stdout);
if (result.status !== 0 || !summary) {
  abort(
    "la copia no ha terminado bien",
    [
      "Arriba está el motivo, tal como lo ha contado el NAS.",
      "Volver a lanzarlo es seguro: cada copia lleva su fecha, así que no se pisa nada. Si el backend se quedó parado, arráncalo en el NAS con «docker compose start backend».",
    ].join("\n"),
  );
}

for (const line of panelLines({
  host: config.host,
  user: config.user,
  path: summary.raiz ?? config.path,
  backups: summary.respaldos ?? config.backups,
  result: summary,
})) {
  console.log(line);
}
