// Las piezas de `npm run nas:doctor`, que se pueden probar sin un NAS delante: el
// **guion que se ejecuta dentro del NAS** (mira el entorno de arriba abajo, sin
// cambiar nada), la **lectura de su resumen** y el **panel** con el que termina.
//
// Viven aquí, y no en `nas-setup.mjs`, por lo mismo que las de la puesta en marcha
// y las de la copia: ese archivo habla por SSH con el NAS, así que importarlo
// desde una prueba intentaría conectarse. Al separarlas, el script y las pruebas
// usan exactamente el mismo texto y la misma regla, y el guion del NAS se puede
// ejecutar de verdad, con dobles en el `PATH`.
//
// El doctor no cambia nada: no escribe, no construye, no arranca y no para. Solo
// pregunta —a la shell, a Docker y a Compose— y explica lo que falta **antes** de
// intentar nada, que es justo lo que uno quiere saber cuando algo no sale: dónde
// está el binario de Docker, si hace falta `sudo` y qué PATH tiene, qué grupos
// lleva la cuenta, si Compose ve el proyecto, qué contenedores hay y si se puede
// escribir donde van las copias.
//
// No importa nada de Node a propósito: son funciones puras.

import { DEFAULT_BACKUP_PATH } from "./nas-backup-lib.mjs";
import {
  DEFAULT_PROJECT_PATH,
  parseSummary,
  shQuote,
  stateWords,
} from "./nas-setup-lib.mjs";

/** Colores del panel; sin nada, el texto sale tal cual (como en las pruebas). */
const NO_COLOR = {
  bold: (text) => text,
  dim: (text) => text,
  green: (text) => text,
  red: (text) => text,
  yellow: (text) => text,
};

/** Los contenedores de los que habla el doctor, en el orden en que se enseñan. */
export const SERVICIOS = ["app", "backend", "dashboard", "vigilante", "funciones"];

/** El puerto donde el backend contesta, dentro del NAS (igual que en `--check`). */
const BACKEND_HEALTH_URL = "http://127.0.0.1:3210/version";

/**
 * Por debajo de esto —2 GB— las copias están en peligro: un export y un tar
 * ocupan poco, pero quedarse sin sitio a mitad de un empaquetado deja la copia a
 * medias, y eso no se descubre hasta que hace falta.
 */
export const MIN_FREE_MB = 2048;

/**
 * El guion que mira el entorno dentro del NAS. **Solo mira**: no escribe nada, ni
 * siquiera una carpeta; lo único que cambia es lo que Docker apunta cuando se le
 * pregunta.
 *
 * Lo que no puede saber desde dentro es lo primero que se comprueba en el
 * ordenador —que se llega por SSH—, y lo que no puede saber sin permiso es todo
 * lo que depende de `sudo`: en un Synology el usuario normal no habla con Docker,
 * así que hace falta root para preguntarle. Con terminal delante se usa el `sudo`
 * que pide la contraseña —la pide por el `/dev/tty` de la conexión, igual que la
 * copia y la puesta en marcha—; sin terminal se miran solo las cosas que no
 * necesitan contraseña, y el panel dice lo que ha quedado sin mirar en vez de
 * inventarlo.
 *
 * El resumen que imprime al final es una sola línea `PULSO_DOCTOR clave=valor`
 * con las palabras justas —una ruta, un sí, un no, el estado de cada contenedor—,
 * y **ningún valor con espacios**, que el ordenador lo parte por espacios. Del
 * `.env` solo se dice si está: el doctor no lee lo que hay dentro.
 */
