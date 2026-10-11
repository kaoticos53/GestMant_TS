// Las piezas de la puesta en marcha del NAS que se pueden probar sin un NAS: la
// **configuración** (qué host, qué rutas, qué direcciones), el **guion que se
// ejecuta dentro del NAS** (pasos 1 a 5 de `SYNOLOGY.md`, idempotente) y el
// **panel final**, que termina siempre en la URL de la app.
//
// Viven aquí, y no en `nas-setup.mjs`, porque ese archivo habla por SSH con el
// NAS: importarlo desde una prueba intentaría conectarse. Al separarlas, el
// script y las pruebas usan exactamente el mismo texto y la misma regla, y el
// guion del NAS se puede ejecutar de verdad, con dobles en el `PATH`, para
// comprobar que repetirlo no cambia nada.
//
// No importa nada de Node a propósito: son funciones puras.

/** Colores del script; sin nada, el texto sale tal cual (como en las pruebas). */
const NO_COLOR = {
  bold: (text) => text,
  dim: (text) => text,
  green: (text) => text,
  red: (text) => text,
  yellow: (text) => text,
};

/** Nombre con el que la guía llama al proyecto en el NAS. */
export const DEFAULT_PROJECT_PATH = "/volume1/docker/pulso-taller";

/** La cuenta con la que se administra un Synology recién instalado. */
export const DEFAULT_USER = "admin";

/** El nombre de la instancia, igual que en `docker/synology/.env.example`. */
export const DEFAULT_INSTANCE = "pulso-taller";

/** El puerto donde escucha Docker dentro del NAS, para preguntarle si está sano. */
const BACKEND_HEALTH_URL = "http://127.0.0.1:3210/version";

/**
 * Cómo se pide cada opción. En la línea de órdenes manda el flag; si no está, se
 * mira la variable de entorno, para no tener que teclear el host del NAS en cada
 * arranque. Las seis se pueden fijar de las dos maneras.
 */
const VALUE_OPTIONS = {
  "--host": { key: "host", env: "NAS_HOST" },
  "--user": { key: "user", env: "NAS_USER" },
  "--port": { key: "port", env: "NAS_PORT" },
  "--path": { key: "root", env: "NAS_PATH" },
  "--app-url": { key: "appUrl", env: "NAS_APP_URL" },
  "--api-url": { key: "apiUrl", env: "NAS_API_URL" },
  "--instance": { key: "instance", env: "NAS_INSTANCE" },
};

/** Las opciones que no llevan valor: están o no están. */
const SWITCH_OPTIONS = {
  "--force-compose": "forceCompose",
  "--new-key": "newKey",
  "--no-build": "noBuild",
  "--help": "help",
  "-h": "help",
};

/** Lo que se explica al pedir ayuda; el nombre del comando, tal cual se teclea. */
export function usage(name = "npm run nas --") {
  return [
    "Puesta en marcha del taller en un NAS Synology, de una sola vez.",
    "",
    `  ${name} --host IP-del-NAS [opciones]`,
    `  ${name} --host 192.168.1.20 --app-url https://taller.mi-taller.es \\`,
    "    --api-url https://api.mi-taller.es",
    "",
    "Hace, en orden y sin nada a mano, los pasos 1 a 5 de SYNOLOGY.md: deja la",
    "carpeta del proyecto, lleva el código, escribe el docker-compose.yml y el",
    ".env (con su secreto), construye las imágenes, arranca los contenedores,",
    "pide la clave de administrador al backend y espera a que el contenedor de",
    "las funciones las suba. Se puede lanzar tantas veces como haga falta: lo que",
    "ya está hecho no se rehace ni se pisa, y los datos no se tocan nunca.",
    "",
    "Opciones:",
    "",
    "  --host IP-del-NAS        el NAS (también NAS_HOST)",
    "  --user admin             la cuenta con la que se entra (NAS_USER)",
    "  --port 22                el puerto de SSH (NAS_PORT)",
    `  --path ${DEFAULT_PROJECT_PATH}`,
    "                           la carpeta del proyecto (NAS_PATH)",
    "  --app-url https://taller.tudominio.com",
    "                           desde dónde se usa la app (NAS_APP_URL)",
    "  --api-url https://api.tudominio.com",
    "                           la dirección pública de la API (NAS_API_URL)",
    "  --instance pulso-taller  el nombre de la instancia (NAS_INSTANCE)",
    "  --force-compose          pisa el docker-compose.yml del NAS con el del",
    "                           repositorio (por defecto se conserva el suyo)",
    "  --new-key                pide otra clave de administrador aunque ya haya",
    "  --no-build               no reconstruye las imágenes: solo arranca lo que",
    "                           ya está construido (el código no se actualiza)",
    "  --help                   esto mismo",
    "",
    "Las direcciones solo hacen falta la primera vez: después manda el .env del",
    "NAS, que no se toca. Con --api-url o --app-url se cambia esa línea a mano.",
  ];
}

