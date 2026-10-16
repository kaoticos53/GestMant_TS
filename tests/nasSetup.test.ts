import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";
import {
  DEFAULT_PROJECT_PATH,
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
  setupScript,
  shQuote,
  packVerdict,
  tarArgs,
  tarOnlyGitWarnings,
  unpackCommand,
} from "../scripts/nas-setup-lib.mjs";

/**
 * La puesta en marcha del NAS (`scripts/nas-setup.mjs`) habla por SSH con un
 * Synology: no se puede importar en una prueba sin intentar conectarse a un NAS
 * que no está. Por eso lo que se prueba aquí son las piezas puras de
 * `scripts/nas-setup-lib.mjs` —la configuración, el panel y lo que se le manda—
 * y, además, **el guion que se ejecuta dentro del NAS se ejecuta de verdad**,
 * contra una carpeta temporal y con dobles de `docker`, `curl` y compañía en el
 * `PATH`. Es la única forma de comprobar lo que de verdad importa: que
 * lanzarlo dos veces no cambia nada.
 */

const root = fileURLToPath(new URL("..", import.meta.url));

/** Windows → la ruta que entiende el `sh` de Git Bash (`/c/Users/...`). */
const shPath = (path: string) =>
  path
    .replace(/\\/g, "/")
    .replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`);

/** ¿Hay un `sh` de verdad con sus herramientas? Sin él, la prueba de verdad no corre. */
const shListo =
  process.platform !== "win32" &&
  spawnSync("sh", ["-c", "command -v tar sed grep awk cmp tail head tr od"], {
    encoding: "utf8",
  }).status === 0;

/**
 * Los guiones que se lanzan de verdad tardan lo suyo: una puesta en marcha ronda
 * los tres segundos —los procesos que abre y las esperas que se toma— y hay
 * pruebas que la hacen dos veces. El límite de Vitest, cinco segundos, se queda
 * corto en cuanto la máquina tiene algo más que hacer, y entonces falla la
 * prueba por lo que tarda el ordenador, no por lo que hace el guion.
 */
const DE_VERDAD = { timeout: 30_000 };

/** Las líneas con algo de un texto, que es como se leen los resúmenes. */
const lineas = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");

/** Lee el valor de una clave del `.env`, tal y como viaja al NAS. */
const valor = (env: string, clave: string) =>
  new RegExp(`^${clave}=(.*)$`, "m").exec(env)?.[1] ?? "";

/**
 * Todo lo que hay dentro de una carpeta, con su tamaño: la huella que deja en el
 * NAS lo que se ejecuta allí. Sirve para comprobar que la comprobación no escribe
 * nada: la huella de antes y la de después tienen que ser la misma.
 */
function rastro(directory: string, prefijo = ""): string[] {
  const lines: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relative = prefijo === "" ? entry.name : `${prefijo}/${entry.name}`;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      lines.push(...rastro(path, relative));
    } else {
      lines.push(`${relative}:${statSync(path).size}`);
    }
  }
  return lines.sort();
}

describe("la configuración del comando", () => {
  test("sin nada, solo el host es obligatorio: lo demás tiene valores de partida", () => {
    const config = resolveConfig(["--host", "192.168.1.20"], {});
    expect(config.errors).toEqual([]);
    expect(config).toMatchObject({
      host: "192.168.1.20",
      user: "admin",
      port: "22",
      root: DEFAULT_PROJECT_PATH,
      instance: "pulso-taller",
      forceCompose: false,
      newKey: false,
      build: true,
    });
  });

  test("el entorno pone las direcciones y el proyecto; los flags mandan sobre él", () => {
    const config = resolveConfig(
      ["--host", "nas.local", "--path", "/volume2/taller/"],
      {
        NAS_USER: "kaoti",
        NAS_PORT: "2222",
        NAS_PATH: "/volume1/otra",
        NAS_APP_URL: "https://taller.mi-taller.es",
        NAS_API_URL: "https://api.mi-taller.es/",
      },
    );
    expect(config.errors).toEqual([]);
    expect(config.user).toBe("kaoti");
    expect(config.port).toBe("2222");
    // La barra del final se cae: dos formas de escribir lo mismo no pueden dar
    // dos carpetas distintas.
    expect(config.root).toBe("/volume2/taller");
    expect(config.apiUrl).toBe("https://api.mi-taller.es");
  });

  test("se aceptan las dos formas de dar un valor", () => {
    const conIgual = resolveConfig(["--host=nas.local"], {});
    const conEspacio = resolveConfig(["--host", "nas.local"], {});
    expect(conIgual.errors).toEqual([]);
    expect(conIgual.host).toBe(conEspacio.host);
  });

  test("no empieza con una configuración a medias: lo dice todo junto", () => {
    const config = resolveConfig(
      [
        "--host",
        "admin@192.168.1.20",
        "--port",
        "setenta",
        "--api-url",
        "https://api.es/ruta",
      ],
      {},
    );
    expect(config.errors.length).toBe(3);
    expect(config.errors.join(" ")).toContain("solo la dirección");
    expect(config.errors.join(" ")).toContain("el puerto de SSH no vale");
    expect(config.errors.join(" ")).toContain("sin camino ni barra al final");
  });

  test("las opciones de interruptor no piden valor, y una desconocida se avisa", () => {
    const config = resolveConfig(
      [
        "--host",
        "nas.local",
        "--force-compose",
        "--new-key",
        "--no-build",
        "--inventado",
      ],
      {},
    );
    expect(config.forceCompose).toBe(true);
    expect(config.newKey).toBe(true);
    expect(config.build).toBe(false);
    expect(config.errors).toEqual(["no conozco la opción --inventado"]);
  });

  test("con --help no hace falta nada más", () => {
    const config = resolveConfig(["--help"], {});
    expect(config.help).toBe(true);
    expect(config.errors).toEqual([]);
  });
});

describe("lo que se le manda al NAS", () => {
  test("el código viaja sin lo que no vale fuera del ordenador", () => {
    expect(tarArgs(".")).toEqual([
      "-C",
      ".",
      "-czf",
      "-",
      "--exclude=./node_modules",
      "--exclude=./dist",
      "--exclude=./.env.local",
      ".",
    ]);
  });

  test("un aviso de git escribiendo a mitad del envío no para la puesta en marcha", () => {
    // Es lo que dice `tar` de verdad —y sale con 1— cuando el git del ordenador
    // reescribe su índice mientras el código va viajando: el archivo llega igual y
    // lo único que cambia es el código de salida. Sin dejarlo pasar, el envío se
    // caía antes de construir nada y el NAS se quedaba con el código de antes.
    const conAviso = packVerdict({
      status: 1,
      stderr: "tar: ./.git: file changed as we read it\n",
    });
    expect(conAviso.ok).toBe(true);
    expect(conAviso.warning).not.toBe("");
    // Las dos formas que tiene el mismo aviso: la carpeta `.git` y un archivo de
    // dentro (el índice que reescribe git).
    expect(
      tarOnlyGitWarnings("tar: ./.git/index: file changed as we read it"),
    ).not.toBe("");

    // Lo que sí corta: el aviso de `.git` acompañado de cualquier otra queja...
    const conError = packVerdict({
      status: 1,
      stderr:
        "tar: ./.git: file changed as we read it\ntar: ./src: Cannot stat: No such file or directory",
    });
    expect(conError.ok).toBe(false);
    expect(conError.reason).toBe("tar salió con 1");
    // ...un archivo del código a medias (con `tar` avisando y siguiendo, eso sí
    // que no puede pasar: lo que se subiría podría estar a medias)...
    expect(
      packVerdict({
        status: 1,
        stderr: "tar: ./src/main.ts: file changed as we read it",
      }).ok,
    ).toBe(false);
    // ...y un `tar` que no está, o que falla sin decir nada de git.
    expect(packVerdict({ error: new Error("spawn tar ENOENT") }).ok).toBe(false);
    expect(packVerdict({ status: 2, stderr: "" }).ok).toBe(false);
    // Y el envío bueno, que es el de casi siempre.
    expect(packVerdict({ status: 0 })).toEqual({
      ok: true,
      warning: "",
      reason: "",
    });
  });

  test("el código nuevo sustituye al viejo solo cuando ha llegado entero", () => {
    const orden = unpackCommand("/volume1/docker/pulso-taller");
    expect(orden).toContain(
      "tar xzf - -C /volume1/docker/pulso-taller/codigo.nuevo",
    );
    // La carpeta anterior se guarda, y solo se tira cuando la nueva ya está en su
    // sitio: un corte a mitad deja el proyecto como estaba.
    expect(
      orden.indexOf("mv /volume1/docker/pulso-taller/codigo.nuevo"),
    ).toBeLessThan(
      orden.lastIndexOf("rm -rf /volume1/docker/pulso-taller/codigo.viejo"),
    );
    expect(orden).toContain("[ ! -d /volume1/docker/pulso-taller/codigo ]");
  });

  test("un valor con comillas no rompe la orden que viaja", () => {
    expect(shQuote("d'on't")).toBe(`'d'\\''on'\\''t'`);
  });

  test("el guion del NAS lleva los pasos 1 a 5, en orden y sin la clave", () => {
    const guion = setupScript({
      root: "/volume1/docker/pulso-taller",
      appUrl: "https://taller.mi-taller.es",
      apiUrl: "https://api.mi-taller.es",
      forceCompose: true,
      newKey: true,
      build: false,
    });
    const sitios = [
      "Paso 1: el docker-compose.yml",
      "Paso 2: el .env",
      "Paso 4: construir y arrancar",
      "Paso 5: la clave de administrador",
    ].map((titulo) => guion.indexOf(titulo));
    for (const sitio of sitios) expect(sitio).toBeGreaterThan(-1);
    expect(sitios).toEqual([...sitios].sort((a, b) => a - b));
    // Las direcciones y los interruptores viajan escritos dentro, entre comillas.
    expect(guion).toContain("API_URL='https://api.mi-taller.es'");
    expect(guion).toContain("APP_URL='https://taller.mi-taller.es'");
    expect(guion).toContain("FORZAR_COMPOSE='si'");
    expect(guion).toContain("CLAVE_NUEVA='si'");
    expect(guion).toContain("CONSTRUIR='no'");
    // Sin direcciones de ejemplo, el guion no se queda a medias: para.
    expect(guion).toContain("https://api.tudominio.com");
    expect(guion).toContain("PULSO_SETUP");
    // sh, no bash: en el NAS no hay bash de sobra.
    expect(guion.split("\n")[0]).toBe("#!/bin/sh");
  });

  test("el resumen del guion se lee aunque venga con la seudo-terminal del SSH", () => {
    const salida = [
      "nas: colocando el .env",
      "PULSO_SETUP env=si secreto=si clave=pedida compose=colocado",
      "nas: los contenedores estan en pie",
      "PULSO_SETUP env=no secreto=no clave=conservada compose=igual\r",
    ].join("\r\n");
    // Manda el último: es el que dice cómo ha quedado todo al terminar.
    expect(parseSetupResult(salida)).toEqual({
      env: "no",
      secreto: "no",
      clave: "conservada",
      compose: "igual",
    });
  });

  test("el binario de Docker se busca por su ruta, no se da por hecho en el PATH", () => {
    // El `sudo` de un Synology impone su propio PATH —sin `/usr/local/bin`, que
    // es donde vive el binario—, así que `sudo docker` contesta «command not
    // found» con el taller en pie. Los dos guiones buscan el binario antes de
    // usarlo y lo llaman después por la ruta que aparezca.
    for (const guion of [setupScript({}), checkScript({})]) {
      expect(guion).toContain('command -v "$1"');
      expect(guion).toContain('"/usr/local/bin/$1"');
      expect(guion).toContain("DOCKER=$(buscar_binario docker");
      expect(guion).toContain("$DOCKER info");
      // Nunca a secas: era justo lo que fallaba.
      expect(guion).not.toContain("$SUDO docker ");
    }
  });

  test("sin resumen, no hay resumen: no se inventa uno", () => {
    expect(parseSetupResult("nas: algo se torció")).toBeNull();
    expect(parseSetupResult("")).toBeNull();
  });
});

describe("el panel final", () => {
  test("termina siempre en la URL de la app, pase lo que pase", () => {
    const casos = [
      {},
      { env: "si", secreto: "si", clave: "pedida", compose: "colocado" },
      { compose: "conservado", funciones: "sin-arrancar", construido: "no" },
      { funciones: "sigue" },
    ];
    for (const result of casos) {
      const lines = panelLines({
        appUrl: "https://taller.mi-taller.es",
        apiUrl: "https://api.mi-taller.es",
        host: "192.168.1.20",
        user: "admin",
        result,
      });
      expect(lines.at(-1)).toBe("  Abre la app en https://taller.mi-taller.es");
      expect(lines.join("\n")).toContain("paso 6");
      // Y siempre se dice dónde vive el proyecto, que es a donde se vuelve.
      expect(lines.join("\n")).toContain(
        "admin@192.168.1.20:/volume1/docker/pulso-taller",
      );
    }
  });

  test("cuenta lo que ha pasado en cada caso, y la primera vez lo dice", () => {
    const texto = panelLines({
      appUrl: "https://taller.mi-taller.es",
      apiUrl: "https://api.mi-taller.es",
      host: "192.168.1.20",
      user: "admin",
      result: {
        env: "si",
        secreto: "si",
        clave: "pedida",
        compose: "conservado",
        funciones: "sin-arrancar",
        construido: "no",
      },
      firstTime: true,
    }).join("\n");
    expect(texto).toContain("INSTANCE_SECRET");
    expect(texto).toContain("--force-compose");
    expect(texto).toContain("docker compose ps -a");
    expect(
      panelLines({
        appUrl: "https://t.mi-taller.es",
        apiUrl: "https://a.mi-taller.es",
        host: "192.168.1.20",
        user: "admin",
        result: { funciones: "sigue" },
      }).join("\n"),
    ).toContain("docker compose logs -f funciones");
    expect(texto).toContain("--no-build");
    expect(texto).toContain("/auth");
  });

  test("el vigilante se nombra solo cuando el compose es el del repositorio", () => {
    const panel = (result: Record<string, unknown>) =>
      panelLines({
        appUrl: "https://taller.mi-taller.es",
        apiUrl: "https://api.mi-taller.es",
        host: "192.168.1.20",
        user: "admin",
        result,
      }).join("\n");

    // Con el compose del repositorio, que es el que trae el servicio, se dice.
    expect(panel({ compose: "colocado" })).toContain("y el vigilante en pie");
    // Con el del NAS conservado no se puede saber: no se afirma nada y se avisa.
    expect(panel({ compose: "conservado" })).not.toContain("vigilante en pie");
    expect(panel({ compose: "conservado" })).toContain("«vigilante»");
  });
});

/* ------------------------------------------------------------------ */
/* El guion, ejecutado de verdad                                       */
/* ------------------------------------------------------------------ */

/** Un NAS de mentira: la carpeta del proyecto, la del código y los dobles. */
function montarNas() {
  const base = mkdtempSync(join(tmpdir(), "pulso-nas-"));
  const proyecto = join(base, "pulso-taller");
  mkdirSync(join(proyecto, ".setup"), { recursive: true });
  mkdirSync(join(proyecto, "codigo", "docker", "synology"), {
    recursive: true,
  });
  writeFileSync(
    join(proyecto, "codigo", "docker", "synology", "Dockerfile"),
    "FROM scratch\n",
  );
  copyFileSync(
    join(root, "docker", "synology", "docker-compose.yml"),
    join(proyecto, ".setup", "docker-compose.yml"),
  );
  copyFileSync(
    join(root, "docker", "synology", ".env.example"),
    join(proyecto, ".setup", "env.example"),
  );

  // Los dobles: `docker` que apunta lo que se le pide y contesta como un backend
  // recién levantado, y un `curl` que dice que sí. Al PATH solo van ellos y las
  // herramientas del sistema: dentro del guion no hace falta nada más.
  const bin = join(base, "bin");
  mkdirSync(bin);
  const doble = (nombre: string, cuerpo: string) => {
    const path = join(bin, nombre);
    writeFileSync(path, `#!/bin/sh\n${cuerpo}`);
    chmodSync(path, 0o755);
  };
  doble(
    "docker",
    [
      'printf "%s\\n" "$*" >> "$PULSO_LOG"',
      'case "$1" in',
      "  info) exit 0 ;;",
      "  compose)",
      "    shift",
      "    # como el de verdad: `version` no necesita ningún proyecto delante, el",
      "    # resto sí. Si el guion no ha entrado en la carpeta del taller --que es",
      "    # lo que pasa al lanzarlo por SSH desde el HOME del NAS--, aquí se planta.",
      '    case "$1" in',
      "      version) exit 0 ;;",
      "    esac",
      '    if [ ! -f docker-compose.yml ]; then',
      '      printf "no configuration file provided: not found\\n" >&2',
      "      exit 1",
      "    fi",
      '    case "$1" in',
      '      exec) printf "Admin key:\\npulso-taller|0123456789abcdef\\n" ;;',
      '      ps) case "$*" in *funciones*)',
      '            [ -n "${PULSO_SIN_FUNCIONES:-}" ] && exit 0 ;; esac',
      '          case "$*" in *vigilante*)',
      '            [ -n "${PULSO_SIN_VIGILANTE:-}" ] && exit 0 ;; esac',
      '          [ -n "${PULSO_SIN_PS:-}" ] && exit 0',
      '          for ultimo in "$@"; do :; done',
      "          printf 'falso-%s\\n' \"$ultimo\" ;;",
      "      *) exit 0 ;;",
      "    esac",
      "    ;;",
      "  inspect)",
      '    case "$*" in',
      '      *Running*) printf "%s\\n" "${PULSO_MARCHA:-false}" ;;',
      '      *Status*) case "$*" in *funciones*) printf "%s\\n" "${PULSO_ESTADO_FUNCIONES:-exited}" ;;',
      '        *) printf "%s\\n" "${PULSO_ESTADO:-running}" ;; esac ;;',
      '      *ExitCode*) printf "%s\\n" "${PULSO_SALIDA:-0}" ;;',
      '      *FinishedAt*) printf "%s\\n" "${PULSO_FIN:-2026-10-11T09:00:00Z}" ;;',
      '      *) printf "\\n" ;;',
      "    esac",
      "    ;;",
      "esac",
      "exit 0",
    ].join("\n"),
  );
  doble("curl", 'exit "${PULSO_CURL:-0}"');

  const log = join(base, "docker.log");
  const guion = join(proyecto, ".setup", "setup.sh");
  const comprobacion = join(base, "check.sh");

  /**
   * Lanza el guion como lo lanzaría el comando del ordenador, y deja ver qué
   * pasó. Con `entorno` se le cambia el humor a los dobles: un contenedor que
   * falló, uno que no existe...
   */
  const lanzar = (
    opciones: Record<string, unknown> = {},
    entorno: Record<string, string> = {},
  ) => {
    writeFileSync(
      guion,
      setupScript({
        root: shPath(proyecto),
        forceCompose: false,
        newKey: false,
        build: true,
        ...opciones,
      }),
    );
    const extra = Object.entries(entorno)
      .map(([clave, valor]) => `${clave}='${valor}'`)
      .join(" ");
    // El PATH se compone **dentro** del propio `sh` (con el de la máquina, que ya
    // viene en forma POSIX) y no desde Node: al lanzar un proceso, Node tiene que
    // encontrar el ejecutable con las reglas de Windows, y una ruta de estas
    // —«/c/…»— no la entiende.
    const result = spawnSync(
      "sh",
      [
        "-c",
        `PATH='${shPath(bin)}':"$PATH" PULSO_LOG='${shPath(log)}' ${extra} sh '${shPath(guion)}'`,
      ],
      { encoding: "utf8" },
    );
    return {
      status: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      resumen: parseSetupResult(result.stdout),
    };
  };

  /**
   * Lanza la comprobación tal y como la lanza el comando del ordenador: el guion
   * viaja como argumento de la conexión (aquí, como texto), con los dobles
   * delante. `entorno` le cambia el humor a los dobles, igual que en la puesta en
   * marcha; `opciones` cambia lo que se mira (por ejemplo, otra carpeta).
   */
  const comprobar = (
    opciones: Record<string, unknown> = {},
    entorno: Record<string, string> = {},
  ) => {
    writeFileSync(
      comprobacion,
      checkScript({ root: shPath(proyecto), ...opciones }),
    );
    const extra = Object.entries(entorno)
      .map(([clave, valor]) => `${clave}='${valor}'`)
      .join(" ");
    const result = spawnSync(
      "sh",
      [
        "-c",
        `PATH='${shPath(bin)}':"$PATH" PULSO_LOG='${shPath(log)}' ${extra} sh '${shPath(comprobacion)}'`,
      ],
      { encoding: "utf8" },
    );
    return {
      status: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      resumen: parseCheckResult(result.stdout),
    };
  };

  /** Lo que se le ha pedido a Docker; sin archivo es que no se le pidió nada. */
  const ordenes = () => {
    try {
      return lineas(readFileSync(log, "utf8"));
    } catch {
      return [];
    }
  };

  return {
    base,
    proyecto,
    guion,
    log,
    lanzar,
    comprobar,
    ordenes,
    env: () => readFileSync(join(proyecto, ".env"), "utf8"),
    compose: () => readFileSync(join(proyecto, "docker-compose.yml"), "utf8"),
  };
}

