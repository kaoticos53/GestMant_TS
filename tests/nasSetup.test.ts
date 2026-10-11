import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
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
import {
  DEFAULT_PROJECT_PATH,
  panelLines,
  parseSetupResult,
  resolveConfig,
  setupScript,
  shQuote,
  tarArgs,
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
  spawnSync("sh", ["-c", "command -v tar sed grep awk cmp tail head tr od"], {
    encoding: "utf8",
  }).status === 0;

/** Las líneas con algo de un texto, que es como se leen los resúmenes. */
const lineas = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");

/** Lee el valor de una clave del `.env`, tal y como viaja al NAS. */
const valor = (env: string, clave: string) =>
  new RegExp(`^${clave}=(.*)$`, "m").exec(env)?.[1] ?? "";

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
      '    case "$1" in',
      "      version) exit 0 ;;",
      '      exec) printf "Admin key:\\npulso-taller|0123456789abcdef\\n" ;;',
      "      ps) [ -n \"${PULSO_SIN_PS:-}\" ] || printf 'falso-contenedor\\n' ;;",
      "      *) exit 0 ;;",
      "    esac",
      "    ;;",
      "  inspect)",
      '    case "$*" in',
      '      *Running*) printf "%s\\n" "${PULSO_MARCHA:-false}" ;;',
      '      *ExitCode*) printf "%s\\n" "${PULSO_SALIDA:-0}" ;;',
      '      *) printf "\\n" ;;',
      "    esac",
      "    ;;",
      "esac",
      "exit 0",
    ].join("\n"),
  );
  doble("curl", "exit 0");

  const log = join(base, "docker.log");
  const guion = join(proyecto, ".setup", "setup.sh");

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

describe.skipIf(!shListo)("el guion del NAS, de verdad", () => {
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