/**
 * La configuración completa, ya resuelta: los flags ganan a las variables de
 * entorno, y lo que no se diga se queda en el valor de partida. Devuelve también
 * los errores en vez de cortar: quien llama los enseña todos juntos, que es más
 * útil que arreglarlos de uno en uno.
 */
export function resolveConfig(argv = [], env = {}) {
  const config = {
    host: "",
    user: DEFAULT_USER,
    port: "22",
    root: DEFAULT_PROJECT_PATH,
    appUrl: "",
    apiUrl: "",
    instance: DEFAULT_INSTANCE,
    forceCompose: false,
    newKey: false,
    build: true,
    help: false,
    errors: [],
  };

  // Primero las variables de entorno: son el valor de partida.
  for (const option of Object.values(VALUE_OPTIONS)) {
    const value = env[option.env];
    if (typeof value === "string" && value.trim() !== "") {
      config[option.key] = value.trim();
    }
  }

  // Y después la línea de órdenes, que manda sobre ellas.
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument in SWITCH_OPTIONS) {
      config[SWITCH_OPTIONS[argument]] = true;
      continue;
    }
    const [name, inline] = argument.split("=");
    const option = VALUE_OPTIONS[name];
    if (option) {
      const value = inline ?? argv[index + 1];
      if (value === undefined) {
        config.errors.push(`${name} necesita un valor`);
        continue;
      }
      if (inline === undefined) index += 1;
      config[option.key] = value.trim();
      continue;
    }
    config.errors.push(`no conozco la opción ${argument}`);
  }

  if (config.noBuild) config.build = false;
  delete config.noBuild;

  // El puerto tiene que ser un puerto, y la carpeta tiene que ser absoluta: las
  // dos cosas se comprueban aquí porque un dedazo se paga más tarde y peor.
  if (
    !/^[0-9]+$/.test(config.port) ||
    Number(config.port) < 1 ||
    Number(config.port) > 65535
  ) {
    config.errors.push(`el puerto de SSH no vale: ${config.port}`);
  }
  config.root = normalizeProjectPath(config.root);
  if (!config.root.startsWith("/")) {
    config.errors.push(
      `la carpeta del proyecto tiene que ser absoluta: ${config.root}`,
    );
  }
  if (/[\s'"]/.test(config.root)) {
    config.errors.push(
      `la carpeta del proyecto no puede llevar espacios ni comillas: ${config.root}`,
    );
  }

  if (!config.help) {
    if (config.host === "") {
      config.errors.push("falta el NAS: --host IP-del-NAS (o NAS_HOST)");
    } else if (/[\s@:]/.test(config.host)) {
      config.errors.push(
        `el host no lleva usuario ni puerto, solo la dirección: ${config.host}`,
      );
    }
    for (const [key, label] of [
      ["appUrl", "--app-url"],
      ["apiUrl", "--api-url"],
    ]) {
      if (config[key] === "") continue;
      const clean = config[key].replace(/\/+$/, "");
      if (!/^https?:\/\/[^\s/]+$/.test(clean)) {
        config.errors.push(
          `${label} tiene que ser una dirección completa sin camino ni barra al final, como https://api.tudominio.com`,
        );
        continue;
      }
      config[key] = clean;
    }
  }

  return config;
}

/** La carpeta del proyecto, sin la barra del final (y sin dejarla vacía). */
export function normalizeProjectPath(path) {
  const clean = String(path ?? "")
    .trim()
    .replace(/\/+$/, "");
  return clean === "" ? "/" : clean;
}

/** Un valor tal cual para la shell, entre comillas simples. */
export function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/**
 * El archivo del proyecto que se lleva al NAS: solo lo que hace falta para
 * construirlo. Fuera `node_modules/` (los binarios del ordenador no valen en el
 * NAS), `dist/` (lo construye la imagen) y `.env.local` (lleva la clave de
 * administrador del entorno local), como cuenta el paso 3 de la guía.
 *
 * Devuelve las órdenes de `tar` y `ssh` por separado para que la prueba pueda
 * mirar las dos sin ejecutarlas.
 */
