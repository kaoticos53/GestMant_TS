# Pulso Taller en el NAS: dos imágenes salen de aquí, y las dos se construyen en
# el propio NAS desde el código que tiene al lado —Container Manager recompila al
# levantar el proyecto y no hay que copiar nada a mano—.
#
#   target app        → la aplicación (nginx con el sitio compilado)
#   target funciones  → los que suben el esquema y las funciones: el del
#                       arranque y el vigilante, que comparten imagen
#
# Las dos comparten la fase `base` (dependencias instaladas y código copiado), así
# que el `npm ci` —lo que más tarda— se paga una vez y lo aprovechan las dos.
#
# El contexto de construcción es la RAÍZ del repositorio (donde están
# `package.json`, `src/` y `public/`), no esta carpeta:
#
#   docker build -f docker/synology/Dockerfile \
#     --build-arg VITE_CONVEX_URL=https://api.tudominio.com \
#     -t pulso-taller-app:local .
#
# Sin `--target`, esa orden construye el sitio: la última fase de este archivo es
# la de nginx a propósito, que es la imagen que se espera quien la escribe a mano.
# En el NAS no hace falta escribirla: la hace Container Manager al levantar el
# proyecto, con la dirección que ya está en su `.env` (`CONVEX_CLOUD_ORIGIN`).

# --- 1. Preparar -------------------------------------------------------------

# Node y npm solo viven en las primeras fases: de la aplicación sale un puñado de
# archivos estáticos, así que lo que se sirve no lleva ni Node ni el código
# fuente.
FROM node:22-alpine AS base

WORKDIR /app

# Las dependencias primero y solas: mientras no cambie el `package-lock.json`,
# Docker reutiliza esta capa y reconstruir es cuestión de segundos en lugar de
# minutos. `npm ci` instala exactamente lo que fija el candado, también las
# herramientas de desarrollo: Vite y TypeScript compilan con ellas, y el CLI de
# Convex —que es una dependencia de verdad— también las necesita cuando el
# despliegue comprueba los tipos de las funciones.
COPY package.json package-lock.json ./
RUN npm ci

# El resto del proyecto. Lo que no hace falta (ni lo que no debe salir de casa,
# como el `.env.local` con la clave de administrador) queda fuera por el
# `.dockerignore` de la raíz.
COPY . .

# --- 2. Compilar el sitio ----------------------------------------------------

FROM base AS build

# La dirección con la que la app llama a su API. Va como argumento y no como
# valor fijo porque no es la misma en un NAS con dominio que en uno de red local.
#
# Y hay que tenerlo claro: Vite la graba **dentro** del sitio al compilar, así que
# no es un ajuste que se pueda cambiar al arrancar el contenedor. Cambiar de
# dirección es reconstruir la imagen (en Container Manager, volver a construir el
# proyecto).
ARG VITE_CONVEX_URL
ENV VITE_CONVEX_URL=$VITE_CONVEX_URL
RUN npm run build

# --- 3. Subir las funciones --------------------------------------------------

# La imagen que habla con el deployment desde dentro: arranca, deja el backend
# con el esquema y las funciones y se va. Lleva Node y las dependencias porque el
# despliegue lo hace el propio CLI de Convex.
#
# De aquí salen **los dos** servicios que suben funciones, porque los dos
# necesitan lo mismo (Node, el CLI y el código):
#
#   `funciones`   el del arranque: sube una vez y se va (este es su `CMD`)
#   `vigilante`   el que se queda: vuelve a subir cuando `src/convex` cambia, y
#                 el compose le cambia la orden por `vigila-funciones`
#
# Lo que comparten —esperar al backend, dejar puestas las variables del
# deployment, generar las claves de Convex Auth si faltan y subir con
# reintentos— vive en `funciones-lib.sh`, que leen los dos. Los pasos del
# arranque y los de la vigilancia están contados, uno a uno, en `funciones.sh` y
# en `vigila-funciones.sh`. El arranque, además, deja hecha la **cuenta de
# administrador** de una instalación nueva (y no carga ningún dato de ejemplo).
FROM base AS funciones

COPY docker/synology/funciones.sh /usr/local/bin/funciones
COPY docker/synology/vigila-funciones.sh /usr/local/bin/vigila-funciones
COPY docker/synology/funciones-lib.sh /usr/local/bin/funciones-lib.sh

# Y se les quitan los finales de linea de Windows, si los traen, antes de darles
# permiso de ejecucion. No es un detalle de estilo: el codigo entra en la imagen
# **tal cual esta en el ordenador que lo edita** --el NAS la construye desde su
# copia del arbol de trabajo, asi que no pasa por git y el `.gitattributes` no
# llega hasta aqui--, y en un archivo con finales de linea de Windows el `#!`
# queda como `#!/bin/sh\r`: la shell busca un interprete con ese nombre, no lo
# encuentra y el contenedor sale con «not found» y el codigo 127. Paso de verdad
# --el vigilante no llego a arrancar ni una vez-- y cuesta un rato verlo, porque
# el archivo esta ahi y el mensaje no habla de finales de linea. Se limpian aqui
# para que el contenedor arranque igual, venga el archivo como venga.
RUN sed -i 's/\r$//' /usr/local/bin/funciones /usr/local/bin/vigila-funciones /usr/local/bin/funciones-lib.sh \
  && chmod +x /usr/local/bin/funciones /usr/local/bin/vigila-funciones

CMD ["/usr/local/bin/funciones"]

# --- 4. Servir ---------------------------------------------------------------

# La misma imagen de nginx de antes, con el sitio y la configuración dentro: el
# contenedor ya no monta nada del NAS, así que una actualización no puede quedarse
# a medias entre lo que hay en una carpeta y lo que hay en la imagen.
#
# Va la última a propósito: sin `--target`, lo que sale de este archivo es la
# aplicación, que es lo que espera quien escribe la orden a mano.
FROM nginx:alpine AS app

COPY docker/synology/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
