#!/bin/sh
# Sube `src/convex/` —el esquema y las funciones— al backend que tiene al lado,
# desde el propio NAS. Es lo que hace que el taller no dependa de ningún
# ordenador: antes había que copiar una dirección y una clave al portátil y
# lanzar el despliegue desde allí, y repetirlo cada vez que se tocaba una función.
#
# Lo lanza el servicio `funciones` del proyecto de Container Manager al arrancar
# —una vez, se va y no vuelve hasta que se arranque el proyecto otra vez—. El
# orden de lo que hace es este, y no otro:
#
#   1. **Espera al backend.** El compose ya lo espera (`depends_on` con su
#      `healthcheck`), pero aquí se pregunta además por su versión hasta que
#      contesta: «sano» y «listo para recibir código» no son exactamente lo mismo.
#   2. **Pregunta qué tiene el deployment.** Es también la comprobación de que la
#      clave de administrador vale: si no contesta, no tiene sentido seguir.
#   3. **Deja puestas las variables del deployment.** `SITE_URL` —la dirección
#      desde la que se usa la app, con la que las funciones construyen sus
#      enlaces— y el emisor de las sesiones. Van **antes** de subir el código
#      porque el despliegue se niega a entrar si la configuración de auth pide una
#      variable que no está puesta. Manda el `.env` del proyecto: cambiar de
#      dominio es editarlo y volver a arrancar.
#   4. **Genera las claves de Convex Auth solo si faltan.** Con las que el
#      deployment firma y valida sus propias sesiones. Rotarlas cerraría todas las
#      sesiones abiertas, así que no se regeneran en cada arranque.
#   5. **Sube el esquema y las funciones** (`convex dev --once`, el mismo
#      `npm run convex:push` del repositorio) y se va, dejando el resultado en los
#      registros del contenedor.
#
# Si algo falla, el contenedor termina con error y lo cuenta: el fallo se ve en
# `docker compose ps` y en `docker compose logs funciones`, y volver a arrancar el
# proyecto lo reintenta entero.
#
# La única cosa que no puede resolverse sola es la **clave de administrador**, que
# se pide al backend una vez (paso 5 de la guía) y vive en el `.env` del proyecto
# como `CONVEX_ADMIN_KEY`. Sin ella este contenedor sale con el aviso que explica
# de dónde sacarla.

set -eu

# La clave de administrador no se imprime nunca: es la credencial de la instancia.
log() { printf 'funciones: %s\n' "$*"; }
fail() { printf 'funciones: %s\n' "$*" >&2; exit 1; }

: "${CONVEX_SELF_HOSTED_URL:?falta CONVEX_SELF_HOSTED_URL (lo pone el docker-compose.yml)}"
: "${SITE_URL:?falta SITE_URL en el .env: la dirección desde la que se usa la app}"

if [ -z "${CONVEX_SELF_HOSTED_ADMIN_KEY:-}" ]; then
  log "no hay clave de administrador (CONVEX_ADMIN_KEY en el .env), así que no puedo subir nada."
  log "Es lo esperado la primera vez: la firma el backend en cuanto arranca, así que se saca del propio NAS con"
  log ""
  log "    sudo docker compose exec backend ./generate_admin_key.sh | tail -1"
  log ""
  log "y pégala en el .env del proyecto, en la línea CONVEX_ADMIN_KEY=. Después arranca el proyecto otra vez."
  exit 1
fi

# El emisor de las sesiones de la plataforma: siempre el mismo salvo en una
# instalación que no sea la de siempre.
EMISOR="${VLY_CONVEX_AUTH_ISSUER:-https://freebuff.com}"

# El CLI viene con las dependencias del proyecto, así que se llama al que ya está
# instalado en la imagen. Se hace por su `bin/main.js` y no con `npx` porque el
# paquete no lo expone en su mapa `exports`, y porque `npx` intentaría descargarlo
# si no lo encontrara: en un NAS sin salida a internet, un rato perdido.
CLI="$(pwd)/node_modules/convex/bin/main.js"
[ -f "$CLI" ] || fail "no encuentro el CLI de Convex en $CLI: este contenedor no es el de la imagen «funciones»"
convex() { node "$CLI" "$@"; }

# ¿Contesta el backend? Se pregunta por su versión, que es lo que publica su
# `healthcheck`: dos minutos de margen para un NAS que arranca despacio.
esperar_backend() {
  intento=1
  while [ "$intento" -le 60 ]; do
    if wget -q -O /dev/null "${CONVEX_SELF_HOSTED_URL}/version" 2>/dev/null; then
      log "el backend responde: ${CONVEX_SELF_HOSTED_URL}"
      return 0
    fi
    if [ $((intento % 15)) -eq 0 ]; then
      log "esperando al backend… (${intento}/60)"
    fi
    intento=$((intento + 1))
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

esperar_backend ||
  fail "el backend no contesta en ${CONVEX_SELF_HOSTED_URL}: mira los registros del servicio «backend»"

nombres=""
if ! nombres="$(nombres_del_deployment)"; then
  fail "el deployment no contesta: comprueba CONVEX_CLOUD_ORIGIN en el .env (la dirección pública de la API) y que la clave de administrador sea la de esta instancia"
fi

fijar_variables || fail "no se han podido fijar las variables del deployment"
log "variables del deployment al día: SITE_URL=${SITE_URL} · emisor=${EMISOR}"

# Se vuelve a preguntar en lugar de reutilizar la lista de antes: ahora tiene una
# variable más, y así la decisión sobre las claves se toma con lo que hay de
# verdad puesto.
nombres="$(nombres_del_deployment)" || fail "el deployment ha dejado de contestar"

if tiene "$nombres" JWT_PRIVATE_KEY && tiene "$nombres" JWKS; then
  log "las claves de Convex Auth ya estaban: no se tocan (rotarlas cerraría las sesiones abiertas)"
else
  log "el deployment no tenía claves de Convex Auth: se generan ahora"
  # El mismo `npm run auth:keys` del repositorio, que las deja en el deployment.
  node scripts/generate-keys.mjs --set ||
    fail "no se han podido generar las claves de Convex Auth"
fi

log "subiendo el esquema y las funciones…"

# Un despliegue que no entra no se arregla esperando, pero el primer arranque
# —con el proxy inverso y el backend recién levantados— sí tropieza a veces: se
# reintenta un par de veces con una pausa corta y se cuentan los intentos.
intento=1
while :; do
  if convex dev --once; then
    log "listo: el esquema y las funciones están al día"
    exit 0
  fi
  if [ "$intento" -ge 3 ]; then
    fail "no se ha podido subir el código en ${intento} intentos: revisa los avisos de arriba"
  fi
  intento=$((intento + 1))
  log "el envío no ha entrado: se reintenta en 10 s (intento ${intento}/3)"
  sleep 10
done