export function tarArgs(root = ".") {
  return [
    "-C",
    root,
    "-czf",
    "-",
    "--exclude=./node_modules",
    "--exclude=./dist",
    "--exclude=./.env.local",
    ".",
  ];
}

/**
 * El pretexto del paso 3, que corre dentro del NAS: descomprime lo que llega por
 * la entrada estándar en una carpeta nueva y **solo entonces** sustituye la
 * anterior, para que un corte a mitad no deje el proyecto a medias. Si no había
 * código, no hay nada que sustituir.
 */
export function unpackCommand(root = DEFAULT_PROJECT_PATH) {
  const codigo = `${root}/codigo`;
  return [
    `rm -rf ${codigo}.nuevo`,
    `mkdir -p ${codigo}.nuevo`,
    `tar xzf - -C ${codigo}.nuevo`,
    `rm -rf ${codigo}.viejo`,
    `[ ! -d ${codigo} ] || mv ${codigo} ${codigo}.viejo`,
    `mv ${codigo}.nuevo ${codigo}`,
    `rm -rf ${codigo}.viejo`,
  ].join(" && ");
}

/**
 * El guion que se ejecuta **dentro** del NAS (se sube a `.setup/setup.sh` y lo
 * lanza el script del ordenador, o a mano si algo se torció). Es el mismo en cada
 * ejecución salvo por los tres interruptores y las dos direcciones, que viajan
 * escritos dentro.
 *
 * Es idempotente de verdad, y esa es la parte difícil de acertar:
 *
 * - el `docker-compose.yml` solo se escribe si falta (o con `--force-compose`),
 *   porque puede llevar cambios propios —los puertos abiertos a la red local—;
 * - el `.env` solo se escribe si no está, y de ahí en adelante solo se **rellena
 *   lo que esté vacío**: el secreto de la instancia y la clave de administrador
 *   se generan una vez y no se rotan nunca (rotarlos dejaría fuera a quien esté
 *   dentro, y la guía lo repite en cada paso).
 * - lo que ya está en pie se reutiliza: preguntar, construir y arrancar se puede
 *   repetir sin tocar los datos (viven en el volumen).
 */
