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
  panelLines,
  parseBackupResult,
  resolveConfig,
  usage,
} from "./nas-backup-lib.mjs";
import { shQuote } from "./nas-setup-lib.mjs";

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
const ttyArgs = process.stdin.isTTY ? ["-t"] : ["-T"];

/** Ejecuta y captura, sin heredar nada: para preguntar, no para trabajar. */
function capture(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" });
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
function stream(command, args, { capture: keep = false } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: ["inherit", keep ? "pipe" : "inherit", "inherit"],
    });
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
 * ¿Se llega al NAS por SSH? Delante de una terminal se deja preguntar la
 * contraseña; en una ejecución desatendida —sin terminal— se pide `BatchMode`,
 * que convierte una clave que falta en un fallo inmediato en vez de en una
 * pregunta esperando para siempre. Es la misma regla que en la puesta en marcha.
 */
function ensureReachable() {
  const preflight = [...sshArgs(), "echo hola"];
  if (!process.stdin.isTTY) preflight.unshift("-o", "BatchMode=yes");
  const ping = capture("ssh", preflight);
  if (ping.status !== 0) {
    abort(
      `no he podido entrar en ${destino} por SSH`,
      [
        firstLine(ping.stderr) ||
          firstLine(ping.stdout) ||
          ping.error?.message ||
          "",
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
  console.log(`   ${c.green("✓")} entra ${destino}`);
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
ensureReachable();

step("Copiar el taller desde dentro del NAS");
// El guion vive en el repositorio y viaja por la conexión: no se deja en el NAS
// ni depende de la versión del código que haya allí ahora mismo. Las opciones se
// le pasan como argumentos (el primero es su `$0`).
const guion = readFileSync(BACKUP_SCRIPT, "utf8");
const orden = [
  `sh -c ${shQuote(guion)}`,
  "copia-previa",
  "--raiz",
  shQuote(config.path),
  "--respaldos",
  shQuote(config.backups),
  "--conservar",
  shQuote(config.keep),
].join(" ");

const result = await stream("ssh", [...sshArgs(ttyArgs), orden], {
  capture: true,
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
