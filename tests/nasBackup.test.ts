import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";
import {
  backupWords,
  DEFAULT_BACKUP_PATH,
  DEFAULT_KEEP,
  DEFAULT_PROJECT_PATH,
  panelLines,
  parseBackupResult,
  resolveConfig,
  usage,
} from "../scripts/nas-backup-lib.mjs";
import {
  COMMAND_CHUNK,
  commandChunks,
  scriptWords,
} from "../scripts/nas-setup-lib.mjs";

/**
 * La copia previa tiene dos mitades y se prueban por separado:
 *
 *  1. Lo que decide el comando del ordenador —qué NAS, qué carpetas, cuántas
 *     copias se conservan— y el panel con el que termina. Eso son las funciones
 *     puras de `scripts/nas-backup-lib.mjs`, que se miran aquí sin conectar con
 *     nadie: `scripts/nas-backup.mjs` habla por SSH y no se puede importar.
 *  2. Lo que hace el guion dentro del NAS (`docker/synology/copia-previa.sh`),
 *     que **se ejecuta de verdad**, contra una carpeta temporal y con dobles de
 *     `docker` y `date` en el `PATH`. Es la única forma de comprobar lo que de
 *     verdad importa: que el export va antes de parar el backend, que el backend
 *     vuelve a arrancar aunque la copia del volumen falle, y que las copias
 *     viejas se van borrando sin llevarse las nuevas.
 */

const root = fileURLToPath(new URL("..", import.meta.url));

/** El guion del NAS, tal cual vive en el repositorio. */
const GUION = join(root, "docker", "synology", "copia-previa.sh");