export function doctorScript({
  root = DEFAULT_PROJECT_PATH,
  backups = DEFAULT_BACKUP_PATH,
  interactive = false,
} = {}) {
  return `#!/bin/sh
# El entorno del NAS, de arriba abajo y sin tocar nada. Lo lanza el comando del
# ordenador con --doctor y no se queda en el NAS: viaja por la conexion, como los
# demas. Corre con sh, no con bash: en el NAS no hay bash de sobra.

set -u

RAIZ=${shQuote(root)}
RESPALDOS=${shQuote(backups)}
SALUD=${shQuote(BACKEND_HEALTH_URL)}
# Con terminal delante, el sudo que pide contrasena se puede usar (la pide por el
# /dev/tty de la conexion). Sin terminal, no: se quedaria esperando una
# contrasena que nadie va a teclear.
MIRAR_SUDO=${shQuote(interactive ? "si" : "no")}

log() { printf 'nas: %s\\n' "$*"; }

# Lo que se sabe y lo que no, con su valor de partida: lo que no se pueda mirar
# queda como desconocido en vez de inventado.
raiz="no"
compose="no"
env="no"
grupos="ninguno"
docker="no"
compose_cmd="no"
docker_ok="no"
sin_sudo="no"
sudo="no"
sudo_path="no-mira"
compose_lee="no-mira"
contenedores=""
volumen="no"
salud="no-mira"
respaldos="no"
espacio="no"

# --- La cuenta y el proyecto ---------------------------------------------------

grupos=$(id -Gn 2>/dev/null | tr ' ' ',' || true)
[ -n "$grupos" ] || grupos="ninguno"
log "cuenta: $(id -un 2>/dev/null || printf 'desconocida') · grupos: $grupos"

if [ -d "$RAIZ" ]; then
  raiz="si"
  [ -f "$RAIZ/docker-compose.yml" ] && compose="si"
  [ -f "$RAIZ/.env" ] && env="si"
  log "proyecto: $RAIZ (docker-compose.yml: $compose, .env: $env)"
else
  log "no existe la carpeta del proyecto: $RAIZ (la crea la puesta en marcha)"
fi

# --- Donde esta Docker ---------------------------------------------------------

# El \`sudo\` del NAS impone su propio PATH —sin /usr/local/bin, que es donde vive
# el binario—, asi que se busca el binario por sus rutas de siempre y se llama
# despues por la que aparezca: el PATH de sudo deja de importar.
buscar_binario() {
  opcion=$(command -v "$1" 2>/dev/null || true)
  for candidato in "$opcion" "/usr/local/bin/$1" "/var/packages/ContainerManager/target/usr/bin/$1"; do
    if [ -n "$candidato" ] && [ -x "$candidato" ]; then
      echo "$candidato"
      return 0
    fi
  done
  return 1
}

DOCKER=$(buscar_binario docker || true)
DOCKER_COMPOSE=$(buscar_binario docker-compose || true)
if [ -n "$DOCKER" ]; then
  docker="$DOCKER"
  log "docker: $DOCKER"
else
  log "no encuentro el binario docker: sin Container Manager no hay taller que mirar"
fi

# Y con quien se le habla: sin sudo si la cuenta ya puede, y con sudo si hace
# falta y se puede usar.
if command -v sudo >/dev/null 2>&1; then
  if sudo -n true 2>/dev/null; then
    sudo="libre"
  else
    sudo="pide-clave"
  fi
  log "sudo: $sudo"
else
  log "no hay sudo en el NAS: Docker tiene que dejarse usar a la cuenta $(id -un 2>/dev/null || printf 'desconocida')"
fi

# El comando de verdad de Compose, que es lo que hay que llamar despues; y el
# nombre corto (\`plugin\` o \`binario\`) es lo que viaja en el resumen, que va sin
# espacios.
SUDO=""
COMPOSE_CMD=""
if [ -n "$DOCKER" ] && $DOCKER info >/dev/null 2>&1; then
  sin_sudo="si"
  log "Docker contesta sin sudo: la cuenta esta en el grupo que toca"
fi
if [ "$sin_sudo" = "no" ]; then
  if [ "$sudo" = "libre" ]; then
    SUDO="sudo"
  elif [ "$sudo" = "pide-clave" ] && [ "$MIRAR_SUDO" = "si" ]; then
    SUDO="sudo"
    log "hace falta sudo para hablar con Docker: pedira la contrasena (se teclea igual que en la copia)"
  fi
fi
if [ -n "$DOCKER" ] && $SUDO $DOCKER info >/dev/null 2>&1; then
  docker_ok="si"
fi

# --- Compose -------------------------------------------------------------------

if [ -n "$DOCKER" ] && $SUDO $DOCKER compose version >/dev/null 2>&1; then
  COMPOSE_CMD="$DOCKER compose"
  compose_cmd="plugin"
elif [ -n "$DOCKER_COMPOSE" ] && $SUDO "$DOCKER_COMPOSE" version >/dev/null 2>&1; then
  COMPOSE_CMD="$DOCKER_COMPOSE"
  compose_cmd="binario"
fi
if [ "$compose_cmd" = "no" ]; then
  log "no encuentro docker compose en el NAS: lo trae Container Manager"
else
  log "compose: $COMPOSE_CMD"
fi

# Lo que de verdad importa de Compose: que desde la carpeta del proyecto sepa de
# que taller se habla. Lanzado desde cualquier otro sitio contesta «no
# configuration file provided: not found», y de ahi salen las copias a medias.
if [ -n "$COMPOSE_CMD" ] && [ "$raiz" = "si" ]; then
  if (cd "$RAIZ" && $SUDO $COMPOSE_CMD config -q >/dev/null 2>&1); then
    compose_lee="si"
    log "compose lee el proyecto de $RAIZ"
  else
    compose_lee="no"
    log "compose no puede leer el proyecto: mira el docker-compose.yml y el .env"
  fi
fi

# El PATH del sudo, que es la trampa clasica: con el PATH que impone, \`sudo docker\`
# contesta «command not found» aunque Docker este instalado. Se pregunta **solo si
# se ha tenido que usar sudo** para hablar con Docker: preguntarlo cuando no hace
# falta seria pedir la contrasena para nada, y si no se puede usar, se dice que no
# se ha mirado en vez de inventarlo.
if [ "$sin_sudo" = "si" ]; then
  sudo_path="no-hace-falta"
elif [ -n "$SUDO" ]; then
  if [ -n "$(sudo sh -c 'command -v docker' 2>/dev/null || true)" ]; then
    sudo_path="si"
  else
    sudo_path="no"
  fi
  log "el PATH del sudo lleva docker: $sudo_path"
fi

# --- Los contenedores y el volumen ---------------------------------------------

if [ "$raiz" = "si" ] && [ "$docker_ok" = "si" ] && [ -n "$COMPOSE_CMD" ]; then
  # Compose hay que lanzarlo desde el proyecto: es donde esta su docker-compose.yml.
  cd "$RAIZ" || true
  for servicio in ${SERVICIOS.join(" ")}; do
    id=$($SUDO $COMPOSE_CMD ps -a -q "$servicio" 2>/dev/null || true)
    estado="falta"
    if [ -n "$id" ]; then
      estado=$($SUDO $DOCKER inspect -f '{{.State.Status}}' "$id" 2>/dev/null || printf 'desconocido')
      if [ "$servicio" = "funciones" ]; then
        # El contenedor de las funciones es un recado que pasa y se va: que este
        # terminado es lo normal. Pero **como** termino importa, asi que cuando
        # sale con error se cuenta con su salida: un 127 ahi quiere decir que el
        # esquema y las funciones no han subido.
        if [ "$estado" = "exited" ]; then
          salida=$($SUDO $DOCKER inspect -f '{{.State.ExitCode}}' "$id" 2>/dev/null || printf 'desconocida')
          [ "$salida" = "0" ] || estado="exited-$salida"
        fi
      else
        # Los otros cuatro tienen que estar en pie: cualquier otra cosa es
        # «parado» y se dice con esas palabras.
        [ "$estado" = "running" ] || estado="parado"
      fi
    fi
    if [ -z "$contenedores" ]; then
      contenedores="$servicio:$estado"
    else
      contenedores="$contenedores,$servicio:$estado"
    fi
  done
  log "contenedores: $contenedores"

  # El volumen de los datos, por su nombre de verdad: Compose lo etiqueta, asi que
  # se le pregunta a Docker en vez de dar por hecho como se llama.
  encontrado=$($SUDO $DOCKER volume ls --filter label=com.docker.compose.volume=datos --format '{{.Name}}' 2>/dev/null | head -n 1 || true)
  if [ -n "$encontrado" ]; then
    volumen="$encontrado"
  else
    volumen="$(basename "$RAIZ")_datos"
  fi

  # Y si el backend contesta en su puerto: es el que sostiene todo lo demas. Se
  # dice si o no, no se deja en blanco, para que el ordenador pueda distinguir
  # «no contesta» de «no se ha podido preguntar».
  if command -v curl >/dev/null 2>&1; then
    if curl -fsS -o /dev/null "$SALUD" 2>/dev/null; then salud="si"; else salud="no"; fi
  else
    if wget -q -O /dev/null "$SALUD" 2>/dev/null; then salud="si"; else salud="no"; fi
  fi
  log "volumen de los datos: $volumen · el backend responde: $salud"
fi

# --- Donde van las copias ------------------------------------------------------

if [ -d "$RESPALDOS" ]; then
  respaldos="si"
  [ -w "$RESPALDOS" ] || respaldos="sin-permiso"
fi
espacio=$(df -Pk "$RESPALDOS" 2>/dev/null | tail -n 1 | awk '{print $4}' || true)
log "copias en $RESPALDOS: $respaldos · espacio libre: ${"${espacio:-desconocido}"} KB"

printf 'PULSO_DOCTOR raiz=%s compose=%s env=%s grupos=%s docker=%s compose_cmd=%s docker_ok=%s sin_sudo=%s sudo=%s sudo_path=%s compose_lee=%s contenedores=%s volumen=%s salud=%s respaldos=%s espacio=%s\\n' \\
  "$raiz" "$compose" "$env" "$grupos" "$docker" "$compose_cmd" "$docker_ok" "$sin_sudo" "$sudo" "$sudo_path" "$compose_lee" "$contenedores" "$volumen" "$salud" "$respaldos" "$espacio"
log "listo"
`;
}

