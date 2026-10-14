#!/bin/sh
# La copia previa del taller, para lanzarla antes de cada actualización: el
# **export lógico** (la base de datos y los archivos, en un zip que se puede
# volver a cargar en cualquier instalación) y la **copia en frío del volumen**
# (todo el estado del backend: datos, archivos y funciones desplegadas).
#
# Se lanza **dentro del NAS**, donde vive todo:
#
#   sudo sh /volume1/docker/pulso-taller/codigo/docker/synology/copia-previa.sh
#   sudo sh copia-previa.sh --respaldos /volume1/docker/respaldos --conservar 7
#
# Y desde el ordenador, de una vez y sin dejar el guion en el NAS:
#
#   npm run nas:backup -- --host IP-del-NAS
#
# Por qué las dos copias, y en este orden:
#
#   1. **El export lógico primero**, con el backend en marcha, que es como tiene
#      que estar para que el CLI le pregunte. Se hace antes de tocar nada: si
#      falla, no se ha parado ningún contenedor y el taller sigue igual.
#   2. **El volumen después, en frío**: se para el backend, se empaqueta el
#      volumen entero y se vuelve a arrancar. Parado no hay nada «a medias»
#      dentro del tar. Si el empaquetado falla, el backend se arranca igual: el
#      taller no se queda caído porque una copia no saliera.
#
# Y al final se borran las copias más viejas, conservando las N últimas de cada
# tipo (7 por defecto): una copia antes de cada actualización es barata; que se
# acumulen para siempre, no.
#
# Los secretos no pasan por aquí: la clave de administrador se la da Compose al
# contenedor de las funciones desde el `.env` del proyecto, que es donde vive.
#
# Este guion no imprime ningún secreto y no cambia datos: solo lee el
# deployment (para el zip) y el volumen (para el tar).

set -eu

RAIZ_POR_DEFECTO="/volume1/docker/pulso-taller"
RESPALDOS_POR_DEFECTO="/volume1/docker/respaldos"
CONSERVAR_POR_DEFECTO=7

log() { printf 'copia: %s\n' "$*"; }
fail() { printf 'copia: %s\n' "$*" >&2; exit 1; }

uso() {
  printf '%s\n' \
    "Copia previa del taller: el export lógico y la copia en frío del volumen." \
    "" \
    "  sh copia-previa.sh [opciones]" \
    "" \
    "  --raiz RUTA        la carpeta del proyecto en el NAS" \
    "                     ($RAIZ_POR_DEFECTO por defecto)" \
    "  --respaldos RUTA   dónde se dejan las copias" \
    "                     ($RESPALDOS_POR_DEFECTO por defecto)" \
    "  --conservar N      cuántas copias de cada tipo se conservan (7 por defecto);" \
    "                     las más viejas se van borrando" \
    "  --help             esto mismo" \
    "" \
    "Las mismas tres se pueden dejar en el entorno (PULSO_RAIZ, PULSO_RESPALDOS" \
    "y PULSO_CONSERVAR), que es como las pasa el comando del ordenador."
}

# --- Lo que se copia y dónde --------------------------------------------------

RAIZ="${PULSO_RAIZ:-$RAIZ_POR_DEFECTO}"
RESPALDOS="${PULSO_RESPALDOS:-$RESPALDOS_POR_DEFECTO}"
CONSERVAR="${PULSO_CONSERVAR:-$CONSERVAR_POR_DEFECTO}"

while [ $# -gt 0 ]; do
  case "$1" in
    --raiz) RAIZ="${2:?--raiz necesita la carpeta del proyecto}"; shift 2 ;;
    --respaldos) RESPALDOS="${2:?--respaldos necesita una carpeta}"; shift 2 ;;
    --conservar) CONSERVAR="${2:?--conservar necesita un número}"; shift 2 ;;
    --help | -h) uso; exit 0 ;;
    *) fail "no conozco la opción $1 (mira --help)" ;;
  esac
done

case "$CONSERVAR" in
  "" | *[!0-9]*) fail "--conservar tiene que ser un número: $CONSERVAR" ;;
