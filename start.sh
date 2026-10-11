#!/usr/bin/env sh
# Arranque de Pulso Taller en local: ./start.sh
#
# Hace lo mismo que `npm start`: levanta los contenedores de Convex, prepara el
# entorno, despliega las funciones, arranca la app y comprueba que todo
# responde. Al terminar imprime la comprobación de salud y la URL.

set -eu
cd "$(dirname "$0")"

if ! command -v npm >/dev/null 2>&1; then
  echo "No se encuentra npm. Instala Node 20 o superior desde https://nodejs.org" >&2
  exit 1
fi

npm start
