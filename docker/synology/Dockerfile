# Pulso Taller en el NAS: dos imágenes salen de aquí, y las dos se construyen en
# el propio NAS desde el código que tiene al lado —Container Manager recompila al
# levantar el proyecto y no hay que copiar nada a mano—.
#
#   target app        → la aplicación (nginx con el sitio compilado)
#   target funciones  → el contenedor que sube el esquema y las funciones al
#                       backend al arrancar
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

# El contenedor que deja el backend con el esquema y las funciones de la app:
# arranca, lo sube y se va. Lleva Node y las dependencias porque el despliegue lo
# hace el propio CLI de Convex, y el guion que lo ordena va explicado línea a
# línea en `docker/synology/funciones.sh`.
FROM base AS funciones

COPY docker/synology/funciones.sh /usr/local/bin/funciones
RUN chmod +x /usr/local/bin/funciones

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
