import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";

/**
 * El paso de instalación del contenedor `funciones`: dejar creada la cuenta de
 * administrador cuando la base todavía no tiene ninguna y **sin cargar ningún
 * dato de ejemplo**. Es la mitad que se ejecuta dentro del NAS
 * (`docker/synology/funciones-lib.sh`), y se prueba de verdad —no leyendo el
 * archivo, que diría poco—: se ejecuta con `sh` y un **doble del CLI de Convex**
 * en el `PATH`, que responde a la consulta de cuentas y apunta lo que se le pide.
 *
 * Lo que hay que comprobar, y por qué importa:
 *
 *  - que con la base sin cuentas cree una (la de la guía o la del `.env`);
 *  - que en un taller que ya tiene cuentas **no toque nada**, porque el
 *    contenedor se vuelve a arrancar en cada puesta en marcha;
 *  - que con `PULSO_INSTALL=no` no llame siquiera al CLI;
 *  - que no se cargue nunca la muestra (el taller de producción arranca vacío) y
 *    que no salga ninguna contraseña por la salida.
 */

const root = fileURLToPath(new URL("..", import.meta.url));

/** El guion del NAS, tal cual vive en el repositorio. */
const LIB = join(root, "docker", "synology", "funciones-lib.sh");

/** Windows → la ruta que entiende el `sh` de Git Bash (`/c/Users/...`). */
const shPath = (path: string) =>
  path
    .replace(/\\/g, "/")
    .replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`);

/** ¿Hay un `sh` de verdad con sus herramientas? Sin él, la prueba no corre. */
const shListo =
  spawnSync("sh", ["-c", "command -v printf tr"], { encoding: "utf8" })
    .status === 0;

/** El texto de un archivo, o vacío si no existe (no se creó). */
const leer = (path: string) => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
};

/** Las líneas con algo de un texto. */
const lineas = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");

interface Equipo {
  base: string;
  bin: string;
  llamadas: string;
  store: string;
  marca: string;
}

/**
 * Un taller de mentira: una carpeta temporal con el doble del CLI y sus archivos
 * de registro. El doble solo entiende lo que usa este paso —la consulta de
 * cuentas y el `auth:store`— y lo demás lo ignora.
 */
function montarEquipo(): Equipo {
  const base = mkdtempSync(join(tmpdir(), "pulso-instalacion-"));
  const bin = join(base, "bin");
  mkdirSync(bin);

  const doble = [
    "#!/bin/sh",
    "# Doble del CLI de Convex: apunta lo que se le pide y responde a lo justo.",
    'printf "%s\\n" "$*" >> "$PULSO_LLAMADAS"',
    'case "$*" in',
    "  *--inline-query*)",
    '    if [ -f "$PULSO_MARCA" ]; then',
    "      # Después de crear la cuenta el taller ya tiene una.",
    '      printf "%s\\n" "${PULSO_CUENTAS_DESPUES:-1}"',
    "    else",
    '      : > "$PULSO_MARCA"',
    '      printf "%s\\n" "${PULSO_CUENTAS:-0}"',
    "    fi",
    "    ;;",
    "  *auth:store*)",
    '    printf "%s\\n" "$*" >> "$PULSO_STORE"',
    '    [ -z "${PULSO_FALLA_STORE:-}" ] || exit 1',
    "    ;;",
    "esac",
    "exit 0",
    "",
  ].join("\n");

  const node = join(bin, "node");
  writeFileSync(node, doble);
  chmodSync(node, 0o755);

  return {
    base,
    bin,
    llamadas: join(base, "llamadas.log"),
    store: join(base, "store.log"),
    marca: join(base, "marca"),
  };
}

const equipos: string[] = [];

/** Un equipo nuevo, que se borra al terminar la prueba. */
const conEquipo = () => {
  const equipo = montarEquipo();
  equipos.push(equipo.base);
  return equipo;
};

afterAll(() => {
  for (const base of equipos) rmSync(base, { recursive: true, force: true });
});

/**
 * Ejecuta el paso de instalación como lo hace el contenedor: leyendo el guion con
 * `.` y llamando a `crear_cuenta_de_administrador`, con los dobles delante.
 */
function instalar(equipo: Equipo, entorno: Record<string, string> = {}) {
  const cadena = [
    `export PATH='${shPath(equipo.bin)}':"$PATH"`,
    "export PREFIJO=prueba",
    `export PULSO_LLAMADAS='${shPath(equipo.llamadas)}'`,
    `export PULSO_STORE='${shPath(equipo.store)}'`,
    `export PULSO_MARCA='${shPath(equipo.marca)}'`,
    ...Object.entries(entorno).map(
      ([clave, valor]) => `export ${clave}='${valor}'`,
    ),
    `. '${shPath(LIB)}'`,
    "crear_cuenta_de_administrador",
  ].join("\n");
  const result = spawnSync("sh", ["-c", cadena], { encoding: "utf8" });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    llamadas: lineas(leer(equipo.llamadas)),
    peticiones: lineas(leer(equipo.store)),
  };
}

describe.skipIf(!shListo)("la instalación del taller, de verdad", () => {
  test("con la base sin cuentas deja la cuenta de administrador creada", () => {
    const equipo = conEquipo();
    const run = instalar(equipo, { PULSO_CUENTAS: "0" });

    expect(run.status).toBe(0);
    expect(run.stdout).toContain("cuenta de administrador lista");
    // Una sola llamada al store, con el correo de la guía y como administrador.
    expect(run.peticiones).toHaveLength(1);
    expect(run.peticiones[0]).toContain(
      '"type":"createAccountFromCredentials"',
    );
    expect(run.peticiones[0]).toContain('"email":"admin@taller.es"');
    expect(run.peticiones[0]).toContain('"role":"admin"');
    expect(run.peticiones[0]).toContain('"active":true');
  });

  test("no carga ningún dato de ejemplo: el taller arranca vacío", () => {
    const equipo = conEquipo();
    instalar(equipo, { PULSO_CUENTAS: "0" });

    // Las únicas órdenes son las dos consultas de cuentas y el alta: por ahí no
    // pasa ninguna semilla.
    expect(
      lineas(leer(equipo.llamadas)).filter((linea) => linea.includes("seed")),
    ).toEqual([]);
    // Ni aparece en la salida del paso.
    const run = instalar(conEquipo(), { PULSO_CUENTAS: "0" });
    expect(run.stdout).not.toContain("seed");
    expect(run.stdout).not.toContain("muestra");
    expect(run.stdout).toContain("sin datos de ejemplo");
  });

  test("en un taller que ya tiene cuentas no toca nada", () => {
    const equipo = conEquipo();
    const run = instalar(equipo, { PULSO_CUENTAS: "3" });

    expect(run.status).toBe(0);
    expect(run.stdout).toContain("ya tiene cuentas (3)");
    // No se le pidió ninguna cuenta al backend.
    expect(leer(equipo.store)).toBe("");
  });

  test("con PULSO_INSTALL=no no llama siquiera al CLI", () => {
    const equipo = conEquipo();
    const run = instalar(equipo, { PULSO_INSTALL: "no" });

    expect(run.status).toBe(0);
    expect(run.stdout).toContain("no se crea ninguna cuenta");
    expect(run.llamadas).toEqual([]);
  });

  test("las credenciales del .env son las que se usan", () => {
    const equipo = conEquipo();
    const run = instalar(equipo, {
      PULSO_CUENTAS: "0",
      ADMIN_EMAIL: "jefa@taller.es",
      ADMIN_PASSWORD: "unacontrasena",
    });

    expect(run.status).toBe(0);
    expect(run.peticiones[0]).toContain('"email":"jefa@taller.es"');
    expect(run.peticiones[0]).toContain('"secret":"unacontrasena"');
  });

  test("una contraseña corta se rechaza antes de llamar al backend", () => {
    const equipo = conEquipo();
    const run = instalar(equipo, {
      PULSO_CUENTAS: "0",
      ADMIN_PASSWORD: "corta",
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("al menos 8 caracteres");
    expect(leer(equipo.store)).toBe("");
  });

  test("unas credenciales con comillas se rechazan, no se crean a medias", () => {
    const equipo = conEquipo();
    const run = instalar(equipo, {
      PULSO_CUENTAS: "0",
      ADMIN_EMAIL: 'ad"min@taller.es',
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("comillas");
    expect(leer(equipo.store)).toBe("");
  });

  test("si el backend no acepta el alta, no la da por creada", () => {
    const equipo = conEquipo();
    const run = instalar(equipo, {
      PULSO_CUENTAS: "0",
      PULSO_FALLA_STORE: "1",
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("no se ha podido crear la cuenta");
    // Se intentó una vez y no se dio nada por hecho.
    expect(run.peticiones).toHaveLength(1);
    expect(run.stdout).not.toContain("cuenta de administrador lista");
  });

  test("ninguna contraseña sale por la salida", () => {
    const run = instalar(conEquipo(), {
      PULSO_CUENTAS: "0",
      ADMIN_EMAIL: "jefa@taller.es",
      ADMIN_PASSWORD: "secreto-de-prueba",
    });

    expect(run.status).toBe(0);
    expect(run.stdout).not.toContain("secreto-de-prueba");
    expect(run.stderr).not.toContain("secreto-de-prueba");
  });
});