/** El resumen del doctor (`PULSO_DOCTOR ...`). */
export function parseDoctorResult(text) {
  return parseSummary(text, "PULSO_DOCTOR ");
}

/** Los servicios, con su estado, tal y como vienen en el resumen. */
function services(result = {}) {
  const states = new Map();
  for (const piece of String(result.contenedores ?? "").split(",")) {
    const at = piece.indexOf(":");
    if (at > 0) states.set(piece.slice(0, at), piece.slice(at + 1));
  }
  return states;
}

/** Cómo se llama lo de Compose en el NAS, para poder enseñarlo. */
function composeWords(token) {
  if (token === "plugin") return "«docker compose»";
  if (token === "binario") return "«docker-compose»";
  return "docker compose";
}

/** «en /usr/local/bin/docker», o el motivo por el que no hay binario. */
function dockerWhere(result = {}) {
  if (result.docker && result.docker !== "no") return `en ${result.docker}`;
  return "no encuentro el binario docker";
}

/**
 * El proyecto: que la carpeta esté, con su `docker-compose.yml` y su `.env`. Sin
 * esas tres cosas no hay nada que arrancar, copiar ni mirar.
 */
export function projectVerdict(result = {}) {
  const base = { id: "project", label: "Proyecto" };
  if (result.raiz !== "si") {
    return {
      ...base,
      ok: false,
      detail: "no hay carpeta del proyecto en esa ruta",
      fix: "la crea la puesta en marcha: npm run nas -- --host … --app-url … --api-url …",
    };
  }
  const falta = [
    result.compose === "si" ? null : "docker-compose.yml",
    result.env === "si" ? null : ".env",
  ].filter(Boolean);
  if (falta.length > 0) {
    return {
      ...base,
      ok: false,
      detail: `la carpeta está, pero le falta ${falta.join(" y ")}`,
      fix: "lo deja la puesta en marcha: npm run nas -- --host … --app-url … --api-url …",
    };
  }
  return {
    ...base,
    ok: true,
    detail: "la carpeta, el docker-compose.yml y el .env",
  };
}

