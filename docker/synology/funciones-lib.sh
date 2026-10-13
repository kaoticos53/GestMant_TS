#!/bin/sh
# Las piezas que comparten los dos guiones que hablan con el deployment desde
# dentro del NAS:
#
#   funciones.sh          sube el esquema y las funciones una vez, al arrancar
#   vigila-funciones.sh   se queda mirando `src/convex` y los vuelve a subir
#                         cuando cambian
#
# Aquí vive lo que los dos necesitan contar igual —esperar al backend, dejar
# puestas las variables del deployment, generar las claves de Convex Auth si
# faltan y subir el código con reintentos—, para que no haya dos versiones del
# mismo criterio: el día que haya una variable más, se añade en un solo sitio.
#
# No se ejecuta solo: lo leen los otros dos con
#
#   . "$(dirname "$0")/funciones-lib.sh"
#
# y quien lo lee pone antes `PREFIJO` (el nombre con el que firman sus avisos:
# `funciones:` o `vigilante:`). Aquí no se imprime ningún secreto.
#
# Vive aquí también el paso que deja hecha la **cuenta de administrador** de una
# instalación nueva, aunque solo lo use el arranque (`crear_cuenta_de_administrador`,
# al final del archivo): el vigilante no crea cuentas, solo sube código.

PREFIJO="${PREFIJO:-funciones}"
log() { printf '%s: %s\n' "$PREFIJO" "$*"; }
fail() { printf '%s: %s\n' "$PREFIJO" "$*" >&2; exit 1; }

# El emisor de las sesiones de la plataforma: siempre el mismo salvo en una
# instalación que no sea la de siempre.
EMISOR="${VLY_CONVEX_AUTH_ISSUER:-https://freebuff.com}"

# Cuánto espera el vigilante a que el contenedor del arranque deje puestas las
# claves de Convex Auth (segundos). El arranque no espera: las genera.
ESPERA_CLAVES="${PULSO_ESPERA_CLAVES:-120}"

# El CLI viene con las dependencias del proyecto, así que se llama al que ya está
# instalado en la imagen. Se hace por su `bin/main.js` y no con `npx` porque el
# paquete no lo expone en su mapa `exports`, y porque `npx` intentaría descargarlo
# si no lo encontrara: en un NAS sin salida a internet, un rato perdido.
CLI="$(pwd)/node_modules/convex/bin/main.js"
convex() { node "$CLI" "$@"; }

# Lo que el docker-compose.yml pone en el entorno. Si falta, mejor decirlo aquí
# que dejar que el CLI falle más adelante con un mensaje peor.
comprobar_entorno() {
  : "${CONVEX_SELF_HOSTED_URL:?falta CONVEX_SELF_HOSTED_URL (lo pone el docker-compose.yml)}"
  : "${SITE_URL:?falta SITE_URL en el .env: la dirección desde la que se usa la app}"
}

comprobar_cli() {
  [ -f "$CLI" ] ||
    fail "no encuentro el CLI de Convex en $CLI: este contenedor no es el de la imagen «funciones»"
}

# La clave de administrador no se imprime nunca: es la credencial de la instancia.
# Sin ella no hay nada que subir, y lo único que se puede hacer es contarlo bien.
clave_de_administrador() {
  if [ -n "${CONVEX_SELF_HOSTED_ADMIN_KEY:-}" ]; then
    return 0
  fi
  log "no hay clave de administrador (CONVEX_ADMIN_KEY en el .env), así que no puedo subir nada."
  log "Es lo esperado la primera vez: la firma el backend en cuanto arranca, así que se saca del propio NAS con"
  log ""
  log "    sudo docker compose exec backend ./generate_admin_key.sh | tail -1"
  log ""
  log "y pégala en el .env del proyecto, en la línea CONVEX_ADMIN_KEY=. Después arranca el proyecto otra vez."
  exit 1
}

# ¿Contesta el backend? Se pregunta por su versión, que es lo que publica su
# `healthcheck`: dos minutos de margen para un NAS que arranca despacio.
esperar_backend() {
  intento_espera=1
  while [ "$intento_espera" -le 60 ]; do
    if wget -q -O /dev/null "${CONVEX_SELF_HOSTED_URL}/version" 2>/dev/null; then
      log "el backend responde: ${CONVEX_SELF_HOSTED_URL}"
      return 0
    fi
    if [ $((intento_espera % 15)) -eq 0 ]; then
      log "esperando al backend… (${intento_espera}/60)"
    fi
    intento_espera=$((intento_espera + 1))
    sleep 2
  done
  return 1
}