const nasCreados: string[] = [];

const conNas = () => {
  const nas = montarNas();
  nasCreados.push(nas.base);
  return { nas };
};

afterAll(() => {
  for (const base of nasCreados) rmSync(base, { recursive: true, force: true });
});

/* ------------------------------------------------------------------ */
/* --check: cómo está el taller                                        */
/* ------------------------------------------------------------------ */

/** Cuándo terminó el último envío en los resúmenes de mentira de más abajo. */
const FIN = "2026-10-11T09:00:00Z";

/** Un resumen como el de un taller recién puesto en marcha: todo en su sitio. */
const sano = (extra: Record<string, unknown> = {}) => ({
  raiz: "si",
  docker: "si",
  salud: "si",
  contenedores:
    "app:running,backend:running,dashboard:running,vigilante:running",
  env: "si",
  faltan: "ninguno",
  plantilla: "no",
  api: "https://api.mi-taller.es",
  sitio: "https://taller.mi-taller.es",
  funciones: "terminado",
  salida: "0",
  fin: FIN,
  ...extra,
});

describe("la comprobación del taller (--check)", () => {
  test("--check es un interruptor: no pide valor y sigue haciendo falta el NAS", () => {
    const config = resolveConfig(["--check", "--host", "192.168.1.20"]);
    expect(config.errors).toEqual([]);
    expect(config.check).toBe(true);
    // Sin NAS no hay nada que mirar: el host sigue siendo obligatorio.
    expect(resolveConfig(["--check"]).errors).toContain(
      "falta el NAS: --host IP-del-NAS (o NAS_HOST)",
    );
  });

  test("--check no se combina con lo que sí cambia cosas, y lo dice", () => {
    const juntos = resolveConfig([
      "--check",
      "--host",
      "nas",
      "--force-compose",
      "--new-key",
    ]);
    expect(juntos.check).toBe(true);
    expect(juntos.errors.join("\n")).toContain(
      "--check no cambia nada, así que no se combina con --force-compose ni --new-key",
    );
    // Lo que no vale es la combinación: cada uno por su lado sigue valiendo.
    expect(resolveConfig(["--host", "nas", "--force-compose"]).errors).toEqual(
      [],
    );
    expect(resolveConfig(["--host", "nas", "--new-key"]).errors).toEqual([]);
  });

  test("con todo en pie, las tres cosas pasan y se dice por qué", () => {
    const report = checkReport(sano(), {
      codeMtime: Date.parse("2026-01-01T00:00:00Z"),
    });
    expect(report.map((finding) => finding.id)).toEqual([
      "containers",
      "env",
      "schema",
    ]);
    expect(report.every((finding) => finding.ok)).toBe(true);
    expect(report[0].detail).toContain("app · backend · dashboard en pie");
    expect(report[0].detail).toContain("la API responde");
    expect(report[1].detail).toContain("completo");
    expect(report[2].detail).toContain("último envío");
  });

  test("un contenedor parado se cuenta con su nombre y con lo que lo levanta", () => {
    const report = checkReport(
      sano({ contenedores: "app:running,backend:parado,dashboard:falta" }),
    );
    expect(report[0].ok).toBe(false);
    expect(report[0].detail).toBe(
      "app en pie · backend parado · dashboard no está",
    );
    expect(report[0]).toMatchObject({
      fix: expect.stringContaining("npm run nas"),
    });
  });

  test("un vigilante parado se cuenta, porque es el que sube los cambios", () => {
    const report = checkReport(
      sano({
        contenedores:
          "app:running,backend:running,dashboard:running,vigilante:parado",
      }),
    );
    expect(report[0].ok).toBe(false);
    expect(report[0].detail).toContain("el vigilante de las funciones parado");
    expect(report[0]).toMatchObject({
      fix: expect.stringContaining("vigilante"),
    });
  });

  test("una instalación de antes, sin vigilante, no se echa en falta", () => {
    const report = checkReport(
      sano({ contenedores: "app:running,backend:running,dashboard:running" }),
    );
    expect(report[0].ok).toBe(true);
    expect(report[0].detail).not.toContain("vigilante");
  });

  test("con los contenedores en pie pero la API muda, la culpa es del backend", () => {
    const report = checkReport(sano({ salud: "no" }));
    expect(report[0].ok).toBe(false);
    expect(report[0].detail).toContain("la API no responde");
    expect(report[0]).toMatchObject({
      fix: expect.stringContaining("logs backend"),
    });
  });

  test("del .env se dicen los nombres que faltan, nunca los valores", () => {
    const report = checkReport(sano({ faltan: "INSTANCE_SECRET,SITE_URL" }));
    expect(report[1].ok).toBe(false);
    expect(report[1].detail).toBe("le faltan INSTANCE_SECRET, SITE_URL");
    expect(report[1]).toMatchObject({
      fix: expect.stringContaining("vuelve a lanzar la puesta en marcha"),
    });
    // En singular se dice en singular: «le falta», no «le faltan».
    expect(checkReport(sano({ faltan: "SITE_URL" }))[1].detail).toBe(
      "le falta SITE_URL",
    );
  });

  test("no es lo mismo que no haya .env que tener el de la plantilla", () => {
    const sinNada = checkReport(sano({ env: "no", faltan: "ninguno" }))[1];
    expect(sinNada.ok).toBe(false);
    expect(sinNada.detail).toBe("no hay .env en la carpeta del proyecto");

    const plantilla = checkReport(sano({ plantilla: "si" }))[1];
    expect(plantilla.ok).toBe(false);
    expect(plantilla.detail).toContain("tudominio.com");
  });
});

