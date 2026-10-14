import { spawnSync } from "node:child_process";
import {
  chmodSync,
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
import { afterAll, describe, expect, test } from "vitest";
import {
  MIN_FREE_MB,
  composeVerdict,
  containersVerdict,
  copiesVerdict,
  dockerVerdict,
  doctorPanelLines,
  doctorReport,
  doctorScript,
  parseDoctorResult,
  projectVerdict,
  sudoVerdict,
} from "../scripts/nas-doctor-lib.mjs";
import { DEFAULT_BACKUP_PATH } from "../scripts/nas-backup-lib.mjs";
import { resolveConfig, usage } from "../scripts/nas-setup-lib.mjs";

/**
 * El doctor (`npm run nas:doctor`, que es `npm run nas -- --doctor`) habla por SSH
 * con un Synology: no se puede importar sin intentar conectarse a un NAS que no
 * está. Por eso lo que se prueba aquí son las piezas puras de
 * `scripts/nas-doctor-lib.mjs` —cómo se lee su resumen, qué dice de cada cosa y
 * el panel— y, además, **el guion que se ejecuta dentro del NAS se ejecuta de
 * verdad**, contra una carpeta temporal y con dobles de `docker`, `sudo` y `curl`
 * en el `PATH`.
 *
 * Eso último es lo que más importa, porque el doctor vale justo por lo que dice
 * del entorno: dónde está el binario de Docker, si hace falta `sudo` y qué PATH
 * tiene, si Compose ve el proyecto, qué contenedores hay —y que el de las
 * funciones esté terminado es lo normal, no una avería— y si se puede escribir
 * donde van las copias. Y, por debajo de todo, que **no cambie nada**: ni un
 * archivo en el NAS, ni un contenedor tocado.
 */

/** Windows → la ruta que entiende el `sh` de Git Bash (`/c/Users/...`). */
const shPath = (path: string) =>
  path
    .replace(/\\/g, "/")
    .replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`);

/** ¿Hay un `sh` de verdad con sus herramientas? Sin él, la prueba de verdad no corre. */
const shListo =
  spawnSync("sh", ["-c", "command -v awk head tail tr id df"], {
    encoding: "utf8",
  }).status === 0;

/** Las líneas con algo de un texto. */
const lineas = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");

/**
 * El guion se lanza de verdad y tarda lo suyo —abre unos cuantos procesos—; el
 * límite de Vitest, cinco segundos, se queda corto en cuanto la máquina tiene algo
 * más que hacer, y entonces falla la prueba por lo que tarda el ordenador, no por
 * lo que hace el guion.
 */
const DE_VERDAD = { timeout: 30_000 };

/** Un resumen como el de un NAS listo: todo en su sitio. */
const sano = (extra: Record<string, unknown> = {}) => ({
  raiz: "si",
  compose: "si",
  env: "si",
  grupos: "users,administrators",
  docker: "/usr/local/bin/docker",
  compose_cmd: "plugin",
  docker_ok: "si",
  sin_sudo: "no",
  sudo: "pide-clave",
  sudo_path: "si",
  compose_lee: "si",
  contenedores:
    "app:running,backend:running,dashboard:running,vigilante:running,funciones:exited",
  volumen: "pulso-taller_datos",
  salud: "si",
  respaldos: "si",
  espacio: "13000000",
  ...extra,
});

/* ------------------------------------------------------------------ */
/* La opción --doctor, y su resumen                                    */
/* ------------------------------------------------------------------ */

describe("el doctor, pedido y leído", () => {
  test("--doctor es un interruptor: no pide valor y sigue haciendo falta el NAS", () => {
    const config = resolveConfig(["--doctor", "--host", "192.168.1.20"]);
    expect(config.errors).toEqual([]);
    expect(config.doctor).toBe(true);
    // Sin NAS no hay entorno que mirar: el host sigue siendo obligatorio.
    expect(resolveConfig(["--doctor"]).errors).toContain(
      "falta el NAS: --host IP-del-NAS (o NAS_HOST)",
    );
  });

  test("--doctor no se combina con lo que sí cambia cosas, ni con --check", () => {
    const juntos = resolveConfig([
      "--doctor",
      "--host",
      "nas",
      "--force-compose",
      "--new-key",
    ]);
    expect(juntos.errors.join("\n")).toContain(
      "--doctor no cambia nada, así que no se combina con --force-compose ni --new-key",
    );
    // Y son dos miradas distintas: el doctor mira el entorno, --check el taller.
    expect(
      resolveConfig(["--doctor", "--check", "--host", "nas"]).errors.join("\n"),
    ).toContain("--doctor y --check miran cosas distintas");
    // Cada uno por su lado sigue valiendo.
    expect(resolveConfig(["--host", "nas", "--doctor"]).errors).toEqual([]);
    expect(resolveConfig(["--host", "nas", "--check"]).errors).toEqual([]);
  });

  test("la ayuda explica qué mira el doctor y que no cambia nada", () => {
    const texto = usage().join("\n");
    expect(texto).toContain("--doctor --host IP-del-NAS");
    expect(texto).toContain("--doctor                 mira el entorno del NAS");
    expect(texto).toContain("Docker, sudo y sus grupos, Compose, contenedores y");
    expect(texto).toContain("Tampoco cambia nada");
  });

  test("el resumen del doctor se lee aunque venga con la seudo-terminal del SSH", () => {
    const salida = [
      "nas: cuenta: ricardo · grupos: users,administrators",
      "nas: docker: /usr/local/bin/docker",
      `PULSO_DOCTOR raiz=si compose=si env=si grupos=users,administrators docker=/usr/local/bin/docker compose_cmd=plugin docker_ok=si sin_sudo=no sudo=pide-clave sudo_path=no compose_lee=si contenedores=app:running,backend:running,dashboard:running,vigilante:running,funciones:exited volumen=pulso-taller_datos salud=si respaldos=si espacio=13000000`,
      "nas: listo",
      "PULSO_CHECK raiz=si",
    ].join("\r\n");

    expect(parseDoctorResult(salida)).toEqual({
      raiz: "si",
      compose: "si",
      env: "si",
      grupos: "users,administrators",
      docker: "/usr/local/bin/docker",
      compose_cmd: "plugin",
      docker_ok: "si",
      sin_sudo: "no",
      sudo: "pide-clave",
      sudo_path: "no",
      compose_lee: "si",
      contenedores:
        "app:running,backend:running,dashboard:running,vigilante:running,funciones:exited",
      volumen: "pulso-taller_datos",
      salud: "si",
      respaldos: "si",
      espacio: "13000000",
    });
    // El resumen de otro comando no se confunde con este.
    expect(parseDoctorResult("PULSO_CHECK raiz=si\nPULSO_SETUP env=si\n")).toBeNull();
    expect(parseDoctorResult("nada que leer\n")).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Lo que dice de cada cosa                                            */
/* ------------------------------------------------------------------ */

describe("lo que dice el doctor", () => {
  test("del proyecto: la carpeta, el docker-compose.yml y el .env", () => {
    expect(projectVerdict(sano())).toMatchObject({ ok: true });
    expect(projectVerdict(sano({ env: "no" }))).toMatchObject({
      ok: false,
      detail: "la carpeta está, pero le falta .env",
    });
    expect(projectVerdict(sano({ compose: "no", env: "no" }))).toMatchObject({
      detail: "la carpeta está, pero le falta docker-compose.yml y .env",
    });
    const sinCarpeta = projectVerdict({ raiz: "no" });
    expect(sinCarpeta.ok).toBe(false);
    expect(sinCarpeta.fix).toContain("npm run nas --");
  });

  test("de Docker: dónde está, con quién se le habla y si contesta", () => {
    expect(dockerVerdict(sano())).toMatchObject({
      ok: true,
      detail:
        "en /usr/local/bin/docker y contesta con sudo · «docker compose»",
    });
    expect(dockerVerdict(sano({ sin_sudo: "si" }))).toMatchObject({
      ok: true,
      detail: "en /usr/local/bin/docker y contesta sin sudo · «docker compose»",
    });
    // Sin binario: lo primero que falta en un NAS recién estrenado.
    expect(dockerVerdict(sano({ docker: "no" }))).toMatchObject({
      ok: false,
      fix: expect.stringContaining("Container Manager"),
    });
    // Con contraseña de sudo y sin terminal donde teclearla, no se puede preguntar.
    expect(
      dockerVerdict(sano({ docker_ok: "no", sudo: "pide-clave" })),
    ).toMatchObject({
      ok: false,
      detail: expect.stringContaining("la contraseña de sudo"),
    });
    // Y si sudo se pudo usar pero el servicio está caído, es otra cosa.
    expect(
      dockerVerdict(sano({ docker_ok: "no", sin_sudo: "no", sudo: "libre" })),
    ).toMatchObject({
      ok: false,
      detail: expect.stringContaining("no contesta"),
    });
  });

  test("de la cuenta y el sudo: los grupos y la trampa del PATH", () => {
    // La cuenta habla con Docker sin sudo: no hay nada que avisar.
    expect(sudoVerdict(sano({ sin_sudo: "si" }))).toMatchObject({
      ok: true,
      detail: expect.stringContaining(
        "la cuenta (users,administrators) habla con Docker sin sudo",
      ),
    });
    // La trampa clásica: `sudo docker` no encuentra el binario...
    const trampa = sudoVerdict(sano({ sudo_path: "no" }));
    expect(trampa.ok).toBe(true);
    expect(trampa.detail).toContain("«sudo docker» no lo encuentra");
    // ...y se dice por qué da igual: los comandos lo llaman por su ruta.
    expect(trampa.detail).toContain("lo llaman por su ruta");
    expect(sudoVerdict(sano({ sudo_path: "si" })).detail).toContain(
      "el PATH de sudo sí lleva docker",
    );
    // Sin sudo y sin acceso a Docker, el taller no se puede ni mirar.
    expect(
      sudoVerdict(sano({ sudo: "no", sin_sudo: "no" })).ok,
    ).toBe(false);
    expect(sudoVerdict(sano({ sudo: "libre" })).detail).toContain(
      "sudo no pide contraseña",
    );
  });

  test("de Compose: qué forma hay y si ve el proyecto", () => {
    expect(composeVerdict(sano())).toMatchObject({
      ok: true,
      detail: "«docker compose» lee el proyecto desde su carpeta",
    });
    expect(composeVerdict(sano({ compose_cmd: "binario" })).detail).toContain(
      "«docker-compose»",
    );
    expect(composeVerdict(sano({ compose_cmd: "no" }))).toMatchObject({
      ok: false,
      fix: expect.stringContaining("Container Manager"),
    });
    // El fallo que se llevaba las copias a medias: Compose no ve el proyecto.
    expect(composeVerdict(sano({ compose_lee: "no" }))).toMatchObject({
      ok: false,
      fix: expect.stringContaining("docker-compose.yml y el .env"),
    });
    expect(composeVerdict(sano({ compose_lee: "no-mira" })).detail).toContain(
      "no se ha podido mirar",
    );
    expect(composeVerdict(sano({ raiz: "no" })).detail).toContain(
      "no hay proyecto que leer",
    );
  });

  test("de los contenedores: los que tienen que estar en pie, y el recado", () => {
    expect(containersVerdict(sano())).toMatchObject({
      ok: true,
      detail: expect.stringContaining("funciones terminado"),
    });
    // El de las funciones terminado NO es una avería: es lo que hace.
    expect(containersVerdict(sano()).ok).toBe(true);
    expect(containersVerdict(sano()).detail).toContain("funciones terminado");
    expect(
      containersVerdict(sano({ contenedores: "app:running,backend:running,dashboard:running,vigilante:running,funciones:parado" })).detail,
    ).toContain("funciones parado");
    // Un backend parado, sí.
    const parado = containersVerdict(
      sano({
        contenedores:
          "app:running,backend:parado,dashboard:running,vigilante:running,funciones:exited",
      }),
    );
    expect(parado).toMatchObject({ ok: false });
    expect(parado.detail).toContain("backend parado");
    expect(parado.fix).toContain("npm run nas --");
    // Sin ninguno en pie, la puesta en marcha.
    expect(
      containersVerdict(sano({ contenedores: "app:falta,backend:falta" })),
    ).toMatchObject({ ok: false, fix: expect.stringContaining("--app-url") });
    // El vigilante parado también se cuenta: es el que sube los cambios.
    const sinVigilante = containersVerdict(
      sano({
        contenedores:
          "app:running,backend:running,dashboard:running,vigilante:parado,funciones:exited",
      }),
    );
    expect(sinVigilante).toMatchObject({
      ok: false,
      detail: expect.stringContaining("vigilante parado"),
    });
    // Y con dónde mirar por qué se paró, que es lo que se pregunta después.
    expect(sinVigilante.fix).toContain("logs vigilante");
    // Un recado que sale con error no es un recado hecho: ahí el esquema y las
    // funciones no han subido, y se dice con su salida delante.
    const fallo = containersVerdict(
      sano({
        contenedores:
          "app:running,backend:running,dashboard:running,vigilante:running,funciones:exited-127",
      }),
    );
    expect(fallo).toMatchObject({ ok: false });
    expect(fallo.detail).toContain("funciones terminado con error (salida 127)");
    expect(fallo.fix).toContain("logs");
    // Y con salida 0 sí es lo normal: el recado está hecho.
    const bien = containersVerdict(
      sano({
        contenedores:
          "app:running,backend:running,dashboard:running,vigilante:running,funciones:exited-0",
      }),
    );
    expect(bien.ok).toBe(true);
    expect(bien.detail).toContain("funciones terminado ·");

    // Con todo en pie pero el backend mudo, la culpa es del backend.
    expect(containersVerdict(sano({ salud: "no" }))).toMatchObject({
      ok: false,
      detail: expect.stringContaining("no contesta en su puerto"),
    });
    // Y si no se pudo preguntar, se dice: no se da por bueno.
    expect(containersVerdict(sano({ contenedores: "" })).detail).toContain(
      "no se ha podido preguntar",
    );
  });

  test("de las copias: la carpeta, el permiso y el sitio que queda", () => {
    // El espacio, en las unidades en las que se lee de un vistazo: 13000000 KB
    // son 12 GB, no «13000000 MB».
    expect(copiesVerdict(sano())).toMatchObject({
      ok: true,
      detail: "carpeta lista · 12 GB libres",
    });
    expect(copiesVerdict(sano({ espacio: String(500 * 1024 * 1024) })).detail).toContain(
      "500 GB libres",
    );
    // Y en teras, como el NAS de verdad: 13384612052 KB son 12 TB.
    expect(copiesVerdict(sano({ espacio: "13384612052" })).detail).toContain(
      "12 TB libres",
    );
    // Todavía no existe: la primera copia la crea, y eso no es un fallo.
    expect(copiesVerdict(sano({ respaldos: "no" })).ok).toBe(true);
    expect(copiesVerdict(sano({ respaldos: "sin-permiso" }))).toMatchObject({
      ok: false,
      detail: expect.stringContaining("no puede escribir"),
    });
    // Casi sin sitio: un tar a medias se descubre el día que hace falta.
    const lleno = copiesVerdict(sano({ espacio: String((MIN_FREE_MB - 100) * 1024) }));
    expect(lleno.ok).toBe(false);
    expect(lleno.detail).toContain("casi sin sitio: quedan 1948 MB");
    expect(lleno.detail).toContain("(las copias piden unos 2048 MB)");
    // Y sin saber cuánto queda, no se inventa: se dice que no se sabe.
    expect(copiesVerdict(sano({ espacio: "no" })).detail).toContain(
      "desconocido",
    );
  });

  test("el informe va del ordenador al taller, en el orden en que se comprueba", () => {
    const informe = doctorReport(sano(), {
      host: "192.168.1.20",
      user: "admin",
      port: "2222",
    });
    expect(informe.map((finding) => finding.id)).toEqual([
      "ssh",
      "project",
      "docker",
      "sudo",
      "compose",
      "containers",
      "copies",
    ]);
    expect(informe[0]).toMatchObject({
      ok: true,
      detail: "entra admin@192.168.1.20 por el puerto 2222",
    });
    expect(informe.every((finding) => finding.ok)).toBe(true);
    // Si no se llega, es lo primero y con su arreglo.
    const sinSsh = doctorReport(sano(), { reachable: false, host: "nas", user: "admin" });
    expect(sinSsh[0]).toMatchObject({
      ok: false,
      detail: "no se llega a admin@nas",
    });
  });
});

/* ------------------------------------------------------------------ */
/* El panel                                                            */
/* ------------------------------------------------------------------ */

describe("el panel del doctor", () => {
  const panel = (result: Record<string, unknown>, extra = {}) =>
    doctorPanelLines({
      host: "192.168.1.20",
      user: "admin",
      port: "22",
      result,
      ...extra,
    }).join("\n");

  test("termina en lo que se puede lanzar ya, con los comandos exactos", () => {
    const texto = panel(sano());
    const lines = doctorPanelLines({
      host: "192.168.1.20",
      user: "admin",
      result: sano(),
    });
    expect(texto).toContain("Todo en orden: el entorno está listo.");
    expect(texto).toContain("admin@192.168.1.20:/volume1/docker/pulso-taller");
    expect(lines.at(-1)).toBe(
      "                   npm run nas:check -- --host 192.168.1.20",
    );
    expect(texto).toContain("npm run nas:backup -- --host 192.168.1.20");
    // Del .env solo se mira si está, y se dice.
    expect(texto).toContain("el doctor no lee ningún valor");
  });

  test("cuando algo falla, cuenta cuántas cosas hay que mirar y dónde", () => {
    const texto = panel(sano({ docker: "no", respaldos: "sin-permiso" }));
    expect(texto).toContain("2 cosas que mirar: los arreglos, arriba.");
    expect(texto).toContain("Container Manager");
    expect(texto).toContain("npm run nas:doctor -- --host 192.168.1.20");
    // Una sola, en singular.
    expect(panel(sano({ docker: "no" }))).toContain(
      "1 cosa que mirar: los arreglos, arriba.",
    );
  });

  test("lo que no se pudo mirar se dice, en vez de darlo por bueno", () => {
    const texto = panel(
      sano({ contenedores: "", sudo_path: "no-mira", compose_lee: "no-mira" }),
    );
    expect(texto).toContain("Sin mirar: los contenedores y Compose y el PATH de sudo");
    expect(texto).toContain("Se ve al lanzar la copia o la puesta en marcha.");
    // Y ese «sin mirar» no se cuenta como avería del entorno.
    expect(texto).toContain("2 cosas que mirar");
  });
});

/* ------------------------------------------------------------------ */
/* El guion del doctor, ejecutado de verdad                            */
/* ------------------------------------------------------------------ */

/** Un NAS de mentira: la carpeta del proyecto, la de las copias y los dobles. */
function montarNas() {
  const base = mkdtempSync(join(tmpdir(), "pulso-doctor-"));
  const proyecto = join(base, "pulso-taller");
  const respaldos = join(base, "respaldos");
  mkdirSync(proyecto, { recursive: true });
  writeFileSync(join(proyecto, "docker-compose.yml"), "services: {}\n");
  writeFileSync(join(proyecto, ".env"), "INSTANCE_SECRET=0f0f0f0f0f0f0f0f\n");
  mkdirSync(respaldos);

  const bin = join(base, "bin");
  mkdirSync(bin);
  const doble = (nombre: string, cuerpo: string) => {
    const path = join(bin, nombre);
    writeFileSync(path, `#!/bin/sh\n${cuerpo}`);
    chmodSync(path, 0o755);
  };

  // El docker de mentira: apunta lo que se le pide, distingue si le hablan con
  // sudo —el doble de `sudo` deja marcado el entorno— y **se planta como el de
  // verdad** cuando no tiene el docker-compose.yml delante, que es lo que delata
  // que un guion no ha entrado en la carpeta del taller.
  doble(
    "docker",
    [
      'printf "%s\\n" "$*" >> "$PULSO_LOG"',
      'case "$1" in',
      // Sin sudo no contesta, como en un Synology cualquiera: la cuenta normal no
      // habla con Docker. `PULSO_DOCKER_ABIERTO` es para el NAS donde sí puede.
      '  info) if [ -z "${PULSO_CON_SUDO:-}" ] && [ -z "${PULSO_DOCKER_ABIERTO:-}" ]; then',
      "          exit 1",
      "        fi",
      "        exit 0 ;;",
      "  compose)",
      "    shift",
      '    case "$1" in',
      "      version) exit 0 ;;",
      "    esac",
      '    if [ ! -f docker-compose.yml ]; then',
      '      printf "no configuration file provided: not found\\n" >&2',
      "      exit 1",
      "    fi",
      '    case "$1" in',
      '      config) [ -z "${PULSO_COMPOSE_ILEGIBLE:-}" ] || exit 1; exit 0 ;;',
      "      ps)",
      '        [ -z "${PULSO_SIN_CONTENEDORES:-}" ] || exit 0',
      '        for ultimo in "$@"; do :; done',
      '        printf "falso-%s\\n" "$ultimo" ;;',
      "      *) exit 0 ;;",
      "    esac",
      "    ;;",
      '  volume) printf "%s\\n" "${PULSO_VOLUMEN:-pulso-taller_datos}" ;;',
      "  inspect)",
      '    for ultimo in "$@"; do :; done',
      '    servicio="${ultimo#falso-}"',
      '    case "$3" in',
      '      *ExitCode*) printf "%s\\n" "${PULSO_SALIDA:-0}" ; exit 0 ;;',
      "    esac",
      '    case ",${PULSO_ESTADOS:-}," in',
      '      *",$servicio,"*) printf "exited\\n" ;;',
      '      *) printf "running\\n" ;;',
      "    esac",
      "    ;;",
      "esac",
      "exit 0",
    ].join("\n"),
  );

  // El sudo de mentira: solo distingue si pide contraseña (y entonces `-n` falla,
  // como el de verdad) y con qué PATH contesta, que es la trampa que se mira.
  // Cuando ejecuta algo, deja marcado el entorno para que Docker lo sepa; y
  // apunta lo que se le pide, para poder comprobar que no se le llama de más.
  doble(
    "sudo",
    [
      'printf "sudo %s\\n" "$*" >> "$PULSO_LOG"',
      'if [ "$1" = "-n" ]; then',
      "  shift",
      '  if [ -n "${PULSO_SUDO_BLOQUEADO:-}" ]; then',
      '    printf "sudo: a password is required\\n" >&2',
      "    exit 1",
      "  fi",
      '  [ $# -gt 0 ] || exit 0',
      "  export PULSO_CON_SUDO=1",
      '  exec "$@"',
      "fi",
      'if [ "$1" = "sh" ] && [ "$2" = "-c" ]; then',
      '  if [ -n "${PULSO_SUDO_SIN_PATH:-}" ]; then',
      "    PATH='/usr/bin:/bin' exec sh -c \"$3\"",
      "  fi",
      '  exec sh -c "$3"',
      "fi",
      "export PULSO_CON_SUDO=1",
      'exec "$@"',
    ].join("\n"),
  );

  // Y un `curl` de mentira: el backend contesta o no, según diga la prueba.
  doble("curl", 'exit "${PULSO_CURL:-0}"');

  const log = join(base, "docker.log");
  const guion = join(base, "doctor.sh");

  /**
   * Lanza el guion tal y como lo lanza el comando del ordenador: con `sh`, las
   * rutas del NAS dentro del guion y los dobles delante. Se le da al `sh` por un
   * archivo y no como argumento, que es donde corta MSYS.
   */
  const mirar = (
    opciones: Record<string, unknown> = {},
    entorno: Record<string, string> = {},
  ) => {
    writeFileSync(
      guion,
      doctorScript({
        root: shPath(proyecto),
        backups: shPath(respaldos),
        interactive: false,
        ...opciones,
      }),
    );
    const extra = Object.entries(entorno)
      .map(([clave, valor]) => `${clave}='${valor}'`)
      .join(" ");
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
      resumen: parseDoctorResult(result.stdout),
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

  return { base, proyecto, respaldos, guion, mirar, ordenes };
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

describe.skipIf(!shListo)("el guion del doctor, de verdad", DE_VERDAD, () => {
  test("mira el entorno entero y lo cuenta", () => {
    const { nas } = conNas();
    const run = nas.mirar();

    expect(run.status).toBe(0);
    expect(run.resumen).toMatchObject({
      raiz: "si",
      compose: "si",
      env: "si",
      docker: shPath(join(nas.base, "bin", "docker")),
      compose_cmd: "plugin",
      docker_ok: "si",
      compose_lee: "si",
      contenedores:
        "app:running,backend:running,dashboard:running,vigilante:running,funciones:running",
      volumen: "pulso-taller_datos",
      salud: "si",
      respaldos: "si",
    });
    // El sitio que queda es un número: lo dice `df`, no la imaginación.
    expect(Number(run.resumen?.espacio)).toBeGreaterThan(0);
    // Y los grupos de la cuenta se cuentan.
    expect(run.resumen?.grupos).toBeTruthy();

    // El veredicto, con lo que ha contado: el entorno está listo.
    const informe = doctorReport(run.resumen ?? {}, {
      host: "192.168.0.47",
      user: "ricardo",
    });
    expect(informe.every((finding) => finding.ok)).toBe(true);
  });

  test("no escribe nada: ni un archivo, ni en las copias", () => {
    const { nas } = conNas();
    const rastro = (directory: string, prefijo = ""): string[] => {
      const lines: string[] = [];
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const relative = prefijo === "" ? entry.name : `${prefijo}/${entry.name}`;
        const path = join(directory, entry.name);
        if (entry.isDirectory()) lines.push(...rastro(path, relative));
        else lines.push(`${relative}:${statSync(path).size}`);
      }
      return lines.sort();
    };
    const antesProyecto = rastro(nas.proyecto);
    const antesRespaldos = rastro(nas.respaldos);

    expect(nas.mirar().status).toBe(0);

    expect(rastro(nas.proyecto)).toEqual(antesProyecto);
    expect(rastro(nas.respaldos)).toEqual(antesRespaldos);
  });

  test("solo pregunta: ni arranca, ni para, ni construye, ni borra", () => {
    const { nas } = conNas();
    expect(nas.mirar().status).toBe(0);

    const preguntas = nas.ordenes().join("\n");
    expect(preguntas).toContain("compose config -q");
    expect(preguntas).toContain("compose ps -a -q app");
    expect(preguntas).toContain("volume ls");
    expect(preguntas).not.toMatch(/up |build|down|stop|restart|rm |create |prune/);
  });

  test("sin terminal no se le pide la contraseña a sudo, y se dice lo que queda sin mirar", () => {
    const { nas } = conNas();
    // Un NAS donde Docker solo contesta con sudo, y ese sudo pide contraseña.
    const run = nas.mirar({}, { PULSO_SUDO_BLOQUEADO: "1" });

    expect(run.resumen).toMatchObject({
      docker_ok: "no",
      sin_sudo: "no",
      sudo: "pide-clave",
      sudo_path: "no-mira",
      contenedores: "",
    });
    const informe = doctorReport(run.resumen ?? {}, { host: "nas", user: "ricardo" });
    expect(informe.find((finding) => finding.id === "docker")).toMatchObject({
      ok: false,
      detail: expect.stringContaining("la contraseña de sudo"),
    });
    expect(informe.find((finding) => finding.id === "containers")).toMatchObject({
      ok: false,
    });
    // Y con terminal delante, lo mismo se mira entero: el sudo se usa y contesta.
    const conTerminal = nas.mirar(
      { interactive: true },
      { PULSO_SUDO_BLOQUEADO: "1" },
    );
    expect(conTerminal.resumen).toMatchObject({
      docker_ok: "si",
      sin_sudo: "no",
      sudo: "pide-clave",
      contenedores:
        "app:running,backend:running,dashboard:running,vigilante:running,funciones:running",
    });
    expect(
      doctorReport(conTerminal.resumen ?? {}, { host: "nas", user: "ricardo" }).every(
        (finding) => finding.ok,
      ),
    ).toBe(true);
  });

  test("la trampa del PATH de sudo se ve, y se explica por qué no estorba", () => {
    const { nas } = conNas();
    // `sudo docker` no encuentra el binario: el sudo del NAS impone su PATH.
    const run = nas.mirar({ interactive: true }, { PULSO_SUDO_SIN_PATH: "1" });

    expect(run.resumen).toMatchObject({ sudo_path: "no", docker_ok: "si" });
    const informe = doctorReport(run.resumen ?? {}, { host: "nas", user: "ricardo" });
    // No es una avería —los comandos llaman al binario por su ruta— pero se cuenta.
    expect(informe.find((finding) => finding.id === "sudo")).toMatchObject({
      ok: true,
      detail: expect.stringContaining("«sudo docker» no lo encuentra"),
    });
    expect(informe.find((finding) => finding.id === "sudo")?.detail).toContain(
      "lo llaman por su ruta",
    );
  });

  test("si la cuenta habla con Docker, no se le pide nada a sudo", () => {
    const { nas } = conNas();
    const run = nas.mirar({}, { PULSO_DOCKER_ABIERTO: "1" });

    expect(run.resumen).toMatchObject({
      sin_sudo: "si",
      docker_ok: "si",
      sudo_path: "no-hace-falta",
    });
    expect(sudoVerdict(run.resumen ?? {}).detail).toContain(
      "habla con Docker sin sudo",
    );
    // Ni una llamada a sudo para trabajar: no hace falta, y pedir la contraseña
    // sería molestar. (Preguntar si la pide —`sudo -n true`— no es pedirla.)
    expect(
      nas
        .ordenes()
        .filter((line) => line.startsWith("sudo ") && line.includes("docker")),
    ).toEqual([]);
  });

  test("el de las funciones terminado es lo normal; los otros, no", () => {
    const { nas } = conNas();
    // El recado hecho: el contenedor de las funciones terminó y se fue.
    const recado = nas.mirar({}, { PULSO_ESTADOS: "funciones" });
    expect(recado.resumen?.contenedores).toContain("funciones:exited");
    expect(
      containersVerdict(recado.resumen ?? {}),
    ).toMatchObject({ ok: true, detail: expect.stringContaining("funciones terminado") });

    // Y el recado que salió mal —el error 127 es «no encuentro ese comando», que
    // es lo que pasa cuando a la imagen le falta el guion dentro— se cuenta con su
    // salida: es la diferencia entre «terminó» y «no subió nada».
    const fallado = nas.mirar(
      {},
      { PULSO_ESTADOS: "funciones", PULSO_SALIDA: "127" },
    );
    expect(fallado.resumen?.contenedores).toContain("funciones:exited-127");
    const recadoFallado = containersVerdict(fallado.resumen ?? {});
    expect(recadoFallado.ok).toBe(false);
    expect(recadoFallado.detail).toContain(
      "funciones terminado con error (salida 127)",
    );

    // Y con el backend parado, sí: eso es una avería y se cuenta con su arreglo.
    const caido = nas.mirar({}, { PULSO_ESTADOS: "backend,funciones" });
    const verdict = containersVerdict(caido.resumen ?? {});
    expect(verdict).toMatchObject({ ok: false });
    expect(verdict.detail).toContain("backend parado");
    expect(verdict.detail).toContain("funciones terminado");
  });

  test("con el backend mudo, lo dice aunque todo esté en pie", () => {
    const { nas } = conNas();
    const run = nas.mirar({}, { PULSO_CURL: "7" });
    expect(run.resumen).toMatchObject({ salud: "no" });
    expect(containersVerdict(run.resumen ?? {})).toMatchObject({
      ok: false,
      detail: expect.stringContaining("no contesta en su puerto"),
    });
  });

  test("en una carpeta sin instalación lo dice, en vez de romperse", () => {
    const { nas } = conNas();
    const run = nas.mirar({ root: "/volume1/docker/otra-cosa" });

    expect(run.status).toBe(0);
    expect(run.resumen).toMatchObject({
      raiz: "no",
      compose: "no",
      env: "no",
      contenedores: "",
    });
    // Y sigue contando lo que sí puede mirar: Docker y las copias.
    expect(run.resumen?.docker).toBe(shPath(join(nas.base, "bin", "docker")));
    expect(run.resumen?.respaldos).toBe("si");
    const informe = doctorReport(run.resumen ?? {}, { host: "nas", user: "ricardo" });
    expect(informe.find((finding) => finding.id === "project")).toMatchObject({
      ok: false,
      detail: expect.stringContaining("no hay carpeta del proyecto"),
    });
  });

  test("del .env no sale ningún valor", () => {
    const { nas } = conNas();
    const secreto = "0123456789abcdef0123456789abcdef";
    writeFileSync(
      join(nas.proyecto, ".env"),
      `INSTANCE_SECRET=${secreto}\nCONVEX_ADMIN_KEY=pulso-taller|abcdef\n`,
    );

    const run = nas.mirar();
    expect(run.resumen).toMatchObject({ env: "si" });
    expect(run.stdout).not.toContain(secreto);
    expect(run.stdout).not.toContain("pulso-taller|abcdef");
  });

  test("la carpeta de las copias se mira donde se le dice", () => {
    const { nas } = conNas();
    // Otro sitio: el guion lo lleva dentro, no da nada por hecho.
    const run = nas.mirar({ backups: "/volume1/docker/otro-sitio" });
    expect(run.resumen).toMatchObject({ respaldos: "no" });
    // No existir todavía no es un fallo: la primera copia la crea.
    expect(copiesVerdict(run.resumen ?? {}).ok).toBe(true);
    // Y la de por defecto, si no se dice otra cosa, es la de la copia.
    expect(DEFAULT_BACKUP_PATH).toBe("/volume1/docker/respaldos");
    expect(doctorScript()).toContain(`RESPALDOS='${DEFAULT_BACKUP_PATH}'`);
  });
});
