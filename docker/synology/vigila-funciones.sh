#!/bin/sh
# El vigilante de las funciones: mira `src/convex` y, cuando cambia algo, vuelve a
# subir el esquema y las funciones al backend. Es el servicio `vigilante` del
# proyecto de Container Manager, y existe para no tener que reiniciar ni
# reconstruir nada: un cambio en una función llega solo.
#
# Cómo se reparte el trabajo con el otro servicio:
#
#   funciones   sube el código una vez, al arrancar el proyecto, y se va. Es
#               también **el único que escribe en el deployment**: las variables
#               (SITE_URL y el emisor) y las claves de Convex Auth.
#   vigilante   se queda. Repite esa subida cuando ve que el código ha cambiado, y
#               del deployment no escribe nada: espera a que el arranque lo haya
#               dejado puesto. Si lo que cambia es el `.env` —por ejemplo
#               `SITE_URL`—, quien lo lleva al deployment es el arranque:
#               `sudo docker compose up -d funciones`.
#
# De dónde sale lo que vigila: `./codigo/src/convex` del NAS está montado en
# `/app/src/convex` del contenedor (mira el `volumes` del servicio en el
# docker-compose.yml), así que lo que mira es **el código que hay en el NAS**, no
# la copia que trae la imagen. Da igual cómo llegue el cambio: `npm run nas` desde
# el ordenador, un `git pull` dentro del NAS o un archivo que toques por SSH.
#
# Cuatro cosas que hace a propósito, y por qué:
#
#   1. **No escribe nada del deployment.** Las variables y las claves de Convex
#      Auth las deja puestas el contenedor del arranque; aquí solo se espera a que
#      estén. Escribir los dos a la vez fue lo que tumbó un arranque entero: el que
#      llegaba segundo se comía un 503 del backend («OptimisticConcurrencyControlFailure»,
#      que no significa que falte nada) y el contenedor de las funciones salía con
#      error, con el esquema sin llegar a subirse.
#   2. **No sube nada al arrancar.** El primer envío es de `funciones`, que ya se
#      encarga. Subir también aquí sería subir dos veces lo mismo a la vez, y dos
#      despliegues a la vez se estorban. Lo que hace es apuntar cómo está el
#      código y esperar a que cambie.
#   3. **Solo mira los archivos de verdad.** `_generated/` la escribe el propio
#      CLI al subir: si contara, cada subida dispararía la siguiente y esto sería
#      un bucle que no para.
#   4. **Espera a que el árbol se quede quieto** antes de subir. `npm run nas`
#      deja el código por capas, y no queremos subir una versión a medias.
#
# Si un envío falla (el backend reiniciándose, la red a medias), no se pierde
# nada: lo vuelve a intentar, y no da por subido el código hasta que el CLI dice
# que sí. Si el problema es de configuración —falta la clave de administrador, el
# deployment no contesta—, sale diciéndolo, como `funciones`: eso no se arregla
# reintentando, y en los registros está lo que hay que hacer.
#
# Para mirarlo desde el NAS:
#
#   sudo docker compose logs -f vigilante
#   sudo docker compose restart vigilante      (si alguna vez hay que despertarlo)
#
# Ajustes, todos con un valor de partida sensato (no hace falta tocar ninguno):
#
#   PULSO_VIGILA_SEGUNDOS     cada cuánto mira si el código ha cambiado (20)
#   PULSO_VIGILA_ESPERA       cuánto espera entre dos miradas cuando algo se mueve (2)
#   PULSO_VIGILA_TRAS_FALLO   cuánto espera después de un envío fallido (120)
#   PULSO_VIGILA_LATIDO       cada cuántas vueltas deja una línea de «sigo aquí» (30)
#   PULSO_FUNCIONES           qué carpeta vigila (`<donde esté> /src/convex`)
#   PULSO_REINTENTO_SEGUNDOS  pausa entre reintentos de un mismo envío (10)
#   PULSO_ESPERA_CLAVES       cuánto espera a que el arranque deje las claves de
#                             Convex Auth puestas, en vez de generarlas él (120)
#   PULSO_INTENTOS_ESPERA     cuántas veces mira si el arranque ya dejó puestas
#                             las variables del deployment (24)
#   PULSO_ESPERA_ENTRE_RONDAS cuánto espera entre esas miradas (5)
#
# Las variables del deployment y las claves de Convex Auth las deja puestas el
# contenedor `funciones`, no este: los dos arrancan a la vez al levantar el
# proyecto, y está visto lo que pasa cuando escriben los dos —el que llega segundo
# se lleva un 503 del backend y el arranque se cae entero—. Aquí solo se esperan. Y
# por lo mismo las claves tampoco se generan aquí: un par cada uno dejaría fuera a
# quien se hubiera autenticado en medio.
#
# No imprime ningún secreto: la clave de administrador viaja por el entorno, como
# en `funciones.sh`, y no se escribe en ningún sitio.