describe("si al esquema le falta un viaje", () => {
  const fin = Date.parse(FIN);

  test("está al día cuando el último envío es posterior al último cambio", () => {
    expect(checkReport(sano(), { codeMtime: fin - 60_000 })[2].ok).toBe(true);
    expect(checkReport(sano(), { codeMtime: fin })[2].ok).toBe(true);
  });

  test("y no lo está cuando el código es más nuevo que el envío", () => {
    const report = checkReport(sano(), { codeMtime: fin + 60_000 })[2];
    expect(report.ok).toBe(false);
    expect(report.detail).toBe(
      "hay cambios en src/convex posteriores a la última subida",
    );
    expect(report).toMatchObject({
      fix: expect.stringContaining("npm run nas"),
    });
  });

  test("mientras el contenedor de las funciones sube, el envío está en curso", () => {
    const report = checkReport(sano({ funciones: "en-marcha" }))[2];
    expect(report.ok).toBe(true);
    expect(report.detail).toContain("ahora mismo");
  });

  test("un envío que salió con error, o que no llegó a existir, no se da por bueno", () => {
    const fallo = checkReport(sano({ salida: "7" }))[2];
    expect(fallo.ok).toBe(false);
    expect(fallo.detail).toContain("salida 7");

    const nunca = checkReport(sano({ funciones: "falta", salida: "" }))[2];
    expect(nunca.ok).toBe(false);
    expect(nunca.detail).toContain("no se ha subido nunca");

    // Un contenedor en un estado que no se entiende se cuenta tal cual y no se
    // interpreta como bueno.
    const raro = checkReport(sano({ funciones: "paused" }))[2];
    expect(raro.ok).toBe(false);
    expect(raro.detail).toContain("paused");
  });

  test("sin Container Manager no se inventa una respuesta", () => {
    const report = checkReport(sano({ docker: "no" }));
    expect(report[0].ok).toBe(false);
    expect(report[0].detail).toContain("docker compose");
    expect(report[2].detail).toContain("no se sabe");
  });

  test("en una carpeta sin instalación, todo se dice sin dar por hecho nada", () => {
    const report = checkReport({ raiz: "no" });
    expect(report.map((finding) => finding.ok)).toEqual([false, false, false]);
    expect(report[0].detail).toContain("no hay ninguna instalación");
    expect(report[1].detail).toContain("no hay .env");
    expect(report[2].detail).toContain("no hay instalación");
  });
});