/** Windows → la ruta que entiende el `sh` de Git Bash (`/c/Users/...`). */
const shPath = (path: string) =>
  path
    .replace(/\\/g, "/")
    .replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`);

/** ¿Hay un `sh` de verdad con sus herramientas? Sin él, la prueba de verdad no corre. */
const shListo =
  spawnSync("sh", ["-c", "command -v ls head tail basename rm mkdir"], {
    encoding: "utf8",
  }).status === 0;

/**
 * El guion se lanza de verdad y tarda lo suyo —abre unos cuantos procesos y se
 * toma sus esperas—; el límite de Vitest, cinco segundos, se queda corto en
 * cuanto la máquina tiene algo más que hacer, y entonces falla la prueba por lo
 * que tarda el ordenador, no por lo que hace el guion.
 */
const DE_VERDAD = { timeout: 30_000 };

/** Las líneas con algo de un texto. */
const lineas = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");

/* ------------------------------------------------------------------ */
/* Lo que decide el comando, sin NAS                                   */
/* ------------------------------------------------------------------ */

describe("el guion que viaja al NAS", () => {
  test("va troceado, en palabras sueltas y muy por debajo del corte de MSYS", () => {
    const guion = readFileSync(GUION, "utf8");
    const trozos = commandChunks(guion);
    // El guion no cabe en un argumento: al cruzar de Windows a un `ssh` de MSYS
    // un argumento de casi 10 KB llegaba cortado a media palabra, en silencio.
    expect(trozos.length).toBeGreaterThan(1);
    expect(trozos.join("")).toBe(guion);

    const palabras = scriptWords(guion);
    expect(palabras).toContain("|");
    // Y la shell del NAS se guarda el guion entero antes de ejecutar nada: si lo
    // fuera leyendo segun lo necesita (`sh -s`), una orden que lea de la entrada
    // se llevaria por delante el resto del guion (ver la prueba de mas abajo).
    expect(palabras.at(-1)).toContain("$(cat)");
    for (const palabra of palabras) {
      expect(Buffer.byteLength(palabra, "utf8")).toBeLessThan(COMMAND_CHUNK + 200);
    }
  });

  test("con la contraseña ya tecleada, el guion viaja con el envoltorio que le tapa el sudo", () => {
    const guion = readFileSync(GUION, "utf8");
    const comun = {
      script: guion,
      root: "/volume1/docker/pulso-taller",
      backups: "/volume1/docker/respaldos",
      keep: "7",
    };

    // Sin contraseña —el guion lanzado a mano en el NAS, o una cuenta que entra con
    // clave SSH pero necesita sudo— la orden es la de siempre: no se prepara nada de
    // esto y el `sudo` del NAS pregunta cuando le toque.
    const sinClave = backupWords(comun);
    expect(sinClave.join(" ")).not.toContain("read -r PULSO_CLAVE");
    expect(sinClave.join(" ")).not.toContain("command sudo -S");

    // Con ella, la orden viaja como la de la puesta en marcha: primero se lee la
    // clave de la entrada estándar —el tubo por el que la manda el ordenador— y el
    // guion lleva delante el envoltorio que convierte su `sudo` en uno que la recibe
    // por ahí en vez de preguntarla.
    const conClave = backupWords({ ...comun, clave: true });
    expect(conClave.slice(0, 3)).toEqual(["read", "-r", "PULSO_CLAVE;"]);
    expect(conClave).toContain("PULSO_CLAVE=$PULSO_CLAVE");

    // El envoltorio va dentro de uno de los trozos —allí el `printf` los junta—,
    // entrecomillado como los demás: se busca el texto que no lleva comillas.
    const portador = conClave.indexOf(
      conClave.find((palabra) => palabra.includes("command sudo -S -p")) ?? "",
    );
    expect(portador).toBeGreaterThan(-1);

    // Y el orden importa: el envoltorio va después de lo que el guion lee del
    // entorno —las carpetas las tiene que saber— y antes del guion, porque el `sudo`
    // ha de estar tapado desde su primera llamada.
    const trozo = conClave[portador];
    expect(trozo.indexOf("command sudo -S")).toBeGreaterThan(
      trozo.indexOf("PULSO_RAIZ="),
    );
    expect(trozo.indexOf("CONSERVAR_POR_DEFECTO")).toBeGreaterThan(
      trozo.indexOf("command sudo -S"),
    );
    // Y el guion entero viaja detrás, hasta su última línea —el resumen que lee el
    // comando del ordenador—: el envoltorio no se lleva nada por delante.
    expect(
      conClave.some((palabra) => palabra.includes("PULSO_BACKUP raiz=%s")),
    ).toBe(true);
  });

  test.skipIf(!shListo)(
    "el guion llega entero aunque una orden de dentro lea de la entrada",
    () => {
      // `docker compose run` lee de la entrada: con el guion viajando por ella
      // —como con `sh -s`— se lleva por delante lo que quede de guion, la shell
      // se queda sin nada que leer y termina en silencio, a medias. Le pasó a la
      // copia previa: el export salía bien y el guion moría justo después.
      const guion = [
        "#!/bin/sh",
        'printf "antes\\n"',
        "cat >/dev/null",
        'printf "despues\\n"',
        "",
      ].join("\n");
      const r = spawnSync("sh", ["-c", scriptWords(guion).join(" ")], {
        encoding: "utf8",
      });

      expect(r.stdout).toContain("antes");
      expect(r.stdout).toContain("despues");
    },
  );

  test.skipIf(!shListo)("en el NAS se vuelve a juntar y el guion se ejecuta con sus valores", () => {
    const guion = readFileSync(GUION, "utf8");
    const orden = backupWords({
      script: guion,
      root: "/volume1/inexistente",
      backups: "/volume1/docker/respaldos",
      keep: "7",
    }).join(" ");
    // Se le da al `sh` por un archivo, no como argumento: pasarlo como argumento
    // sería caer en el mismo corte que se está probando.
    const carpeta = mkdtempSync(join(tmpdir(), "pulso-orden-"));
    const fichero = join(carpeta, "orden.sh");
    writeFileSync(fichero, orden);
    const r = spawnSync("sh", [shPath(fichero)], { encoding: "utf8" });
    rmSync(carpeta, { recursive: true, force: true });

    // El guion se ha ejecutado de verdad —el mensaje es suyo— y con el valor
    // dentro: la carpeta se la ha dicho el ordenador, no un valor de mentira.
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("no veo el proyecto en /volume1/inexistente");
  });
});

describe("la configuración de la copia previa", () => {
  test("el binario de Docker se busca por su ruta, no se da por hecho en el PATH", () => {
    // Como en la puesta en marcha y la comprobación: el `sudo` de un NAS impone
    // su propio PATH —sin `/usr/local/bin`, que es donde vive el binario—, así
    // que `sudo docker` contestaba «command not found» con el taller en pie y la
    // copia se quedaba sin hacer.
    const guion = readFileSync(GUION, "utf8");
    expect(guion).toContain('command -v "$1"');
    expect(guion).toContain('"/usr/local/bin/$1"');
    expect(guion).toContain("DOCKER=$(buscar_binario docker");
    expect(guion).toContain("$DOCKER info");
    // Nunca a secas: era justo lo que fallaba.
    expect(guion).not.toContain("$SUDO docker ");
  });

  test("sin nada, solo el host es obligatorio: lo demás tiene valores de partida", () => {
    const sinHost = resolveConfig([]);
    expect(sinHost.errors).toEqual([
      "falta el NAS: --host IP-del-NAS (o NAS_HOST)",
    ]);

    const config = resolveConfig(["--host", "192.168.1.20"]);
    expect(config.errors).toEqual([]);
    expect(config).toMatchObject({
      host: "192.168.1.20",
      user: "admin",
      port: "22",
      path: DEFAULT_PROJECT_PATH,
      backups: DEFAULT_BACKUP_PATH,
      keep: String(DEFAULT_KEEP),
    });
  });

  test("el entorno pone el NAS y las carpetas; los flags mandan sobre él", () => {
    const entorno = {
      NAS_HOST: "nas.de.casa",
      NAS_PATH: "/volume1/docker/otro-taller",
      NAS_RESPALDOS: "/volume1/docker/copias-viejas",
      NAS_KEEP: "3",
    };

    expect(resolveConfig([], entorno)).toMatchObject({
      host: "nas.de.casa",
      path: "/volume1/docker/otro-taller",
      backups: "/volume1/docker/copias-viejas",
      keep: "3",
    });

    expect(
      resolveConfig(
        [
          "--host",
          "192.168.1.20",
          "--path",
          "/srv/pulso-taller",
          "--respaldos",
          "/srv/respaldos",
          "--keep",
          "30",
        ],
        entorno,
      ),
    ).toMatchObject({
      host: "192.168.1.20",
      path: "/srv/pulso-taller",
      backups: "/srv/respaldos",
      keep: "30",
    });
  });

  test("se aceptan las dos formas de dar un valor, y una barra de más no estorba", () => {
    expect(resolveConfig(["--host=10.0.0.5", "--keep=2"])).toMatchObject({
      host: "10.0.0.5",
      keep: "2",
    });
    expect(
      resolveConfig(["--host", "10.0.0.5", "--respaldos", "/volume1/copias/"])
        .backups,
    ).toBe("/volume1/copias");
    // Y sin valor, se dice en vez de tragárselo.
    expect(resolveConfig(["--host"]).errors).toContain(
      "--host necesita un valor",
    );
  });

  test("lo que no vale se dice todo junto, antes de conectar con nada", () => {
    const config = resolveConfig([
      "--host",
      "admin@192.168.1.20",
      "--port",
      "ochenta",
      "--keep",
      "0",
      "--path",
      "volume1/docker/pulso-taller",
      "--respaldos",
      "/volume1/mis copias",
      "--loquesea",
    ]);

    expect(config.errors).toEqual([
      "no conozco la opción --loquesea",
      "el puerto de SSH no vale: ochenta",
      "--keep tiene que ser al menos 1: 0 (cuántas copias se conservan de cada tipo)",
      "la carpeta del proyecto tiene que ser absoluta: volume1/docker/pulso-taller",
      "la carpeta de las copias no puede llevar espacios ni comas: /volume1/mis copias",
      "el NAS no puede ser un usuario ni llevar puerto: admin@192.168.1.20 (el usuario va en --user)",
    ]);
  });

  test("con --help no hace falta nada más y salen las tres opciones propias", () => {
    const config = resolveConfig(["--help"]);
    expect(config.help).toBe(true);
    expect(config.errors).toEqual([]);

    const texto = usage().join("\n");
    expect(texto).toContain("--respaldos");
    expect(texto).toContain("--keep");
    expect(texto).toContain("--path");
    // Y dice lo que hace y lo que no, que aquí importa: no imprime secretos.
    expect(texto).toContain("export lógico");
    expect(texto).toContain("ningún secreto");
    expect(texto).toContain("npm run nas:check");
  });

  test("el resumen del guion se lee aunque venga con la seudo-terminal del SSH", () => {
    const salida = [
      "copia: export hecho: /volume1/docker/respaldos/export-2026-10-11-093042.zip",
      "PULSO_BACKUP raiz=/volume1/docker/pulso-taller respaldos=/volume1/docker/respaldos volumen=taller_datos datos=datos-2026-10-11-093042.tar.gz export=export-2026-10-11-093042.zip conservar=7 borrados=2",
    ].join("\r\n");

    expect(parseBackupResult(salida)).toMatchObject({
      raiz: "/volume1/docker/pulso-taller",
      respaldos: "/volume1/docker/respaldos",
      volumen: "taller_datos",
      datos: "datos-2026-10-11-093042.tar.gz",
      export: "export-2026-10-11-093042.zip",
      conservar: "7",
      borrados: "2",
    });

    // Los resúmenes de los otros comandos no se confunden con este.
    expect(
      parseBackupResult("PULSO_CHECK raiz=si\nPULSO_SETUP env=si\n"),
    ).toBeNull();
    expect(parseBackupResult("nada que leer\n")).toBeNull();
  });

  test("el panel cuenta las dos copias y termina donde están", () => {
    const lines = panelLines({
      host: "192.168.1.20",
      user: "admin",
      path: "/volume1/docker/pulso-taller",
      backups: "/volume1/docker/respaldos",
      result: {
        datos: "datos-2026-10-11-093042.tar.gz",
        export: "export-2026-10-11-093042.zip",
        volumen: "taller_datos",
        conservar: "7",
        borrados: "2",
      },
    });
    const texto = lines.join("\n");

    expect(texto).toContain("Copia previa hecha");
    expect(texto).toContain("admin@192.168.1.20:/volume1/docker/pulso-taller");
    expect(texto).toContain("datos-2026-10-11-093042.tar.gz");
    expect(texto).toContain("export-2026-10-11-093042.zip");
    expect(texto).toContain("taller_datos");
    expect(texto).toContain("Se conservan 7 de cada tipo");
    expect(texto).toContain("2 copias viejas");
    // Lo que se hace después, con el nombre exacto de los comandos.
    expect(texto).toContain("npm run nas -- --host 192.168.1.20");
    expect(texto).toContain("npm run nas:check -- --host 192.168.1.20");
    // Y la última línea es dónde están las copias, que es lo que se busca.
    expect(lines.at(-1)).toBe(
      "  Copias en    admin@192.168.1.20:/volume1/docker/respaldos",
    );
  });
});

/* ------------------------------------------------------------------ */
/* El guion del NAS, ejecutado de verdad                               */
/* ------------------------------------------------------------------ */

/** Un NAS de mentira: la carpeta del proyecto, la de las copias y los dobles. */
function montarNas() {
  const base = mkdtempSync(join(tmpdir(), "pulso-copia-"));
  const proyecto = join(base, "pulso-taller");
  const respaldos = join(base, "respaldos");
  mkdirSync(join(proyecto, "codigo", "docker", "synology"), {
    recursive: true,
  });
  writeFileSync(join(proyecto, "docker-compose.yml"), "services: {}\n");
  writeFileSync(join(proyecto, ".env"), "INSTANCE_SECRET=0f0f\n");
  mkdirSync(respaldos);

  const bin = join(base, "bin");
  mkdirSync(bin);
  const doble = (nombre: string, cuerpo: string) => {
    const path = join(bin, nombre);
    writeFileSync(path, `#!/bin/sh\n${cuerpo}`);
    chmodSync(path, 0o755);
  };

  // El docker de mentira: apunta lo que se le pide, dice cómo se llama el volumen
  // —o no dice nada, para probar lo que hace el guion cuando no contesta— y
  // **fabrica** los archivos que los contenedores de verdad dejarían.
  doble(
    "docker",
    [
      'printf "%s\\n" "$*" >> "$PULSO_LOG"',
      "fabricar() {",
      '  montaje=""',
      '  destino=""',
      '  for argumento in "$@"; do',
      '    case "$argumento" in',
      '      *:/respaldo) montaje="${argumento%:/respaldo}" ;;',
      '      /respaldo/*) destino="$argumento" ;;',
      "    esac",
      "  done",
      '  [ -n "$montaje" ] && [ -n "$destino" ] || return 1',
      '  printf "copia de mentira\\n" > "$montaje/$(basename "$destino")"',
      "}",
      'case "$1" in',
      "  info)",
      "    # `info` contesta si se puede hablar con Docker sin root; con",
      "    # `PULSO_SIN_RAIZ` no, y entonces el guion pasa a usar `sudo`, que es",
      "    # lo que se mira en la prueba de la contraseña.",
      '    [ -z "${PULSO_SIN_RAIZ:-}" ] || exit 1',
      "    exit 0",
      "    ;;",
      "  run)",
      '    [ -z "${PULSO_FALLA_VOLUMEN:-}" ] || exit 3',
      '    fabricar "$@" || exit 1',
      "    ;;",
      "  volume)",
      '    [ -z "${PULSO_SIN_VOLUMEN:-}" ] || exit 0',
      '    printf "%s\\n" "${PULSO_VOLUMEN:-taller_datos}"',
      "    ;;",
      "  compose)",
      "    shift",
      "    # Como el de verdad: `version` no necesita ningún proyecto delante, el",
      "    # resto sí. Si el guion no ha entrado en la carpeta del taller --que es lo",
      "    # que pasa al lanzarlo por SSH desde el HOME del NAS--, aquí se planta.",
      '    case "$1" in',
      "      version) exit 0 ;;",
      "    esac",
      '    if [ ! -f docker-compose.yml ]; then',
      '      printf "no configuration file provided: not found\\n" >&2',
      "      exit 1",
      "    fi",
      '    case "$1" in',
      "      run)",
      '        if [ -n "${PULSO_FALLA_EXPORT:-}" ]; then',
      '          printf "el deployment no contesta\\n" >&2',
      "          exit 7",
      "        fi",
      '        fabricar "$@" || exit 1',
      "        ;;",
      "    esac",
      "    ;;",
      "esac",
      "exit 0",
    ].join("\n"),
  );

  // El sudo de mentira: apunta lo que le llega —y, cuando viene con `-S`, la
  // contraseña que lee de la entrada estándar, que es como se la da el envoltorio
  // que el guion lleva delante cuando el comando ya la ha tecleado— y ejecuta lo
  // que le piden tal cual, sin cambiar de usuario ni preguntar nada. Sin él, un
  // `sudo` de verdad en la prueba se quedaría esperando una contraseña que nadie
  // va a teclear.
  doble(
    "sudo",
    [
      'if [ "$1" = "-S" ]; then',
      "  shift",
      '  [ "$1" != "-p" ] || shift 2',
      '  IFS= read -r entregada || entregada=""',
      '  printf \'sudo -S clave=%s orden=%s\\n\' "$entregada" "$*" >> "$PULSO_LOG"',
      "else",
      '  printf \'sudo sin-clave orden=%s\\n\' "$*" >> "$PULSO_LOG"',
      "fi",
      'exec "$@"',
    ].join("\n"),
  );

  // Y una fecha de mentira, para que el sello de las copias sea el que diga la
  // prueba y no el del reloj.
  doble("date", 'printf "%s\\n" "${PULSO_FECHA:-2026-10-11-093042}"');

  const log = join(base, "docker.log");

  /**
   * Lanza el guion como lo lanzaría el comando del ordenador: con `sh`, las rutas
   * del NAS como argumentos y los dobles delante. Con `entorno` se le cambia el
   * humor a los dobles: un export que falla, un volumen que no se deja leer…
   */
  const copiar = (
    opciones: { conservar?: number; raiz?: string } = {},
    entorno: Record<string, string> = {},
  ) => {
    const args = [
      "--raiz",
      opciones.raiz ?? shPath(proyecto),
      "--respaldos",
      shPath(respaldos),
    ];
    if (opciones.conservar !== undefined) {
      args.push("--conservar", String(opciones.conservar));
    }
    const extra = Object.entries(entorno)
      .map(([clave, valor]) => `${clave}='${valor}'`)
      .join(" ");
    const result = spawnSync(
      "sh",
      [
        "-c",
        `PATH='${shPath(bin)}':"$PATH" PULSO_LOG='${shPath(log)}' ${extra} sh '${shPath(GUION)}' ${args
          .map((value) => `'${value}'`)
          .join(" ")}`,
      ],
      { encoding: "utf8" },
    );
    return {
      status: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      resumen: parseBackupResult(result.stdout),
    };
  };

  /** Lo que se le ha pedido a Docker, en orden; sin archivo, no se le pidió nada. */
  const ordenes = () => {
    try {
      return lineas(readFileSync(log, "utf8"));
    } catch {
      return [];
    }
  };

  /** Lo que hay en la carpeta de las copias, ordenado. */
  const copias = () => readdirSync(respaldos).sort();

  /** Una copia de una fecha concreta, con su fecha de modificación, para poder
   * comprobar qué se conserva y qué se borra. */
  const copiaVieja = (nombre: string, cuando: string) => {
    const path = join(respaldos, nombre);
    writeFileSync(path, "copia vieja\n");
    const fecha = Date.parse(cuando) / 1000;
    utimesSync(path, fecha, fecha);
  };

  /**
   * Lanza el guion como lo lanza el comando del ordenador **cuando ya tiene la
   * contraseña tecleada**: la orden que arma `backupWords` —la clave por la entrada
   * estándar, el guion por el tubo y el envoltorio delante—, que es la mitad que no
   * se puede probar sin un NAS.
   */
  const copiarConClave = (
    clave: string,
    entorno: Record<string, string> = {},
  ) => {
    const orden = backupWords({
      script: readFileSync(GUION, "utf8"),
      root: shPath(proyecto),
      backups: shPath(respaldos),
      keep: "7",
      clave: true,
    });
    const extra = Object.entries(entorno)
      .map(([nombre, valor]) => `${nombre}='${valor}'`)
      .join(" ");
    // La orden se le da al `sh` por un archivo, no como argumento: es el guion
    // entero troceado y entrecomillado —unos 25 KB—, y como argumento de Windows se
    // corta por donde le pille. La contraseña, por la entrada estándar, que es por
    // donde la recibe el `read` del principio.
    const fichero = join(base, "orden-con-clave.sh");
    writeFileSync(fichero, `${orden.join(" ")}\n`);
    const result = spawnSync(
      "sh",
      [
        "-c",
        `PATH='${shPath(bin)}':"$PATH" PULSO_LOG='${shPath(log)}' ${extra} sh '${shPath(fichero)}'`,
      ],
      { encoding: "utf8", input: `${clave}\n` },
    );
    return {
      status: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      resumen: parseBackupResult(result.stdout),
    };
  };

  return {
    base,
    proyecto,
    respaldos,
    copiar,
    copiarConClave,
    ordenes,
    copias,
    copiaVieja,
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

describe.skipIf(!shListo)("el guion de la copia previa, de verdad", DE_VERDAD, () => {
  test("hace las dos copias y dice dónde están", () => {
    const { nas } = conNas();
    const run = nas.copiar();

    expect(run.status).toBe(0);
    expect(run.resumen).toMatchObject({
      volumen: "taller_datos",
      datos: "datos-2026-10-11-093042.tar.gz",
      export: "export-2026-10-11-093042.zip",
      conservar: "7",
      borrados: "0",
    });

    // Los archivos que dice el resumen son los que hay de verdad.
    expect(nas.copias()).toEqual([
      "datos-2026-10-11-093042.tar.gz",
      "export-2026-10-11-093042.zip",
    ]);
    // Y lo cuenta en el camino, sin enseñar ninguna credencial.
    expect(run.stdout).toContain("export hecho");
    expect(run.stdout).toContain("volumen copiado");
  });

  test("el export va antes de parar el backend, y el backend vuelve a arrancar", () => {
    const { nas } = conNas();
    const run = nas.copiar();
    expect(run.status).toBe(0);

    const ordenes = nas.ordenes();
    const indice = (fragmento: string) =>
      ordenes.findIndex((orden) => orden.includes(fragmento));

    const export_ = indice("export --include-file-storage");
    const parada = indice("stop backend");
    const arranque = indice("start backend");

    expect(export_).toBeGreaterThanOrEqual(0);
    expect(parada).toBeGreaterThan(export_);
    expect(arranque).toBeGreaterThan(parada);
    // Una sola parada y un solo arranque: el taller no se queda a medias.
    expect(
      ordenes.filter((orden) => orden.includes("stop backend")),
    ).toHaveLength(1);
    expect(
      ordenes.filter((orden) => orden.includes("start backend")),
    ).toHaveLength(1);
  });

  test("con la contraseña ya tecleada, el sudo de dentro la recibe y no la pregunta", () => {
    const { nas } = conNas();
    const clave = "clave-de-mentira";

    // El export y la copia en frío necesitan root en un NAS. Primero, sin
    // contraseña —el guion lanzado a mano—: tira del `sudo` de siempre.
    expect(nas.copiar({}, { PULSO_SIN_RAIZ: "1" }).status).toBe(0);
    const primera = nas.ordenes();
    const sinClave = primera.filter((linea) => linea.startsWith("sudo"));
    expect(sinClave.length).toBeGreaterThan(0);
    expect(
      sinClave.every((linea) => linea.startsWith("sudo sin-clave orden=")),
    ).toBe(true);

    // Y ahora con ella, por el camino del comando: la clave va por la entrada
    // estándar, el envoltorio tapa el `sudo` del guion y todas sus llamadas —las del
    // export, las de los contenedores y las del volumen— la llevan sin preguntar.
    const run = nas.copiarConClave(clave, { PULSO_SIN_RAIZ: "1" });
    expect(run.status).toBe(0);
    expect(run.resumen).toMatchObject({ volumen: "taller_datos" });
    expect(run.stdout).toContain("volumen copiado");

    const conClave = nas
      .ordenes()
      .slice(primera.length)
      .filter((linea) => linea.startsWith("sudo"));
    expect(conClave.length).toBeGreaterThanOrEqual(3);
    expect(
      conClave.every((linea) =>
        linea.startsWith(`sudo -S clave=${clave} orden=`),
      ),
    ).toBe(true);
    // Las dos copias pasan por ahí, y el backend también (se para y se arranca en
    // frío para el volumen).
    expect(conClave.some((linea) => linea.includes("export"))).toBe(true);
    expect(conClave.some((linea) => linea.includes("stop backend"))).toBe(true);
    expect(conClave.some((linea) => linea.includes("start backend"))).toBe(true);
    expect(nas.copias()).toEqual([
      "datos-2026-10-11-093042.tar.gz",
      "export-2026-10-11-093042.zip",
    ]);
  });

  test("el volumen es el que dice Docker, no el que se supone", () => {
    const propio = conNas();
    propio.nas.copiar({}, { PULSO_VOLUMEN: "un-nombre-raro_datos" });
    expect(
      propio.nas
        .ordenes()
        .some((orden) => orden.includes("un-nombre-raro_datos:/datos")),
    ).toBe(true);

    // Y si Docker no contesta —volumen sin etiquetas, o Docker viejo— queda el
    // nombre de siempre: el de la carpeta del proyecto.
    const sinRespuesta = conNas();
    sinRespuesta.nas.copiar({}, { PULSO_SIN_VOLUMEN: "1" });
    expect(
      sinRespuesta.nas
        .ordenes()
        .some((orden) => orden.includes("pulso-taller_datos:/datos")),
    ).toBe(true);
    expect(
      sinRespuesta.nas.copiar({}, { PULSO_SIN_VOLUMEN: "1" }).resumen,
    ).toMatchObject({ volumen: "pulso-taller_datos" });
  });

  test("se puede lanzar dos veces seguidas: el sello no se repite", () => {
    const { nas } = conNas();
    expect(nas.copiar().status).toBe(0);
    expect(nas.copiar({}, { PULSO_FECHA: "2026-10-11-101500" }).status).toBe(0);

    expect(nas.copias()).toEqual([
      "datos-2026-10-11-093042.tar.gz",
      "datos-2026-10-11-101500.tar.gz",
      "export-2026-10-11-093042.zip",
      "export-2026-10-11-101500.zip",
    ]);
  });

  test("si el export falla, no se ha parado nada: el taller sigue como estaba", () => {
    const { nas } = conNas();
    const run = nas.copiar({}, { PULSO_FALLA_EXPORT: "1" });

    expect(run.status).not.toBe(0);
    expect(run.resumen).toBeNull();
    expect(run.stderr).toContain("el export no ha salido");
    // Ni una parada, ni una copia a medias.
    expect(nas.ordenes().join("\n")).not.toContain("stop backend");
    expect(nas.copias()).toEqual([]);
  });

  test("si el empaquetado del volumen falla, el backend vuelve a arrancar igual", () => {
    const { nas } = conNas();
    const run = nas.copiar({}, { PULSO_FALLA_VOLUMEN: "1" });

    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain("el backend se ha vuelto a arrancar");
    // La copia lógica sí estaba hecha, y el backend no se queda caído.
    expect(nas.ordenes().join("\n")).toContain("stop backend");
    expect(nas.ordenes().join("\n")).toContain("start backend");
    expect(nas.copias()).toEqual(["export-2026-10-11-093042.zip"]);
  });

  test("conserva las últimas de cada tipo y borra las más viejas", () => {
    const { nas } = conNas();
    // Tres copias de datos de aquella manera y una lógica: con dos que se
    // conservan, de las de datos se van las dos más viejas y la lógica se queda.
    nas.copiaVieja("datos-2026-01-01-000000.tar.gz", "2026-01-01T00:00:00Z");
    nas.copiaVieja("datos-2026-02-01-000000.tar.gz", "2026-02-01T00:00:00Z");
    nas.copiaVieja("datos-2026-05-01-000000.tar.gz", "2026-05-01T00:00:00Z");
    nas.copiaVieja("export-2026-01-01-000000.zip", "2026-01-01T00:00:00Z");

    const run = nas.copiar({ conservar: 2 });

    expect(run.status).toBe(0);
    expect(run.resumen?.borrados).toBe("2");
    expect(nas.copias()).toEqual([
      "datos-2026-05-01-000000.tar.gz",
      "datos-2026-10-11-093042.tar.gz",
      "export-2026-01-01-000000.zip",
      "export-2026-10-11-093042.zip",
    ]);
    expect(run.stdout).toContain("se han borrado 2 copias viejas");
    // Y el resumen dice cuántas se conservan, que es lo que enseña el panel.
    expect(run.resumen?.conservar).toBe("2");
  });

  test("no se conserva nada que no sea suyo", () => {
    const { nas } = conNas();
    // Un archivo de otra cosa en la misma carpeta: no se toca.
    const ajeno = join(nas.respaldos, "notas-del-taller.txt");
    writeFileSync(ajeno, "no soy una copia\n");
    nas.copiaVieja("datos-2026-01-01-000000.tar.gz", "2026-01-01T00:00:00Z");

    expect(nas.copiar({ conservar: 1 }).status).toBe(0);
    expect(nas.copias()).toContain("notas-del-taller.txt");
    expect(nas.copias()).not.toContain("datos-2026-01-01-000000.tar.gz");
  });

  test("en una carpeta sin proyecto para antes de tocar nada", () => {
    const { nas } = conNas();
    const run = nas.copiar({ raiz: "/volume1/docker/otra-cosa" });

    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain(
      "no veo el proyecto en /volume1/docker/otra-cosa",
    );
    expect(nas.ordenes()).toEqual([]);
    expect(nas.copias()).toEqual([]);
  });

  test("lo que no entiende no lo hace a medias: se queja y sale", () => {
    const { nas } = conNas();
    const result = spawnSync("sh", [shPath(GUION), "--conservar", "muchas"], {
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("--conservar tiene que ser un número");

    const malo = spawnSync("sh", [shPath(GUION), "--loquesea"], {
      encoding: "utf8",
    });
    expect(malo.status).not.toBe(0);
    expect(malo.stderr).toContain("no conozco la opción --loquesea");

    // Y la ayuda se explica sola, para poder lanzarlo a mano en el NAS.
    const ayuda = spawnSync("sh", [shPath(GUION), "--help"], {
      encoding: "utf8",
    });
    expect(ayuda.status).toBe(0);
    expect(ayuda.stdout).toContain("--respaldos");
    expect(ayuda.stdout).toContain("--conservar");
    expect(nas.ordenes()).toEqual([]);
  });
});