/**
 * Docker: dónde está el binario, con qué se le habla (`sin sudo` o `con sudo`) y
 * si contesta. Es la pieza que más veces falta en un NAS recién estrenado.
 */
export function dockerVerdict(result = {}) {
  const base = { id: "docker", label: "Docker" };
  if (result.docker === "no" || result.docker === undefined) {
    return {
      ...base,
      ok: false,
      detail: "no hay binario de Docker en el NAS",
      fix: "instala Container Manager desde el Centro de paquetes de DSM y vuelve a mirar",
    };
  }
  if (result.sudo === "pide-clave" && result.docker_ok !== "si") {
    return {
      ...base,
      ok: false,
      detail: `${dockerWhere(result)}, pero para preguntarle hace falta la contraseña de sudo y aquí no hay terminal donde teclearla`,
      fix: "vuelve a lanzarlo desde una terminal (o entra con una cuenta que pueda usar Docker sin sudo)",
    };
  }
  if (result.docker_ok !== "si") {
    return {
      ...base,
      ok: false,
      detail: `${dockerWhere(result)}, pero no contesta: el servicio de Docker no está en marcha`,
      fix: "abre Container Manager en DSM y mira que el servicio esté arrancado",
    };
  }
  const via = result.sin_sudo === "si" ? "sin sudo" : "con sudo";
  const extra =
    result.compose_cmd !== "no" ? ` · ${composeWords(result.compose_cmd)}` : "";
  return {
    ...base,
    ok: true,
    detail: `${dockerWhere(result)} y contesta ${via}${extra}`,
  };
}