describe("el panel de la comprobación", () => {
  const host = "192.168.1.20";
  const panel = (result: Record<string, unknown> = sano(), resto = {}) =>
    checkPanelLines({ host, user: "admin", result, ...resto });

  test("marca cada cosa y termina donde se entra, como todos los paneles", () => {
    const lines = panel();
    const texto = lines.join("\n");
    expect(texto).toContain("Cómo está el taller");
    expect(texto).toContain(`admin@${host}:${DEFAULT_PROJECT_PATH}`);
    // Cada línea lleva su etiqueta y su marca; en esta, todas pasan.
    expect(texto).toMatch(/Contenedores\s+✓/);
    expect(texto).toMatch(/\.env\s+✓/);
    expect(texto).toMatch(/Esquema\s+✓/);
    expect(texto).not.toContain("✗");
    expect(texto).toContain("Todo en pie");
    // La última línea es la dirección de la app, y no hay nada detrás.
    expect(lines.at(-1)).toBe("  Abre la app en https://taller.mi-taller.es");
  });

  test("cuando algo falla, dice el arreglo debajo y cuántas cosas hay que mirar", () => {
    const texto = panel(sano({ env: "no", sitio: "" })).join("\n");
    expect(texto).toMatch(/\.env\s+✗/);
    expect(texto).toContain("1 cosa que mirar");
    expect(texto).toContain("npm run nas -- --host …");
    // Sin SITE_URL no hay URL que enseñar: se dice qué escribir y dónde.
    expect(texto).toContain("Escribe SITE_URL en el .env del NAS");
  });

  test("y deja claro que del .env no se ha leído ningún valor", () => {
    expect(panel().join("\n")).toContain(
      "Del .env no se ha leído ningún valor: solo los nombres de lo que falta.",
    );
  });
});