export function setupScript({
  root = DEFAULT_PROJECT_PATH,
  instance = DEFAULT_INSTANCE,
  appUrl = "",
  apiUrl = "",
  forceCompose = false,
  newKey = false,
  build = true,
  healthUrl = BACKEND_HEALTH_URL,
}) {
  return `#!/bin/sh
# Todo lo que hay que hacer DENTRO del NAS para dejar el taller en marcha: los
# pasos 1 a 5 de SYNOLOGY.md, en orden y sin nada manual.
#
# Lo escribe y lo sube el script del ordenador (scripts/nas-setup.mjs), que deja
# al lado el codigo/, el docker-compose.yml del repositorio y la plantilla del
# .env. Se puede volver a lanzar a mano, desde la carpeta del proyecto:
#
#   sh ${root}/.setup/setup.sh
#
# Es idempotente: lo que ya esta hecho no se rehace ni se pisa. En particular
# NUNCA cambia un valor que ya tenga el .env -- ni el secreto de la instancia, ni
# la clave de administrador, ni las direcciones--: solo rellena lo que falte.
#
# Corre con sh, no con bash: en el NAS no hay bash de sobra. Y no usa sudo para
# todo: le pregunta a Docker si le hace falta.

set -eu

RAIZ=${shQuote(root)}
INSTANCIA=${shQuote(instance)}
API_URL=${shQuote(apiUrl)}
APP_URL=${shQuote(appUrl)}
FORZAR_COMPOSE=${shQuote(forceCompose ? "si" : "no")}
CLAVE_NUEVA=${shQuote(newKey ? "si" : "no")}
CONSTRUIR=${shQuote(build ? "si" : "no")}
SALUD=${shQuote(healthUrl)}

ENV="$RAIZ/.env"
COMPOSE="$RAIZ/docker-compose.yml"
NUEVO_COMPOSE="$RAIZ/.setup/docker-compose.yml"
PLANTILLA="$RAIZ/.setup/env.example"

# Los tres interruptores se acaban de leer; los resultados se cuentan al final.
creado_env="no"
secreto_nuevo="no"
clave_estado="conservada"
compose_estado="igual"
funciones_estado="desconocido"

log() { printf 'nas: %s\\n' "$*"; }
fail() { printf 'nas: %s\\n' "$*" >&2; exit 1; }

[ -d "$RAIZ" ] || fail "no existe la carpeta del proyecto: $RAIZ"
[ -f "$NUEVO_COMPOSE" ] || fail "falta $NUEVO_COMPOSE (lo sube scripts/nas-setup.mjs)"
[ -f "$PLANTILLA" ] || fail "falta $PLANTILLA (lo sube scripts/nas-setup.mjs)"
[ -f "$RAIZ/codigo/docker/synology/Dockerfile" ] ||
  fail "no veo el codigo del proyecto en $RAIZ/codigo: vuelve a lanzar el comando desde el ordenador"
cd "$RAIZ"

# --- Con quien se habla con Docker --------------------------------------------
# En un Synology hay que ser root para hablar con Docker, pero no siempre: si el
# usuario esta en el grupo que toca, no hace falta sudo. Se pregunta una vez.
if docker info >/dev/null 2>&1; then
  SUDO=""
else
  SUDO="sudo"
fi
if $SUDO docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif $SUDO docker-compose version >/dev/null 2>&1; then
  # Las versiones mas antiguas de Container Manager traen la orden con guion.
  COMPOSE_CMD="docker-compose"
else
  fail "no encuentro docker compose en el NAS: instala Container Manager desde el Centro de paquetes"
fi
compose() { $SUDO $COMPOSE_CMD "$@"; }
log "docker compose: se usa con la orden «$COMPOSE_CMD»$([ -n "$SUDO" ] && printf ' y con sudo')"

# --- Paso 1: el docker-compose.yml --------------------------------------------
# El unico archivo que no viaja dentro del codigo. Si el NAS ya tiene uno, se
# conserva --puede llevar los puertos abiertos a la red local, que es una de las
# variantes de la guia-- y se avisa de que no es el del repositorio; para
# pisarlo, --force-compose.
if [ ! -f "$COMPOSE" ]; then
  cp "$NUEVO_COMPOSE" "$COMPOSE"
  compose_estado="colocado"
  log "colocado docker-compose.yml"
elif [ "$FORZAR_COMPOSE" = "si" ]; then
  cp "$NUEVO_COMPOSE" "$COMPOSE"
  compose_estado="refrescado"
  log "docker-compose.yml refrescado desde el repositorio (--force-compose)"
elif cmp -s "$NUEVO_COMPOSE" "$COMPOSE"; then
  log "docker-compose.yml: el del NAS es el del repositorio"
else
  compose_estado="conservado"
  log "docker-compose.yml: se conserva el del NAS, que tiene cambios propios"
  log "  (para pisarlo con el del repositorio: vuelve a lanzar con --force-compose)"
fi

# --- Paso 2: el .env -----------------------------------------------------------
if [ ! -f "$ENV" ]; then
  cp "$PLANTILLA" "$ENV"
  creado_env="si"
  log "escrito el .env a partir de la plantilla del repositorio"
else
  log "el .env ya estaba: se conserva tal cual (no se pisa ningun valor que tenga)"
fi

# Lee el valor de una clave del .env (vacio si no esta).
valor_de() { sed -n "s/^$1=//p" "$ENV" 2>/dev/null | head -n 1 || true; }

# Escribe el valor de una clave en su sitio, sin mover la linea ni tocar las
# demas (si no existe, se anade al final). Con awk y no con sed porque el valor
# puede llevar cualquier cosa, el pico de la clave de administrador incluido.
pon_valor() {
  clave=$1
  valor=$2
  tmp="$ENV.nuevo"
  awk -v c="$clave" -v v="$valor" '
    index($0, c "=") == 1 { print c "=" v; puesto = 1; next }
    { print }
    END { if (!puesto) print c "=" v }
  ' "$ENV" > "$tmp"
  mv "$tmp" "$ENV"
}

# El secreto de la instancia: se genera una vez y no se cambia nunca (al rotarlo
# dejan de valer las claves de administrador y todas las sesiones abiertas).
if [ -z "$(valor_de INSTANCE_SECRET)" ]; then
  secreto=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \\n')
  [ -n "$secreto" ] || fail "no he podido generar el secreto de la instancia (ni openssl ni /dev/urandom)"
  pon_valor INSTANCE_SECRET "$secreto"
  secreto_nuevo="si"
  log "generado INSTANCE_SECRET (32 bytes en hexadecimal). Guardalo con las contrasenas del taller"
  log "  y no lo cambies nunca: al rotarlo habria que volver a entrar en la app"
fi
if [ -z "$(valor_de INSTANCE_NAME)" ]; then
  pon_valor INSTANCE_NAME "$INSTANCIA"
fi

# Las direcciones: mandan las del .env, que es lo que hay instalado. Solo se
# escriben si no habia nada o si se ha pedido otra a proposito en la linea de
# ordenes; nunca se pisan por venir en un flag de mas.
if [ -n "$API_URL" ] && [ "$(valor_de CONVEX_CLOUD_ORIGIN)" != "$API_URL" ]; then
  pon_valor CONVEX_CLOUD_ORIGIN "$API_URL"
  log "CONVEX_CLOUD_ORIGIN = $API_URL"
fi
if [ -n "$APP_URL" ] && [ "$(valor_de SITE_URL)" != "$APP_URL" ]; then
  pon_valor SITE_URL "$APP_URL"
  log "SITE_URL = $APP_URL"
fi

# Sin direccion no se puede construir: la app lleva grabada la de la API dentro,
# asi que compilarla con el ejemplo de la plantilla dejaria el sitio roto.
api=$(valor_de CONVEX_CLOUD_ORIGIN)
sitio=$(valor_de SITE_URL)
# Se mira si lo que hay es el ejemplo de la plantilla *y nadie lo ha dicho a
# proposito*: si las direcciones vienen de la linea de ordenes, mandan ellas,
# aunque el taller viva de verdad en tudominio.com.
api_de_ejemplo="no"
if [ -z "$API_URL" ] && [ "$api" = "https://api.tudominio.com" ]; then
  api_de_ejemplo="si"
fi
sitio_de_ejemplo="no"
if [ -z "$APP_URL" ] && [ "$sitio" = "https://taller.tudominio.com" ]; then
  sitio_de_ejemplo="si"
fi
if [ "$api_de_ejemplo" = "si" ] || [ "$sitio_de_ejemplo" = "si" ]; then
  log "el .env tiene todavia las direcciones de ejemplo de la plantilla (tudominio.com)."
  log "Escribe las de verdad en $ENV y vuelve a lanzar el comando, o pasale las dos en la"
  log "linea de ordenes (--api-url https://api.mi-taller.es --app-url https://taller.mi-taller.es)."
  fail "el .env sigue con las direcciones de ejemplo"
fi
case "$api" in
  http://* | https://*) ;;
  *)
    log "el .env todavia no tiene la direccion publica de la API (CONVEX_CLOUD_ORIGIN)."
    log "Es lo esperado la primera vez: escribela en $ENV con la direccion de verdad"
    log "(por ejemplo https://api.tudominio.com) y vuelve a lanzar el comando."
    fail "falta CONVEX_CLOUD_ORIGIN en el .env"
    ;;
esac
case "$sitio" in
  http://* | https://*) ;;
  *)
    fail "falta SITE_URL en el .env: la direccion desde la que se usa la app"
    ;;
esac
chmod 600 "$ENV"
log "direcciones: API $api · app $sitio"

# --- Paso 3: el codigo ---------------------------------------------------------
# Ya esta subido (lo descomprime el script del ordenador antes de llamarme); si
# no, se ha avisado arriba.
log "codigo en $RAIZ/codigo"

# --- Paso 4: construir y arrancar ----------------------------------------------
if [ "$CONSTRUIR" = "si" ]; then
  log "construyendo y arrancando los contenedores (la primera vez tarda unos minutos)..."
  compose up -d --build ||
    fail "los contenedores no han arrancado: mira sus registros con «$COMPOSE_CMD logs backend»"
else
  log "arrancando los contenedores sin construir (--no-build): el codigo no se actualiza"
  compose up -d || fail "los contenedores no han arrancado"
fi

# El backend tiene que estar en pie antes de pedirle la clave. Se pregunta por lo
# mismo que su healthcheck —su version— y se espera con paciencia, que un NAS
# tambien arranca despacio.
preguntar_backend() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS -o /dev/null "$SALUD" 2>/dev/null
  else
    wget -q -O /dev/null "$SALUD" 2>/dev/null
  fi
}
intento=1
while [ "$intento" -le 60 ]; do
  if preguntar_backend; then
    log "el backend responde: $SALUD"
    break
  fi
  [ "$intento" -lt 60 ] || fail "el backend no contesta en $SALUD: mira los registros del servicio «backend»"
  [ $((intento % 15)) -ne 0 ] || log "esperando al backend... ($intento/60)"
  intento=$((intento + 1))
  sleep 2
done

# --- Paso 5: la clave de administrador y el despliegue -------------------------
# La clave la firma el backend con el secreto de la instancia, asi que se puede
# volver a pedir cuando haga falta; las anteriores siguen valiendo. Solo se pide
# si no habia ninguna o si se ha pedido una nueva a proposito.
if [ "$CLAVE_NUEVA" = "si" ] || [ -z "$(valor_de CONVEX_ADMIN_KEY)" ]; then
  salida=$(compose exec -T backend ./generate_admin_key.sh 2>/dev/null || true)
  clave=$(printf '%s\\n' "$salida" | tr -d '\\r' | grep -v '^[[:space:]]*$' | tail -n 1 || true)
  [ -n "$clave" ] ||
    fail "el backend no ha dado ninguna clave de administrador: mira «$COMPOSE_CMD logs backend»"
  pon_valor CONVEX_ADMIN_KEY "$clave"
  clave_estado="pedida"
  log "pedida la clave de administrador al backend y escrita en el .env (no se imprime)"
fi

# La clave viaja al contenedor de las funciones por su entorno, asi que hay que
# recrearlo para que la vea: arrancar otra vez basta, y sin clave nueva no cambia
# nada.
compose up -d

# Y ahora se espera a que el contenedor de las funciones acabe: sube el esquema y
# las funciones, termina y se para. Su salida limpia es la senal de que el paso 5
# esta hecho; si sale con error, lo dice y se ensenan sus ultimas lineas.
#
# Se pregunta con -a porque el contenedor puede estar ya parado (lo normal: el
# recado esta hecho) y asi sigue contando, con su codigo de salida. Sin -a,
# «compose ps» solo ensena los que estan en marcha y pareceria que no existe.
id=$(compose ps -a -q funciones 2>/dev/null || true)
if [ -z "$id" ]; then
  funciones_estado="sin-arrancar"
  log "no encuentro el contenedor de las funciones: mira «$COMPOSE_CMD ps -a»"
else
  intento=1
  while [ "$intento" -le 150 ]; do
    en_marcha=$($SUDO docker inspect -f '{{.State.Running}}' "$id" 2>/dev/null || printf 'false')
    [ "$en_marcha" = "true" ] || break
    [ $((intento % 15)) -ne 0 ] || log "subiendo el esquema y las funciones... ($intento/150)"
    intento=$((intento + 1))
    sleep 2
  done
  if [ "$en_marcha" = "true" ]; then
    # Sigue subiendo cuando se acaba la paciencia: no se da por bueno ni se da por
    # roto; se deja apuntado, con donde mirarlo.
    funciones_estado="sigue"
    log "el contenedor de las funciones sigue en marcha despues de cinco minutos"
    log "  (como va, con «$COMPOSE_CMD logs -f funciones»; el esquema y las funciones"
    log "  suelen subir bastante antes)"
  else
    codigo_salida=$($SUDO docker inspect -f '{{.State.ExitCode}}' "$id" 2>/dev/null || printf '?')
    if [ "$codigo_salida" != "0" ]; then
      printf '\n'
      compose logs --tail=30 funciones || true
      funciones_estado="error"
      fail "el contenedor de las funciones ha salido con error ($codigo_salida): mira los avisos de arriba y el apartado «Problemas frecuentes» de SYNOLOGY.md"
    fi
    funciones_estado="al-dia"
    log "listo: el esquema y las funciones estan al dia"
  fi
fi

# --- Y hasta aqui los pasos 1 a 5 ----------------------------------------------
# El 6 (el HTTPS del proxy inverso de DSM) se hace con el raton, en DSM, y el 7 es
# entrar y comprobar. Eso no lo puede hacer este script.
log "los contenedores estan en pie; queda el paso 6 de la guia: el HTTPS del proxy inverso de DSM"
# El resumen va como ultima linea y con una marca inconfundible: es lo que lee el
# script del ordenador para armar el panel final (y para saber que se ha llegado
# al final de verdad). Las direcciones van aqui para que el panel las ensene tal
# como han quedado, y no como se pidieron.
printf 'PULSO_SETUP env=%s secreto=%s clave=%s compose=%s funciones=%s construido=%s api=%s app=%s\\n' \\
  "$creado_env" "$secreto_nuevo" "$clave_estado" "$compose_estado" "$funciones_estado" "$CONSTRUIR" \\
  "$api" "$sitio"
`;
}