# Los nombres de lo que tiene puesto el deployment, uno por línea. Se pide la
# lista —y no cada variable una a una— porque así, además de saber qué falta, se
# comprueba de una vez que la clave de administrador vale: si la clave fuera otra,
# esto no contesta. En un backend recién hecho contesta que no hay ninguna, y eso
# no es un error. Los valores no salen de aquí ni se escriben en ningún sitio.
nombres_del_deployment() {
  convex env list --names-only
}

tiene() { printf '%s\n' "$1" | grep -qx "$2"; }

# Las variables que leen las funciones dentro del deployment.
fijar_variables() {
  convex env set SITE_URL "$SITE_URL" || return 1
  convex env set VLY_CONVEX_AUTH_ISSUER "$EMISOR" || return 1
  # Las integraciones de la plataforma —el código por email y el resumen semanal—
  # solo hacen falta si el taller las usa: si están en el `.env`, se pasan.
  if [ -n "${VLY_INTEGRATION_KEY:-}" ]; then
    convex env set VLY_INTEGRATION_KEY "$VLY_INTEGRATION_KEY" || return 1
  fi
  if [ -n "${VLY_INTEGRATION_BASE_URL:-}" ]; then
    convex env set VLY_INTEGRATION_BASE_URL "$VLY_INTEGRATION_BASE_URL" || return 1
  fi
}

# Deja el deployment como tiene que estar antes de subir código:
#
#   1. Pregunta qué tiene puesto. Es también la comprobación de que la clave de
#      administrador vale: si no contesta, no tiene sentido seguir.
#   2. Pone las variables que leen las funciones. Van **antes** de subir el
#      código porque el despliegue se niega a entrar si la configuración de auth
#      pide una variable que no está puesta.
#   3. Genera las claves de Convex Auth **solo si faltan**. Con ellas el
#      deployment firma y valida sus propias sesiones, así que rotarlas cerraría
#      todas las sesiones abiertas: no se regeneran porque sí.
preparar_deployment() {
  nombres_actuales=""
  if ! nombres_actuales="$(nombres_del_deployment)"; then
    fail "el deployment no contesta: comprueba CONVEX_CLOUD_ORIGIN en el .env (la dirección pública de la API) y que la clave de administrador sea la de esta instancia"
  fi

  fijar_variables || fail "no se han podido fijar las variables del deployment"
  log "variables del deployment al día: SITE_URL=${SITE_URL} · emisor=${EMISOR}"

  # Se vuelve a preguntar en lugar de reutilizar la lista de antes: ahora tiene
  # una variable más, y así la decisión sobre las claves se toma con lo que hay
  # de verdad puesto.
  nombres_actuales="$(nombres_del_deployment)" || fail "el deployment ha dejado de contestar"

  if tiene "$nombres_actuales" JWT_PRIVATE_KEY && tiene "$nombres_actuales" JWKS; then
    log "las claves de Convex Auth ya estaban: no se tocan (rotarlas cerraría las sesiones abiertas)"
    return 0
  fi

  # Las genera el contenedor del arranque, que es el que hace el primer envío. El
  # vigilante solo las espera: los dos arrancan a la vez al levantar el proyecto,
  # y generar un par cada uno dejaría fuera a quien se hubiera autenticado en
  # medio. En un arranque normal están puestas en unos segundos.
  if [ "${ESPERAR_CLAVES:-no}" = "si" ]; then
    log "esperando a que el contenedor de las funciones deje puestas las claves de Convex Auth…"
    esperadas=0
    while [ "$esperadas" -lt "$ESPERA_CLAVES" ]; do
      sleep 5
      esperadas=$((esperadas + 5))
      nombres_actuales="$(nombres_del_deployment)" || fail "el deployment ha dejado de contestar"
      if tiene "$nombres_actuales" JWT_PRIVATE_KEY && tiene "$nombres_actuales" JWKS; then
        log "las claves ya están puestas: sigo"
        return 0
      fi
    done
    fail "el deployment sigue sin claves de Convex Auth pasados ${ESPERA_CLAVES} s: mira los registros del contenedor «funciones» (docker compose logs funciones)"
  fi

  log "el deployment no tenía claves de Convex Auth: se generan ahora"
  # El mismo `npm run auth:keys` del repositorio, que las deja en el deployment.
  node scripts/generate-keys.mjs --set ||
    fail "no se han podido generar las claves de Convex Auth"
}

# Sube el esquema y las funciones (`convex dev --once`, el mismo
# `npm run convex:push` del repositorio). Un despliegue que no entra no se
# arregla esperando, pero el primer arranque —con el proxy inverso y el backend
# recién levantados— sí tropieza a veces: se reintenta un par de veces con una
# pausa corta y se cuentan los intentos.
#
# Devuelve 1 en vez de cortar: quien lo llama decide qué hacer con el fallo —el
# guion del arranque se para; el vigilante lo vuelve a intentar—.
subir() {
  log "subiendo el esquema y las funciones…"
  intento_subida=1
  while :; do
    if convex dev --once; then
      log "listo: el esquema y las funciones están al día"
      return 0
    fi
    if [ "$intento_subida" -ge 3 ]; then
      log "no se ha podido subir el código en ${intento_subida} intentos: revisa los avisos de arriba"
      return 1
    fi
    intento_subida=$((intento_subida + 1))
    log "el envío no ha entrado: se reintenta en ${PULSO_REINTENTO_SEGUNDOS:-10} s (intento ${intento_subida}/3)"
    sleep "${PULSO_REINTENTO_SEGUNDOS:-10}"
  done
}

