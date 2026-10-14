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
#      dominio es editarlo y volver a arrancar. Las escribe **solo este
#      contenedor**: el `vigilante`, que arranca a la vez, espera a que estén
#      puestas (si escribieran los dos, el que llegara segundo se llevaría un 503
#      del backend y el arranque se caería).
#   4. **Genera las claves de Convex Auth solo si faltan.** Con las que el
#      deployment firma y valida sus propias sesiones. Rotarlas cerraría todas las
#      sesiones abiertas, así que no se regeneran en cada arranque. Las genera
#      también solo este; el `vigilante` las espera.
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
#
# Cada paso está contado en `docker/synology/funciones-lib.sh`, que es lo que este
# guion comparte con `vigila-funciones.sh` —el servicio que se queda mirando
# `src/convex` y repite la subida cuando el código cambia, sin reiniciar nada—.

set -eu

PREFIJO=funciones
. "$(dirname "$0")/funciones-lib.sh"

comprobar_entorno
clave_de_administrador
comprobar_cli

esperar_backend ||
  fail "el backend no contesta en ${CONVEX_SELF_HOSTED_URL}: mira los registros del servicio «backend»"

preparar_deployment

subir || exit 1

# 6. **Deja hecha la cuenta de administrador** de una instalación nueva. El
#    taller que despliega en producción no quiere la muestra de ejemplo —sus
#    datos son los suyos y los da de alta a mano—, pero sí conviene que la
#    cuenta de administrador esté creada desde el principio: así no hay que
#    entrar a crearla y el primero que se registre no acaba siendo el
#    administrador por ser el primero. Solo actúa con la base **sin ninguna
#    cuenta**; en un taller que ya está en marcha no toca nada.
crear_cuenta_de_administrador