set -eu

PREFIJO=vigilante
# Este contenedor no escribe en el deployment: espera a que el arranque lo haya
# dejado puesto —las variables y las claves de Convex Auth—. Mira arriba.
ESPERAR_ARRANQUE=si
. "$(dirname "$0")/funciones-lib.sh"

SEGUNDOS="${PULSO_VIGILA_SEGUNDOS:-20}"
PAUSA="${PULSO_VIGILA_ESPERA:-2}"
TRAS_FALLO="${PULSO_VIGILA_TRAS_FALLO:-120}"
LATIDO="${PULSO_VIGILA_LATIDO:-30}"
FUNCIONES="${PULSO_FUNCIONES:-$(pwd)/src/convex}"

# Adiós ordenado: Container Manager y `docker compose stop` mandan TERM, y el
# contenedor se para sin quedarse a mitad de un envío.
trap 'log "me voy: dejo de vigilar $FUNCIONES"; exit 0' TERM INT

# La huella del código: un resumen del contenido de cada archivo, con su ruta
# delante —así un archivo que se renombra o se borra también cuenta—. Se ordena
# antes de resumir para que el resultado no dependa del orden en que el sistema
# de archivos devuelva los archivos.
huella() {
  find "$FUNCIONES" -type f \
    ! -path '*/_generated/*' ! -name '.*' ! -name '*~' ! -name '*.swp' ! -name '*.tmp' \
    -print 2>/dev/null |
    LC_ALL=C sort |
    while IFS= read -r archivo; do
      printf '%s %s\n' "$archivo" "$(md5sum "$archivo" 2>/dev/null | cut -d' ' -f1)"
    done |
    md5sum | cut -d' ' -f1
}

# Espera a que el árbol deje de cambiar y devuelve la huella ya quieta.
estabilizar() {
  anterior=""
  actual="$(huella)"
  vueltas=0
  while [ "$actual" != "$anterior" ] && [ "$vueltas" -lt 30 ]; do
    anterior="$actual"
    sleep "$PAUSA"
    actual="$(huella)"
    vueltas=$((vueltas + 1))
  done
  printf '%s' "$actual"
}

comprobar_entorno
clave_de_administrador
comprobar_cli

[ -d "$FUNCIONES" ] ||
  fail "no veo el código de las funciones en $FUNCIONES: mira el «volumes» del servicio vigilante en el docker-compose.yml"

esperar_backend ||
  fail "el backend no contesta en ${CONVEX_SELF_HOSTED_URL}: mira los registros del servicio «backend»"

# El deployment tiene que estar en condiciones antes de la primera subida, que es
# la que decide si las claves de Convex Auth existen.
preparar_deployment

ANTERIOR="$(huella)"
PENDIENTE=no
log "vigilando $FUNCIONES: si el código cambia, se sube solo (cada ${SEGUNDOS} s)"
vueltas=0

while :; do
  sleep "$SEGUNDOS"
  vueltas=$((vueltas + 1))
  ACTUAL="$(huella)"

  if [ "$ACTUAL" = "$ANTERIOR" ]; then
    if [ "$PENDIENTE" = "si" ]; then
      log "sigo con el envío pendiente: el código es el mismo que no ha entrado"
    elif [ $((vueltas % LATIDO)) -eq 0 ]; then
      log "sin cambios en $FUNCIONES: el esquema y las funciones siguen al día"
    fi
    continue
  fi

  QUIETA="$(estabilizar)"
  # Se distingue el cambio del reintento para que los registros digan la verdad:
  # un envío que falló y se reintenta no es un cambio nuevo.
  if [ "$PENDIENTE" = "si" ]; then
    log "el código sigue distinto de lo que hay subido: vuelvo a intentar el envío"
  else
    log "las funciones han cambiado: subiendo el esquema y el código"
  fi

  if preparar_deployment && subir; then
    # Lo que se ha subido es exactamente lo que había cuando se calculó la
    # huella quieta. Si alguien sigue editando mientras se sube, la próxima
    # vuelta lo ve y lo sube también: aquí no se pierde ningún cambio.
    ANTERIOR="$QUIETA"
    PENDIENTE=no
    log "al día con la versión de $FUNCIONES"
    continue
  fi

  PENDIENTE=si
  log "el envío no ha entrado: lo vuelvo a intentar en ${TRAS_FALLO} s"
  sleep "$TRAS_FALLO"
done