# --- La cuenta de administrador de una instalación nueva ---------------------
#
# El taller que se despliega en producción arranca con la base **vacía**: la
# muestra de ejemplo no se carga, porque sus datos los da de alta él a mano. Lo
# que sí conviene dejar hecho es la cuenta de administrador —para no tener que
# entrar a crearla y, sobre todo, para que el primero que se registre no acabe
# siendo el administrador del taller por ser el primero—.
#
# Solo actúa con la base **sin ninguna cuenta**: en un taller que ya está en
# marcha no se toca nada, así que el contenedor se puede volver a arrancar sin
# miedo. Se apaga con `PULSO_INSTALL=no` en el `.env`, y las credenciales se
# cambian con `ADMIN_EMAIL` y `ADMIN_PASSWORD` (por defecto, las de la guía).
#
# No se imprime ningún secreto: la contraseña viaja en la llamada y su resumen no
# sale de aquí.

NOMBRE_ADMIN="Administración del taller"

# Cuántas cuentas tiene el taller. Consulta de solo lectura, y la respuesta es un
# número. Devuelve distinto de cero si el deployment no contesta: quien llama lo
# cuenta con su propio mensaje.
cuentas_del_taller() {
  respuesta=$(convex run --inline-query \
    'const users = await ctx.db.query("users").collect(); return users.length;' \
    2>/dev/null) || return 1
  printf '%s' "$respuesta" | tr -cd '0-9'
}

crear_cuenta_de_administrador() {
  if [ "${PULSO_INSTALL:-empty}" = "no" ]; then
    log "instalación: no se crea ninguna cuenta (PULSO_INSTALL=no)"
    return 0
  fi

  cuentas=$(cuentas_del_taller) ||
    fail "no he podido mirar si el taller tiene cuentas: el deployment no contesta"
  if [ "$cuentas" != "0" ]; then
    log "el taller ya tiene cuentas ($cuentas): no se crea ninguna"
    return 0
  fi

  admin_email="${ADMIN_EMAIL:-admin@taller.es}"
  admin_clave="${ADMIN_PASSWORD:-admin12345}"
  # Las credenciales viajan dentro de un JSON escrito a mano: con comillas o una
  # barra invertida lo romperían, y es mejor decirlo que crear una cuenta a medias.
  case "$admin_email$admin_clave" in
    *'"'* | *\\*)
      fail "ADMIN_EMAIL y ADMIN_PASSWORD no pueden llevar comillas ni barras invertidas"
      ;;
  esac
  # La app exige al menos ocho caracteres al darse de alta; aquí se comprueba lo
  # mismo antes de llamar, para no dejar una cuenta que no valga para entrar.
  if [ "${#admin_clave}" -lt 8 ]; then
    fail "ADMIN_PASSWORD tiene que llevar al menos 8 caracteres (los mismos que exige la app)"
  fi

  log "el taller está recién instalado: creando la cuenta de administrador ($admin_email)"
  # El mismo camino que usa la app en el primer «Entrar» (el store de Convex Auth
  # con el proveedor de contraseña). Es idempotente: si la cuenta ya existiera con
  # la misma contraseña, no cambia nada.
  peticion=$(printf '{"args":{"type":"createAccountFromCredentials","provider":"password","account":{"id":"%s","secret":"%s"},"profile":{"email":"%s","name":"%s","role":"admin","active":true},"shouldLinkViaEmail":false}}' \
    "$admin_email" "$admin_clave" "$admin_email" "$NOMBRE_ADMIN")
  # La salida del comando no se imprime nunca: trae el resumen de la contraseña.
  if ! convex run auth:store "$peticion" >/dev/null 2>&1; then
    fail "no se ha podido crear la cuenta de administrador ($admin_email): mira los registros de este contenedor con «docker compose logs funciones»"
  fi

  cuentas=$(cuentas_del_taller) ||
    fail "no he podido comprobar que la cuenta de administrador haya quedado creada"
  if [ "$cuentas" = "0" ]; then
    fail "la cuenta de administrador no ha quedado registrada: mira los registros del contenedor «funciones»"
  fi
  log "cuenta de administrador lista: $admin_email (la base vacía, sin datos de ejemplo)"
}
