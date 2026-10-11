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
// Los valores de configuración se leen de los flags y, si no están, del entorno
// (`NAS_HOST`, `NAS_PATH`, …), para no teclear el host del NAS en cada arranque.
//
// La última línea que imprime es la URL de la app: al terminar, lo que se busca es
// dónde entrar.

import { spawn, spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkPanelLines,
  checkReport,
  checkScript,
  panelLines,
  parseCheckResult,
  parseSetupResult,
  resolveConfig,
  setupScript,
  shQuote,
  tarArgs,
  unpackCommand,
  usage,
} from "./nas-setup-lib.mjs";

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
const ttyArgs = process.stdin.isTTY ? ["-t"] : ["-T"];

/**
 * Ejecuta un comando y hereda la salida, para que el progreso se vea mientras
 * pasa. Con `capture` además se queda con lo que salió por la salida estándar
 * —hace falta para leer el resumen del guion del NAS— sin dejar de enseñarlo.
 */
function stream(command, args, { capture = false } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: ["inherit", capture ? "pipe" : "inherit", "inherit"],
    });
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
    input: text,
  });
}

/**
 * Una orden que sí se ve: el progreso va a la terminal. Si falla, quien llama
 * decide qué decir; aquí solo se devuelve el resultado.
 */
const runVisible = (args) => stream("ssh", args);

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
 * ¿Se llega al NAS por SSH? Es lo primero de las dos formas de llamar —la
 * puesta en marcha y la comprobación—, y lo único que no se puede intentar sin
 * conseguirlo. Delante de una terminal se deja preguntar la contraseña: en un
 * Synology hay quien entra con clave y quien entra con contraseña, y no se obliga
 * a nadie a montar claves para poner el taller en pie. En una ejecución
 * desatendida —sin terminal— se pide `BatchMode`, que es lo que convierte una
 * clave que falta en un fallo inmediato en vez de en una pregunta esperando para
 * siempre.
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
  ok(`entra ${destino}`);
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
  ensureReachable();

  step("Mirar el taller desde dentro del NAS");
  // El guion viaja como argumento de la conexión, no se sube a ningún sitio: la
  // comprobación no deja ni un archivo en el NAS. Hereda la terminal para que el
  // `sudo` de dentro pueda preguntar la contraseña si Docker la pide.
  const result = await stream(
    "ssh",
    [
      ...sshArgs(ttyArgs),
      `sh -c ${shQuote(checkScript({ root: config.root }))}`,
    ],
    { capture: true },
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
ensureReachable();

step("Paso 1 — la carpeta del proyecto en el NAS");
{
  // La carpeta se crea como root (en DSM el usuario normal no puede escribir en
  // /volume1/docker) y se queda a nombre del usuario que entra, que es quien va a
  // escribir el resto. Es el paso 1 de la guía, con su `chown`.
  const mkdir = [
    `sudo mkdir -p ${shQuote(config.root)}`,
    `sudo chown -R ${shQuote(config.user)} ${shQuote(config.root)}`,
    `mkdir -p ${shQuote(`${config.root}/.setup`)}`,
  ].join(" && ");
  const result = await runVisible([...sshArgs(ttyArgs), mkdir]);
  if (result.status !== 0) {
    abort(
      "no he podido preparar la carpeta del proyecto",
      `Puede que la cuenta ${config.user} no pueda usar sudo en el NAS. Crea la carpeta a mano (paso 1 de SYNOLOGY.md) y vuelve a lanzar el comando.`,
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
  // Se manda comprimido por la misma conexión y se descomprime en una carpeta
  // nueva, que sustituye a la anterior solo si llegó entera. Lo que no viaja:
  // `node_modules/` (los binarios del ordenador no valen en el NAS), `dist/` (lo
  // construye la imagen) y `.env.local` (lleva la clave del entorno local).
  const code = await new Promise((resolve) => {
    const tar = spawn("tar", tarArgs("."), {
      cwd: root,
      stdio: ["ignore", "pipe", "inherit"],
    });
    const ssh = spawn("ssh", [...sshArgs(), unpackCommand(config.root)], {
      cwd: root,
      stdio: ["pipe", "inherit", "inherit"],
    });
    // Si la conexión se cae a mitad, la tubería avisa por los dos lados: sin esto
    // sería una traza de Node en vez del mensaje que viene después. Y con la
    // interrogación porque, si el comando no existe, no hay tubería que nada.
    tar.stdout?.on("error", () => {});
    ssh.stdin?.on("error", () => {});
    tar.stdout?.pipe(ssh.stdin);
    tar.on("error", (error) =>
      resolve({ tar: { error }, ssh: { status: 1, stderr: "" } }),
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
      tarCode = { status: code ?? 1, error: null };
      if (sshCode) resolve({ tar: tarCode, ssh: sshCode });
    });
  });
  if (code.tar?.error?.code === "ENOENT") {
    abort(
      "no encuentro el comando «tar» en el ordenador",
      "Instala tar (en Windows viene con Git, que ya usas para esta terminal) y vuelve a lanzar el comando.",
    );
  }
  if (code.tar?.error || code.tar?.status !== 0) {
    abort(
      "no he podido empaquetar el código del proyecto",
      code.tar?.error?.message ?? `tar salió con ${code.tar?.status}`,
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
  const result = await stream(
    "ssh",
    [...sshArgs(ttyArgs), `sh ${shQuote(`${config.root}/.setup/setup.sh`)}`],
    { capture: true },
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