describe.skipIf(!shListo)("el guion del NAS, de verdad", DE_VERDAD, () => {
  test("la primera vez lo deja todo hecho: pasos 1 a 5 de una tacada", () => {
    const { nas } = conNas();
    const run = nas.lanzar({
      appUrl: "https://taller.mi-taller.es",
      apiUrl: "https://api.mi-taller.es",
    });

    expect(run.status).toBe(0);
    expect(run.resumen).toEqual({
      env: "si",
      secreto: "si",
      clave: "pedida",
      compose: "colocado",
      funciones: "al-dia",
      construido: "si",
      api: "https://api.mi-taller.es",
      app: "https://taller.mi-taller.es",
    });

    const env = nas.env();
    expect(valor(env, "CONVEX_CLOUD_ORIGIN")).toBe("https://api.mi-taller.es");
    expect(valor(env, "SITE_URL")).toBe("https://taller.mi-taller.es");
    expect(valor(env, "INSTANCE_SECRET")).toMatch(/^[0-9a-f]{64}$/);
    expect(valor(env, "CONVEX_ADMIN_KEY")).toBe(
      "pulso-taller|0123456789abcdef",
    );
    // La plantilla del repositorio viaja entera: sus explicaciones siguen ahí.
    expect(env).toContain("CONVEX_ADMIN_KEY");

    // El docker-compose.yml es el del repositorio, tal cual.
    expect(nas.compose()).toBe(
      readFileSync(
        join(root, "docker", "synology", "docker-compose.yml"),
        "utf8",
      ),
    );

    // Y lo que se le pidió a Docker: construir y arrancar, y pedir la clave.
    const ordenes = nas.ordenes().join("\n");
    expect(ordenes).toContain("compose up -d --build");
    expect(ordenes).toContain(
      "compose exec -T backend ./generate_admin_key.sh",
    );
    // La clave es una credencial: no se imprime nunca.
    expect(run.stdout).not.toContain("0123456789abcdef");
    expect(run.stderr).not.toContain("0123456789abcdef");
  });

  test("volver a lanzarlo no cambia nada: ni el secreto, ni la clave, ni el .env", () => {
    const { nas } = conNas();
    const primera = nas.lanzar({
      appUrl: "https://taller.mi-taller.es",
      apiUrl: "https://api.mi-taller.es",
    });
    expect(primera.status).toBe(0);
    const envAntes = nas.env();
    const composeAntes = nas.compose();

    const segunda = nas.lanzar();
    expect(segunda.status).toBe(0);
    expect(segunda.resumen).toMatchObject({
      env: "no",
      secreto: "no",
      clave: "conservada",
      compose: "igual",
      funciones: "al-dia",
    });
    // Ni una letra distinta: el secreto no se rota y la clave no se vuelve a pedir.
    expect(nas.env()).toBe(envAntes);
    expect(nas.compose()).toBe(composeAntes);

    const tercera = nas.lanzar();
    expect(tercera.status).toBe(0);
    expect(nas.env()).toBe(envAntes);
  });

  test("el docker-compose.yml con cambios propios se conserva hasta pedirlo", () => {
    const { nas } = conNas();
    nas.lanzar({
      appUrl: "https://t.mi-taller.es",
      apiUrl: "https://a.mi-taller.es",
    });
    // Es lo que hace la variante sin dominio: abrir los puertos a la red local.
    const conPuertos = nas
      .compose()
      .replace('"127.0.0.1:8080:80"', '"8080:80"');
    writeFileSync(join(nas.proyecto, "docker-compose.yml"), conPuertos);

    const conservado = nas.lanzar();
    expect(conservado.status).toBe(0);
    expect(conservado.resumen?.compose).toBe("conservado");
    expect(nas.compose()).toBe(conPuertos);

    // Y con --force-compose se pisa con el del repositorio, que es como se
    // actualiza el proyecto.
    const refrescado = nas.lanzar({ forceCompose: true });
    expect(refrescado.resumen?.compose).toBe("refrescado");
    expect(nas.compose()).toBe(
      readFileSync(
        join(root, "docker", "synology", "docker-compose.yml"),
        "utf8",
      ),
    );
  });

  test("con una clave nueva a propósito, se pide otra (y solo entonces)", () => {
    const { nas } = conNas();
    nas.lanzar({
      appUrl: "https://t.mi-taller.es",
      apiUrl: "https://a.mi-taller.es",
    });
    const pedidas = () =>
      nas.ordenes().filter((orden) => orden.includes("generate_admin_key"))
        .length;
    expect(pedidas()).toBe(1);

    const otra = nas.lanzar({ newKey: true });
    expect(otra.status).toBe(0);
    expect(otra.resumen?.clave).toBe("pedida");
    expect(pedidas()).toBe(2);
  });

  test("sin direcciones no construye nada y dice qué falta", () => {
    const { nas } = conNas();
    const run = nas.lanzar();

    expect(run.status).not.toBe(0);
    expect(run.resumen).toBeNull();
    // El .env se queda escrito, con la plantilla, para poder rellenarlo a mano:
    // es exactamente el paso 2 de la guía.
    expect(run.stdout).toContain("direcciones de ejemplo");
    expect(nas.env()).toContain("CONVEX_CLOUD_ORIGIN=");
    // Y no se ha construido nada: compilar la app con una dirección de mentira
    // dejaría el sitio roto.
    expect(nas.ordenes().join("\n")).not.toContain("up -d");
  });

  test("si las direcciones se dicen a propósito, mandan ellas", () => {
    // El taller puede vivir de verdad en tudominio.com: lo que no vale es quedarse
    // con el ejemplo de la plantilla sin que nadie lo haya dicho.
    const { nas } = conNas();
    const run = nas.lanzar({
      appUrl: "https://taller.tudominio.com",
      apiUrl: "https://api.tudominio.com",
    });

    expect(run.status).toBe(0);
    expect(run.resumen).toMatchObject({ clave: "pedida", funciones: "al-dia" });
  });

  test("si el despliegue no entra, lo dice y enseña las últimas líneas", () => {
    const { nas } = conNas();
    const run = nas.lanzar(
      { appUrl: "https://t.mi-taller.es", apiUrl: "https://a.mi-taller.es" },
      { PULSO_SALIDA: "7" },
    );

    expect(run.status).not.toBe(0);
    expect(run.resumen).toBeNull();
    expect(run.stderr).toContain("salido con error (7)");
    expect(nas.ordenes().join("\n")).toContain(
      "compose logs --tail=30 funciones",
    );
  });

  test("el vigilante se recrea para que mire el código nuevo", () => {
    const { nas } = conNas();
    const run = nas.lanzar({
      appUrl: "https://t.mi-taller.es",
      apiUrl: "https://a.mi-taller.es",
    });

    expect(run.status).toBe(0);
    // El código llega como carpeta nueva: sin recrear el contenedor, su montaje
    // seguiría apuntando a la carpeta vieja y no subiría nada más.
    expect(nas.ordenes().join("\n")).toContain(
      "compose up -d --force-recreate vigilante",
    );
    // Y se hace después de construir, no antes: la imagen tiene que existir.
    const ordenes = nas.ordenes();
    expect(ordenes.indexOf("compose up -d --build")).toBeLessThan(
      ordenes.indexOf("compose up -d --force-recreate vigilante"),
    );
  });

  test("en una instalación sin vigilante no se recrea nada, y no se queja", () => {
    const { nas } = conNas();
    const run = nas.lanzar(
      { appUrl: "https://t.mi-taller.es", apiUrl: "https://a.mi-taller.es" },
      { PULSO_SIN_VIGILANTE: "1" },
    );

    expect(run.status).toBe(0);
    expect(nas.ordenes().join("\n")).not.toContain("force-recreate");
    expect(run.stdout).not.toContain("no he podido recrear el vigilante");
  });

  test("si el contenedor de las funciones no está, el resto queda en pie igual", () => {
    const { nas } = conNas();
    const run = nas.lanzar(
      { appUrl: "https://t.mi-taller.es", apiUrl: "https://a.mi-taller.es" },
      { PULSO_SIN_PS: "1" },
    );

    // No es un fallo del comando —los contenedores que se quedan están en pie—,
    // pero se avisa: sin ese contenedor el esquema no ha subido.
    expect(run.status).toBe(0);
    expect(run.resumen).toMatchObject({
      clave: "pedida",
      funciones: "sin-arrancar",
    });
  });

  test("sin el código en su sitio, para antes de tocar los contenedores", () => {
    const { nas } = conNas();
    rmSync(join(nas.proyecto, "codigo"), { recursive: true, force: true });
    const run = nas.lanzar({
      appUrl: "https://t.mi-taller.es",
      apiUrl: "https://a.mi-taller.es",
    });

    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain("no veo el codigo del proyecto");
    expect(nas.ordenes()).toEqual([]);
  });
});