/**
 * La cuenta y el `sudo`: qué grupos lleva y —la trampa clásica— si el `sudo` del
 * NAS, que impone su propio PATH, encuentra el binario. Los comandos del taller
 * llaman a Docker **por su ruta**, así que ese PATH no les afecta; saberlo aquí
 * evita que un `sudo docker` a mano parezca un Docker roto.
 */
export function sudoVerdict(result = {}) {
  const base = { id: "sudo", label: "sudo y grupos" };
  const grupos =
    result.grupos && result.grupos !== "ninguno" ? result.grupos : "sin grupos";
  if (result.sin_sudo === "si") {
    return {
      ...base,
      ok: true,
      detail: `la cuenta (${grupos}) habla con Docker sin sudo · el PATH de sudo no estorba: los comandos llaman al binario por su ruta`,
    };
  }
  if (result.sudo === "no") {
    return {
      ...base,
      ok: false,
      detail: `no hay sudo y la cuenta (${grupos}) no habla con Docker`,
      fix: "entra con una cuenta del grupo de administradores de DSM",
    };
  }
  const path =
    result.sudo_path === "si"
      ? "el PATH de sudo sí lleva docker"
      : result.sudo_path === "no"
        ? "«sudo docker» no lo encuentra (el sudo del NAS impone su PATH): los comandos del taller lo llaman por su ruta, así que les da igual"
        : "el PATH de sudo no se ha mirado (pediría la contraseña)";
  const clave =
    result.sudo === "libre"
      ? "sudo no pide contraseña"
      : "sudo pide contraseña (se teclea cuando la pide, igual que en la copia)";
  return { ...base, ok: true, detail: `${clave} · ${path}` };
}

/**
 * Compose: qué forma hay en el NAS y —lo que de verdad importa— si desde la
 * carpeta del proyecto sabe de qué taller se habla. Lanzado desde otro sitio
 * contesta `no configuration file provided: not found`, que es como se quedan las
 * copias a medias sin que nadie se entere.
 */
export function composeVerdict(result = {}) {
  const base = { id: "compose", label: "Compose" };
  if (result.compose_cmd === "no" || result.compose_cmd === undefined) {
    return {
      ...base,
      ok: false,
      detail: "no hay «docker compose» ni «docker-compose» en el NAS",
      fix: "instala Container Manager desde el Centro de paquetes de DSM",
    };
  }
  if (result.raiz !== "si") {
    return {
      ...base,
      ok: false,
      detail: `${composeWords(result.compose_cmd)} está, pero no hay proyecto que leer`,
      fix: "lanza la puesta en marcha: npm run nas -- --host …",
    };
  }
  if (result.compose_lee === "si") {
    return {
      ...base,
      ok: true,
      detail: `${composeWords(result.compose_cmd)} lee el proyecto desde su carpeta`,
    };
  }
  if (result.compose_lee === "no-mira") {
    return {
      ...base,
      ok: false,
      detail: `${composeWords(result.compose_cmd)} está, pero no se ha podido mirar el proyecto`,
      fix: "vuelve a lanzarlo desde una terminal, con la contraseña de sudo a mano",
    };
  }
  return {
    ...base,
    ok: false,
    detail: `${composeWords(result.compose_cmd)} no puede leer el docker-compose.yml (o lo que cuenta el .env)`,
    fix: "mira el docker-compose.yml y el .env en la carpeta del proyecto del NAS",
  };
}

/**
 * «en pie», «no está»… pero el contenedor de las funciones es un recado que pasa
 * y se va: que esté terminado es lo normal, no una avería.
 */
function funcionesWords(estado) {
  if (estado === undefined || estado === "falta") return "no está";
  if (estado === "running") return "subiendo el código ahora mismo";
  if (estado === "exited") return "terminado";
  const salida = /^exited-(\d+)$/.exec(estado ?? "");
  if (salida) {
    // Un recado que salió con error es lo contrario de un recado hecho: ahí el
    // esquema y las funciones no han subido.
    return salida[1] === "0"
      ? "terminado"
      : `terminado con error (salida ${salida[1]})`;
  }
  if (estado === "parado") return "parado";
  return `en «${estado}»`;
}