esac
[ "$CONSERVAR" -ge 1 ] || fail "--conservar tiene que ser al menos 1: $CONSERVAR"

# Las rutas viajan en el resumen que lee el comando del ordenador, que lo parte
# por espacios; y los archivos se listan para saber cuáles son los viejos. Un
# espacio en medio rompería las dos cosas, así que se avisa aquí y no más tarde.
case "$RAIZ$RESPALDOS" in
  *[[:space:],]*) fail "las carpetas no pueden llevar espacios ni comas: $RAIZ · $RESPALDOS" ;;
esac

[ -f "$RAIZ/docker-compose.yml" ] ||
  fail "no veo el proyecto en $RAIZ: tiene que estar el docker-compose.yml (paso 1 de la guía)"
[ -f "$RAIZ/.env" ] ||
  fail "no veo el .env en $RAIZ: sin él Compose no sabe qué instancia es (paso 2 de la guía)"

# --- Desde dónde se trabaja ---------------------------------------------------

# Todo lo que se le pide a Compose —el export, los contenedores, el volumen— se
# resuelve contra el `docker-compose.yml` de la carpeta del proyecto. Si se lanza
# desde otro sitio contesta «no configuration file provided: not found» y no hace
# nada, así que se entra aquí una vez y ya el resto del guion habla del taller.
# Este guion llega por SSH, desde el directorio en el que entre el usuario: la
# carpeta no es un detalle que se pueda dar por hecho.
#
# Las copias se resuelven antes de entrar, para que una ruta relativa siga
# significando lo que significaba al llegar y no se metan dentro del proyecto.
case "$RESPALDOS" in
  /*) ;;
  *) RESPALDOS="$PWD/$RESPALDOS" ;;
esac
cd "$RAIZ" || fail "no he podido entrar en $RAIZ"

# --- Con quién se habla con Docker -------------------------------------------

# La misma pregunta que hacen la puesta en marcha y la comprobación: en un
# Synology hace falta root para hablar con Docker, aunque no siempre (si el
# usuario está en el grupo que toca, no).
#
# Y no vale con el `docker` a secas: el `sudo` de un NAS impone su propio PATH
# —sin `/usr/local/bin`, que es donde vive el binario—, así que `sudo docker`
# contesta «command not found» aunque el taller esté en pie. Por eso se busca el
# binario primero y se llama después por su ruta.
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

DOCKER=$(buscar_binario docker) ||
  fail "no encuentro el binario docker en el NAS: instala Container Manager desde el Centro de paquetes"
if $DOCKER info >/dev/null 2>&1; then
  SUDO=""
else
  SUDO="sudo"
fi
# El compose nuevo va dentro del propio docker; el antiguo, aparte y con guion.
DOCKER_COMPOSE=$(buscar_binario docker-compose || true)
if $SUDO $DOCKER compose version >/dev/null 2>&1; then
  COMPOSE_CMD="$DOCKER compose"
elif [ -n "$DOCKER_COMPOSE" ] && $SUDO "$DOCKER_COMPOSE" version >/dev/null 2>&1; then
  COMPOSE_CMD="$DOCKER_COMPOSE"
else
  fail "no encuentro docker compose: sin Container Manager no hay nada que copiar"
fi

# El sello lleva los segundos a propósito: dos copias en el mismo minuto —lanzar
# el comando dos veces seguidas, por ejemplo— no pueden pisarse, que sería la
# peor forma de perder una copia: en silencio.
SUELO=$(date +%Y-%m-%d-%H%M%S)
ARCHIVO_DATOS="datos-$SUELO.tar.gz"
ARCHIVO_EXPORT="export-$SUELO.zip"

mkdir -p "$RESPALDOS" 2>/dev/null || $SUDO mkdir -p "$RESPALDOS"

# El volumen de los datos, por su nombre de verdad. Compose lo etiqueta, así que
# se le pregunta a Docker en vez de dar por hecho que se llama `<carpeta>_datos`
# —lo normal, pero cambia si el proyecto tiene otro nombre—.
volumen_de_datos() {
  encontrado=$($SUDO $DOCKER volume ls \
    --filter label=com.docker.compose.volume=datos \
    --format '{{.Name}}' 2>/dev/null | head -n 1 || true)
  if [ -z "$encontrado" ]; then
    carpeta=$(basename "$RAIZ")
    printf '%s\n' "${carpeta}_datos"
  else
    printf '%s\n' "$encontrado"
  fi
}

# --- 1. El export lógico ------------------------------------------------------

# Lo hace el contenedor de las funciones, que es el que ya tiene el CLI de Convex
# y la clave de administrador en su entorno (los dos, del `.env` del proyecto):
# no hace falta Node en el NAS ni pasar la clave por ningún sitio. La carpeta de
# las copias se monta dentro, que es donde el CLI escribe el zip.
#
# El backend tiene que estar en marcha: Compose espera a su `healthcheck` antes de
# arrancar el contenedor.
copiar_export() {
  $SUDO $COMPOSE_CMD run --rm -T --volume "$RESPALDOS":/respaldo funciones \
    node node_modules/convex/bin/main.js export \
    --include-file-storage --path "/respaldo/$ARCHIVO_EXPORT"
}

log "export lógico: la base de datos y los archivos, con el backend en marcha"
if ! copiar_export; then
  fail "el export no ha salido: no se ha tocado ningún contenedor. Mira los avisos de arriba (la clave de administrador del .env es lo primero que suele fallar)"
fi
log "export hecho: $RESPALDOS/$ARCHIVO_EXPORT"

# --- 2. El volumen, en frío ---------------------------------------------------

VOLUMEN=$(volumen_de_datos)

# Si el tar falla, el backend se vuelve a arrancar igual: se anota el fallo y se
# sale con error después, con el taller en pie.
copiar_volumen() {
  $SUDO $DOCKER run --rm -v "$VOLUMEN":/datos -v "$RESPALDOS":/respaldo alpine \
    tar czf "/respaldo/$ARCHIVO_DATOS" -C /datos .
}

log "copia en frío del volumen $VOLUMEN: se para el backend un momento"
$SUDO $COMPOSE_CMD stop backend || fail "no he podido parar el backend"

if ! copiar_volumen; then
  $SUDO $COMPOSE_CMD start backend || log "aviso: el backend no ha vuelto a arrancar solo; levántalo con «$COMPOSE_CMD start backend»"
  fail "el empaquetado del volumen no ha salido: el backend se ha vuelto a arrancar"
fi

$SUDO $COMPOSE_CMD start backend || fail "la copia está hecha, pero el backend no ha vuelto a arrancar: levántalo con «$COMPOSE_CMD start backend»"
log "volumen copiado: $RESPALDOS/$ARCHIVO_DATOS"

# --- 3. Las copias viejas -----------------------------------------------------

# Se conservan las N más recientes de cada tipo y se borran las demás. Se mira la
# fecha de modificación (`ls -1t`), que para estos nombres —con la fecha dentro—
# es el mismo orden que el nombre.
borrar_sobrantes() {
  patron="$1"
  borrados=0
  for viejo in $(ls -1t "$RESPALDOS"/$patron 2>/dev/null | tail -n "+$((CONSERVAR + 1))"); do
    if rm -f "$viejo"; then
      borrados=$((borrados + 1))
    fi
  done
  printf '%s' "$borrados"
}

BORRADOS_DATOS=$(borrar_sobrantes "datos-*.tar.gz")
BORRADOS_EXPORT=$(borrar_sobrantes "export-*.zip")
BORRADOS=$((BORRADOS_DATOS + BORRADOS_EXPORT))
[ "$BORRADOS" -eq 0 ] || log "se han borrado $BORRADOS copias viejas"

# El resumen va como última línea y con una marca inconfundible: es lo que lee el
# comando del ordenador para armar el panel. Sin huecos en los valores.
printf 'PULSO_BACKUP raiz=%s respaldos=%s volumen=%s datos=%s export=%s conservar=%s borrados=%s\n' \
  "$RAIZ" "$RESPALDOS" "$VOLUMEN" "$ARCHIVO_DATOS" "$ARCHIVO_EXPORT" "$CONSERVAR" "$BORRADOS"

log "listo: puedes actualizar el taller con la copia delante"