describe.skipIf(!shListo)("la comprobación, de verdad", DE_VERDAD, () => {
  test("en un taller recién puesto en marcha, todo en pie y sin dejar rastro", () => {
    const { nas } = conNas();
    nas.lanzar({
      appUrl: "https://taller.mi-taller.es",
      apiUrl: "https://api.mi-taller.es",
    });
    const antes = rastro(nas.proyecto);
    const preguntas = nas.ordenes().length;

    const run = nas.comprobar();
    expect(run.status).toBe(0);
    expect(run.resumen).toEqual({
      raiz: "si",
      docker: "si",
      salud: "si",
      contenedores:
        "app:running,backend:running,dashboard:running,vigilante:running",
      env: "si",
      faltan: "ninguno",
      plantilla: "no",
      api: "https://api.mi-taller.es",
      sitio: "https://taller.mi-taller.es",
      funciones: "terminado",
      salida: "0",
      fin: "2026-10-11T09:00:00Z",
    });

    // Ni un archivo distinto en el NAS: la comprobación no ha escrito nada.
    expect(rastro(nas.proyecto)).toEqual(antes);

    // Y a Docker solo se le pregunta: ni construir, ni arrancar, ni parar nada.
    const nuevas = nas.ordenes().slice(preguntas).join("\n");
    expect(nuevas).toContain("compose ps -a -q app");
    expect(nuevas).toContain("{{.State.Status}}");
    expect(nuevas).not.toMatch(/up |build|down|stop|restart|rm /);

    // El veredicto, con el código de este ordenador delante: las tres, en pie.
    const report = checkReport(run.resumen ?? {}, {
      codeMtime: Date.parse("2026-01-01T00:00:00Z"),
    });
    expect(report.every((finding) => finding.ok)).toBe(true);
  });

  test("de un .env a medias se dicen los nombres que faltan y ningún valor", () => {
    const { nas } = conNas();
    const secreto = "0123456789abcdef0123456789abcdef";
    writeFileSync(
      join(nas.proyecto, ".env"),
      [
        "INSTANCE_NAME=pulso-taller",
        `INSTANCE_SECRET=${secreto}`,
        "CONVEX_CLOUD_ORIGIN=https://api.mi-taller.es",
        "CONVEX_ADMIN_KEY=pulso-taller|0123456789abcdef",
      ].join("\n") + "\n",
    );

    const run = nas.comprobar();
    expect(run.status).toBe(0);
    expect(run.resumen).toMatchObject({
      env: "si",
      faltan: "SITE_URL",
      plantilla: "no",
    });
    // Del .env solo salen nombres: ningún valor viaja en el resumen.
    expect(run.stdout).not.toContain(secreto);
    expect(run.stdout).not.toContain("0123456789abcdef");
    expect(checkReport(run.resumen ?? {})[1]).toMatchObject({
      ok: false,
      detail: "le falta SITE_URL",
    });
  });

  test("las direcciones de la plantilla se reconocen como lo que son", () => {
    const { nas } = conNas();
    writeFileSync(
      join(nas.proyecto, ".env"),
      [
        "INSTANCE_NAME=pulso-taller",
        `INSTANCE_SECRET=${"a".repeat(64)}`,
        "CONVEX_CLOUD_ORIGIN=https://api.tudominio.com",
        "SITE_URL=https://taller.tudominio.com",
        "CONVEX_ADMIN_KEY=pulso-taller|0123456789abcdef",
      ].join("\n") + "\n",
    );

    const run = nas.comprobar();
    expect(run.resumen).toMatchObject({
      env: "si",
      faltan: "ninguno",
      plantilla: "si",
      api: "https://api.tudominio.com",
    });
    expect(checkReport(run.resumen ?? {})[1].detail).toContain("tudominio.com");
  });

  test("sin .env se sigue mirando lo demás, sin dar nada por hecho", () => {
    const { nas } = conNas();
    nas.lanzar({
      appUrl: "https://t.mi-taller.es",
      apiUrl: "https://a.mi-taller.es",
    });
    rmSync(join(nas.proyecto, ".env"));

    const run = nas.comprobar();
    expect(run.resumen).toMatchObject({ env: "no", faltan: "ninguno" });
    const report = checkReport(run.resumen ?? {});
    expect(report[0].ok).toBe(true);
    expect(report[1].ok).toBe(false);
    expect(report[1].detail).toBe("no hay .env en la carpeta del proyecto");
  });

  test("con los contenedores parados y el último envío roto, se ve las dos cosas", () => {
    const { nas } = conNas();
    nas.lanzar({
      appUrl: "https://t.mi-taller.es",
      apiUrl: "https://a.mi-taller.es",
    });
    const run = nas.comprobar(
      {},
      { PULSO_ESTADO: "exited", PULSO_SALIDA: "1", PULSO_CURL: "7" },
    );

    expect(run.resumen).toMatchObject({
      contenedores:
        "app:parado,backend:parado,dashboard:parado,vigilante:parado",
      salud: "no",
      funciones: "terminado",
      salida: "1",
    });
    const report = checkReport(run.resumen ?? {});
    expect(report[0].ok).toBe(false);
    expect(report[2].ok).toBe(false);
    expect(report[2].detail).toContain("salida 1");
  });

  test("sin el contenedor de las funciones, el esquema queda pendiente", () => {
    const { nas } = conNas();
    nas.lanzar({
      appUrl: "https://t.mi-taller.es",
      apiUrl: "https://a.mi-taller.es",
    });
    const run = nas.comprobar({}, { PULSO_SIN_FUNCIONES: "1" });

    expect(run.resumen).toMatchObject({
      contenedores:
        "app:running,backend:running,dashboard:running,vigilante:running",
      funciones: "falta",
    });
    const report = checkReport(run.resumen ?? {});
    expect(report[0].ok).toBe(true);
    expect(report[2].ok).toBe(false);
    expect(report[2].detail).toContain("no se ha subido nunca");
  });

  test("en una carpeta sin instalación lo dice, en vez de romperse", () => {
    const { nas } = conNas();
    const run = nas.comprobar({ root: "/volume1/docker/otra-cosa" });

    expect(run.status).toBe(0);
    expect(run.resumen).toEqual({ raiz: "no" });
    expect(checkReport(run.resumen ?? {}).map((f) => f.ok)).toEqual([
      false,
      false,
      false,
    ]);
  });

  test("el guion de la comprobación no escribe nada, ni una carpeta", () => {
    const guion = checkScript();
    // Corre con sh, no con bash: en el NAS no hay bash de sobra.
    expect(guion.split("\n")[0]).toBe("#!/bin/sh");
    expect(guion).not.toContain("#!/bin/bash");
    for (const prohibido of [
      "compose up",
      "compose down",
      "compose build",
      "compose restart",
      "compose exec",
      "compose rm",
      "mkdir",
      "chown",
      " > ",
      "tee ",
      "tar ",
    ]) {
      expect(guion).not.toContain(prohibido);
    }
    // Lo que cuenta sale en una línea con su marca y con todas sus claves.
    expect(guion).toContain("PULSO_CHECK raiz=");
    for (const clave of [
      "docker=",
      "salud=",
      "contenedores=",
      "env=",
      "faltan=",
      "plantilla=",
      "api=",
      "sitio=",
      "funciones=",
      "salida=",
      "fin=",
    ]) {
      expect(guion).toContain(clave);
    }
  });
});