/**
 * Lee el resumen que el guion del NAS deja como ultima linea
 * (`PULSO_SETUP env=si clave=pedida ...`). Devuelve `null` si no aparece: quien
 * llama lo trata como «el guion no ha terminado», que es lo que es.
 */
export function parseSetupResult(text) {
  const line = String(text ?? "")
    .split("\n")
    .map((one) => one.replace(/\r$/, ""))
    .reverse()
    .find((one) => one.startsWith("PULSO_SETUP "));
  if (!line) return null;
  const result = {};
  for (const pair of line.slice("PULSO_SETUP ".length).trim().split(/\s+/)) {
    const at = pair.indexOf("=");
    if (at > 0) result[pair.slice(0, at)] = pair.slice(at + 1);
  }
  return result;
}

/**
 * El panel con el que termina el comando. **La ultima linea es siempre la URL de
 * la app**: es lo que se busca al terminar, así que no puede quedar nada detrás
 * (igual que en el arranque local).
 */
export function panelLines(
  {
    appUrl,
    apiUrl,
    host,
    user,
    root = DEFAULT_PROJECT_PATH,
    result = {},
    firstTime = false,
  },
  color = NO_COLOR,
) {
  const lines = [
    "",
    color.bold("NAS listo"),
    `  App              ${appUrl}`,
    `  API de Convex    ${apiUrl}`,
    `  Panel de Convex  http://${host}:6791  (solo desde la red local)`,
    `  Proyecto         ${user}@${host}:${root}`,
    "  Contenedores     app · backend · dashboard en pie · funciones terminado (exited 0)",
  ];

  if (result.env === "si") {
    lines.push(
      color.yellow(
        "  !                el .env se ha escrito ahora: las direcciones salen de las que le hayas pasado",
      ),
    );
  }
  if (result.secreto === "si") {
    lines.push(
      "  Secreto          INSTANCE_SECRET recien generado: guardalo con las contrasenas del taller",
      color.dim(
        "                   y no lo cambies nunca (cerraria todas las sesiones)",
      ),
    );
  }
  if (result.clave === "pedida") {
    lines.push(
      "  Clave            pedida al backend y escrita en el .env (CONVEX_ADMIN_KEY)",
    );
  }
  if (result.compose === "conservado") {
    lines.push(
      color.yellow(
        "  !                docker-compose.yml: se ha conservado el del NAS, con sus cambios",
      ),
      color.dim(
        "                   (para pisarlo con el del repositorio: --force-compose)",
      ),
    );
  }
  if (result.funciones === "sin-arrancar") {
    lines.push(
      color.yellow(
        "  !                no he encontrado el contenedor de las funciones",
      ),
      color.dim("                   mira «docker compose ps -a» en el NAS"),
    );
  }
  if (result.funciones === "sigue") {
    lines.push(
      color.yellow(
        "  !                el contenedor de las funciones sigue subiendo el codigo",
      ),
      color.dim(
        "                   siguelo con «docker compose logs -f funciones» en el NAS",
      ),
    );
  }
  if (result.construido === "no") {
    lines.push(
      color.yellow(
        "  !                se ha arrancado sin construir (--no-build)",
      ),
      color.dim(
        "                   el codigo nuevo todavia no esta dentro de las imagenes",
      ),
    );
  }

  lines.push(
    "",
    `  Falta el paso 6 de la guia: el HTTPS del proxy inverso de DSM (2 reglas, con`,
    `  WebSocket en la de la API). Los detalles, en ${color.bold("SYNOLOGY.md")}.`,
  );
  if (firstTime) {
    lines.push(
      `  La primera vez, la app todavia no tiene usuarios: entra en ${color.bold(`${appUrl}/auth`)}`,
      "  y usa la pestana de contrasena o el acceso como invitado.",
    );
  }
  lines.push("", `  Abre la app en ${color.bold(appUrl)}`);
  return lines;
}