/** ¿El contenedor de las funciones terminó mal? */
function funcionesFallo(estado) {
  const salida = /^exited-(\d+)$/.exec(estado ?? "");
  return salida !== null && salida[1] !== "0";
}

/**
 * Los contenedores del taller. Los tres que se quedan —app, backend y el panel—
 * tienen que estar en pie, y el backend además contestar en su puerto. El
 * vigilante, si está, también: es el que vuelve a subir el código. Y el de las
 * funciones se cuenta tal cual: hizo su recado y se fue, que es lo que hace.
 */
export function containersVerdict(result = {}) {
  const base = { id: "containers", label: "Contenedores" };
  if (!result.contenedores) {
    return {
      ...base,
      ok: false,
      detail: "no se ha podido preguntar por los contenedores",
      fix: "vuelve a lanzarlo desde una terminal, con la contraseña de sudo a mano",
    };
  }
  const states = services(result);
  const words = SERVICIOS.map((nombre) =>
    nombre === "funciones"
      ? `funciones ${funcionesWords(states.get(nombre))}`
      : `${nombre} ${stateWords(states.get(nombre))}`,
  );
  const volumen =
    result.volumen && result.volumen !== "no" && result.volumen !== "no-mira"
      ? ` · volumen ${result.volumen}`
      : "";
  const detail = words.join(" · ") + volumen;

  const down = ["app", "backend", "dashboard"].filter(
    (nombre) => states.get(nombre) !== "running",
  );
  if (down.length === 3) {
    return {
      ...base,
      ok: false,
      detail: `${detail}: no hay ninguno en pie`,
      fix: "lanza la puesta en marcha: npm run nas -- --host … --app-url … --api-url …",
    };
  }
  if (down.length > 0) {
    return {
      ...base,
      ok: false,
      detail,
      fix: "vuelve a arrancarlos con: npm run nas -- --host …",
    };
  }
  // El vigilante, si está, tiene que estar en pie y el de las funciones tiene que
  // haber terminado bien: los dos son los que suben el esquema y las funciones.
  const vigilante = states.get("vigilante");
  const vigilanteCaido =
    vigilante !== undefined && vigilante !== "falta" && vigilante !== "running";
  const funciones = states.get("funciones");
  if (vigilanteCaido || funcionesFallo(funciones)) {
    return {
      ...base,
      ok: false,
      detail,
      fix: "mira los registros (docker compose logs vigilante / funciones) y vuelve a lanzar la puesta en marcha: npm run nas -- --host …",
    };
  }
  if (result.salud === "no") {
    return {
      ...base,
      ok: false,
      detail: `${detail}: pero el backend no contesta en su puerto`,
      fix: "mira los registros del backend en el NAS: docker compose logs backend",
    };
  }
  return { ...base, ok: true, detail };
}

/**
 * El espacio, en las unidades en las que se lee de un vistazo: en un NAS lo
 * normal son gigas y teras, y «13070910 MB» no se lee, se descifra.
 */
function cantidad(freeMb) {
  if (freeMb === null) return null;
  if (freeMb >= 1024 * 1024) return `${Math.round(freeMb / (1024 * 1024))} TB`;
  // En gigas solo de diez para arriba: por debajo, redondear a gigas esconde
  // justo lo que hay que ver —«2 GB» cuando quedan 1948 MB y hacen falta 2048—
  // y esto existe para avisar de eso.
  if (freeMb >= 10 * 1024) return `${Math.round(freeMb / 1024)} GB`;
  return `${freeMb} MB`;
}

/**
 * Dónde van las copias: que la carpeta esté, que la cuenta pueda escribir en ella
 * y que quede sitio. Un tar a medias por falta de espacio se descubre el día que
 * hace falta, que es el peor día posible.
 */