/**
 * El índice de módulos (`src/convex/_generated/api.d.ts`) es lo que `tsc -b` lee
 * para saber qué funciones existen: con él atrasado, la imagen del NAS no compila
 * —`api.dashboard` sin tipo— y el fallo aparece al construir, lejos de donde se
 * arregla. Estas pruebas sujetan las dos mitades del guardián que lo mira antes de
 * empaquetar: los módulos que hay en el código (con la regla del CLI) y los que
 * nombra el índice.
 */
describe("el índice de módulos, antes de llevarse el código al NAS", () => {
  const convexDir = join(root, "src", "convex");
  const apiPath = join(convexDir, "_generated", "api.d.ts");
  const herramientas = { existsSync, readFileSync, readdirSync };

  test("se cuentan los módulos del CLI: sin esquema, sin configuración de auth y sin pruebas", () => {
    expect(
      moduleNames([
        {
          path: "alerts.ts",
          source: 'import { query } from "./_generated/server";',
        },
        { path: "schema.ts", source: "export default defineSchema({});" },
        { path: "auth.config.ts", source: "export default {};" },
        { path: "dashboard.test.ts", source: "export const a = 1;" },
        { path: "auth/emailOtp.ts", source: "export const b = 1;" },
        { path: "_generated/api.d.ts", source: "export {};" },
        { path: "_deps/algo.ts", source: "export {};" },
        { path: ".oculto.ts", source: "export {};" },
        { path: "#nota.ts", source: "export {};" },
        { path: "tsconfig.json", source: null },
        { path: "guardado.ts.bak", source: null },
        // Un TypeScript sin import ni export no es módulo de nada, igual que para
        // el CLI: no habría nada que desplegar de él.
        { path: "suelto.ts", source: "const suelto = 1;" },
        { path: "con espacio.ts", source: "export {};" },
      ]),
    ).toEqual(["alerts", "auth/emailOtp"]);
  });

  test("el recorrido baja a las subcarpetas y no entra en una carpeta que es un componente", () => {
    const arbol: Record<string, { name: string; isDirectory: () => boolean }[]> = {
      mock: [
        { name: "saludo.ts", isDirectory: () => false },
        { name: "auth", isDirectory: () => true },
        { name: "componente", isDirectory: () => true },
      ],
      "mock/auth": [
        { name: "emailOtp.ts", isDirectory: () => false },
      ],
      "mock/componente": [
        { name: "ajeno.ts", isDirectory: () => false },
      ],
    };
    const inventado = {
      readdirSync: (directory: string) => arbol[directory] ?? [],
      existsSync: (path: string) => path === "mock/componente/convex.config.ts",
      readFileSync: () => "export const x = 1;",
    };
    expect(moduleNames(moduleEntries("mock", inventado))).toEqual([
      "auth/emailOtp",
      "saludo",
    ]);
  });

  test("del índice se leen sus módulos, no lo que importa cada uno", () => {
    const texto = [
      'import type * as dashboard from "../dashboard.js";',
      'import type * as emailOtp from "../auth/emailOtp.js";',
      "",
      "declare const fullApi: ApiFromModules<{",
      "  alerts: typeof alerts;",
      '  "auth/emailOtp": typeof emailOtp;',
      "  dashboard: typeof dashboard;",
      "}>;",
    ].join("\n");
    expect(listedModules(texto)).toEqual([
      "alerts",
      "auth/emailOtp",
      "dashboard",
    ]);
  });

  test("con el índice al día, el veredicto deja seguir", () => {
    const verdict = apiModulesVerdict({
      modules: ["alerts", "dashboard"],
      listed: ["alerts", "dashboard"],
    });
    expect(verdict.ok).toBe(true);
    expect(verdict.detail).toBe("el índice nombra los 2 módulos del código");
  });

  test("un módulo nuevo sin regenerar el índice para el envío", () => {
    const verdict = apiModulesVerdict({
      modules: ["alerts", "dashboard", "publicCodes"],
      listed: ["alerts", "dashboard"],
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.detail).toContain("no nombra publicCodes");
    expect(verdict.fix).toContain("convex:push");
  });

  test("un módulo borrado que el índice sigue nombrando también para el envío", () => {
    const verdict = apiModulesVerdict({
      modules: ["alerts"],
      listed: ["alerts", "fantasma"],
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.detail).toContain("ya no están: fantasma");
    expect(verdict.fix).toContain("convex codegen");
  });

  // El repositorio que se empaqueta tiene que cuadrar consigo mismo: si esto
  // falla, la imagen del NAS no compilaría. Se salta si el índice no está (recién
  // clonado, sin desplegar nunca), que es cuando no hay nada que comprobar.
  describe.skipIf(!existsSync(apiPath))("el repositorio que se empaqueta", () => {
    test("nombra todos sus módulos y ninguno que ya no esté", () => {
      const modules = moduleNames(moduleEntries(convexDir, herramientas));
      expect(modules.length).toBeGreaterThan(20);
      const verdict = apiModulesVerdict({
        modules,
        listed: listedModules(readFileSync(apiPath, "utf8")),
      });
      expect(verdict.ok, verdict.detail).toBe(true);
    });
  });
});