export function copiesVerdict(result = {}, { minFreeMb = MIN_FREE_MB } = {}) {
  const base = { id: "copies", label: "Copias" };
  const freeKb = Number(result.espacio);
  const freeMb = Number.isFinite(freeKb) ? Math.round(freeKb / 1024) : null;
  const espacio =
    freeMb === null ? "espacio libre: desconocido" : `${cantidad(freeMb)} libres`;
  if (result.respaldos === "no" || result.respaldos === undefined) {
    return {
      ...base,
      ok: true,
      detail: "la carpeta de las copias todavía no existe (la crea la primera copia)",
    };
  }
  if (result.respaldos === "sin-permiso") {
    return {
      ...base,
      ok: false,
      detail: `la carpeta está, pero la cuenta no puede escribir en ella · ${espacio}`,
      fix: "en el NAS: sudo chown -R la-cuenta la carpeta de las copias (o cambia --respaldos)",
    };
  }
  if (freeMb !== null && freeMb < minFreeMb) {
    return {
      ...base,
      ok: false,
      detail: `casi sin sitio: quedan ${cantidad(freeMb)} (las copias piden unos ${cantidad(minFreeMb)})`,
      fix: "libera espacio en el volumen, o borra copias viejas a mano",
    };
  }
  return { ...base, ok: true, detail: `carpeta lista · ${espacio}` };
}

/**
 * Todo lo que dice el doctor, en orden: primero se llega al NAS —eso se comprueba
 * en el ordenador, que es quien llama—, luego el proyecto, y después las piezas
 * de las que dependen los demás comandos: Docker, la cuenta y el sudo, Compose,
 * los contenedores y dónde van las copias.
 */
export function doctorReport(
  result = {},
  { reachable = true, host = "", user = "", port = "22" } = {},
) {
  return [
    {
      id: "ssh",
      label: "SSH",
      ok: reachable,
      detail: reachable
        ? `entra ${user}@${host} por el puerto ${port}`
        : `no se llega a ${user}@${host}`,
      fix: reachable
        ? undefined
        : "comprueba la dirección y el usuario, y que entras a mano con esa misma cuenta",
    },
    projectVerdict(result),
    dockerVerdict(result),
    sudoVerdict(result),
    composeVerdict(result),
    containersVerdict(result),
    copiesVerdict(result),
  ];
}

/**
 * El panel con el que termina el doctor: cada cosa con su marca, lo que hay que
 * hacer cuando algo no está bien y, al final, lo que se puede lanzar ya —la copia
 * y la comprobación— o lo que falta para poder hacerlo.
 */
export function doctorPanelLines(
  {
    host,
    user,
    port = "22",
    root = DEFAULT_PROJECT_PATH,
    result = {},
    reachable = true,
    report = null,
  },
  color = NO_COLOR,
) {
  const findings = report ?? doctorReport(result, { reachable, host, user, port });
  const lines = [
    "",
    color.bold("El NAS, punto por punto"),
    `  NAS              ${user}@${host}:${root}`,
  ];
  for (const finding of findings) {
    const mark = finding.ok ? color.green("✓") : color.red("✗");
    lines.push(`  ${finding.label.padEnd(17)}${mark} ${finding.detail}`);
    if (!finding.ok && finding.fix) {
      lines.push(`  ${" ".repeat(17)}${color.dim(finding.fix)}`);
    }
  }

  const broken = findings.filter((finding) => !finding.ok);
  const sinMirar = [
    !result.contenedores ? "los contenedores y Compose" : null,
    result.sudo_path === "no-mira" ? "el PATH de sudo" : null,
  ].filter(Boolean);

  lines.push(
    "",
    broken.length === 0
      ? "  Todo en orden: el entorno está listo."
      : `  ${broken.length} ${
          broken.length === 1 ? "cosa que mirar" : "cosas que mirar"
        }: los arreglos, arriba.`,
  );
  if (sinMirar.length > 0) {
    lines.push(
      color.dim(
        `  Sin mirar: ${sinMirar.join(" y ")}. Se ve al lanzar la copia o la puesta en marcha.`,
      ),
    );
  }
  lines.push(
    color.dim("  Del .env solo se ha mirado si está: el doctor no lee ningún valor."),
    "",
  );

  // Lo último es lo que se puede lanzar ya, con el nombre exacto de los comandos.
  if (broken.length === 0) {
    lines.push(
      "  Siguiente        la copia previa, antes de tocar nada:",
      `                   npm run nas:backup -- --host ${host}`,
      "                   y cómo está el taller:",
      `                   npm run nas:check -- --host ${host}`,
    );
  } else {
    lines.push(
      "  Cuando esté arreglado, vuelve a mirarlo:",
      `                   npm run nas:doctor -- --host ${host}`,
    );
  }
  return lines;
}
