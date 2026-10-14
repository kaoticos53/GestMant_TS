# Ejecutar Pulso Taller en local

Esta app (Vite + React 19 + Convex) no funciona con solo `npm run dev`: necesita
un **deployment de Convex** con las funciones y la base de datos. Este repositorio
trae preparado un backend Convex **autoalojado con Docker**, así que todo corre en
tu máquina, sin cuentas ni servicios externos.

| Servicio            | URL                   |
| ------------------- | --------------------- |
| App (Vite)          | http://localhost:5173 |
| API de Convex       | http://127.0.0.1:3210 |
| HTTP actions (auth) | http://127.0.0.1:3211 |
| Panel de Convex     | http://localhost:6791 |

## Requisitos

- **Node 20+** y npm.
- **Docker Desktop** (o el motor de Docker) **en marcha** — el backend de Convex
  se ejecuta en contenedores. Si no responde, el arranque lo levanta o lo reinicia
  él solo (ver más abajo).

## Arranque rápido

Un solo comando hace todo el trabajo:

```bash
npm start
```

La última línea que imprime es la URL de la app: al terminar, lo que hace falta
saber es dónde entrar. Además **abre esa URL en el navegador por defecto** (con
`--no-open` no lo hace). Si prefieres no escribir nada, hay lanzadores de doble
clic que llaman a este mismo comando y dejan la ventana abierta con la URL a la
vista: **`start.cmd`** en Windows y **`./start.sh`** en Linux y macOS.

Levanta los contenedores, espera a que el backend esté listo, crea `.env.local`
si falta (sacando la clave de administrador del propio contenedor), prepara las
variables de auth del deployment, arranca Vite y deja **`convex dev` vigilando
`src/convex` en segundo plano**: los cambios del backend —funciones y esquema— se
despliegan solos mientras trabajas, sin volver a lanzar nada. Al final imprime una
**comprobación de salud** del entorno:

```
Estado del entorno local
  ✓ Contenedores del backend en marcha
  ✓ API de Convex responde en http://127.0.0.1:3210
  ✓ HTTP actions de auth responden en http://127.0.0.1:3211
  ✓ `.env.local` completo
  ✓ Clave de administrador vigente
  ✓ Variables de auth del deployment
  ✓ Funciones de Convex desplegadas
  ✓ Convex vigilando `src/convex`
  ✓ Observador desplegando sin errores
  ✓ App servida en http://localhost:5173
```

Si algo está mal, esa línea sale en rojo (✗) y el comando termina con error, así
que también sirve desde un script o en CI.

Es **idempotente**: puedes lanzarlo tantas veces como quieras. Reutiliza los
contenedores que ya estén en marcha, el Vite que ya esté sirviendo y el observador
de Convex que ya esté vigilando, y **nunca rota las claves JWT** si ya existen
(rotarlas obligaría a volver a entrar a todo el mundo).

Reutilizar es literal, y se dice: si los contenedores del proyecto ya están en
marcha el arranque lo cuenta (`Ya estaba en marcha 2 contenedor(es) de este
proyecto: los reutilizo`) en vez de volver a levantarlos a ciegas, y si el 5173 ya
lo sirve un Vite de este proyecto —abierto en otro terminal, con `npm run dev`, o
el que dejó un lanzador— lo reutiliza y lo deja escrito en el panel (`App
http://localhost:5173 (la dejó otro terminal, pid …)`), sin arrancar un segundo
servidor que se pelearía por el mismo puerto. `npm run local:stop` para solo lo
suyo: el Vite ajeno se cierra donde se abrió. Y si lo que contesta en el puerto no
es un Vite de este proyecto —otro taller servido en el mismo 5173— el arranque lo
avisa en vez de dar por buena una app que no es esta.

Cuando el puerto lo tiene **otro**, también se sabe quién: un contenedor de otro
proyecto en el 3210, el 3211 o el 6791 deja de ser un «port is already allocated»
opaco y el mensaje nombra el contenedor, su proyecto de Compose y la carpeta desde
la que se arrancó —igual en el arranque que en la línea de `local:check`—, que es
lo que hace falta para pararlo (`docker stop …`) o cambiar el puerto. Si lo que
responde en el 3210 es otro backend, el arranque lo avisa: las funciones de esta
app no están ahí, y eso la comprobación de salud no lo perdona.

El observador que reutiliza no tiene por qué ser suyo: si ya tenías un
`convex dev` abierto en otro terminal —o lo dejó un agente—, el arranque lo ve y
**no levanta un segundo**, porque dos observadores sobre el mismo deployment se
pisan. En el panel lo dice (`Observador src/convex → lo dejó otro terminal (pid …)`)
y recuerda que `npm run local:stop` no lo toca: ese se para donde lo abriste. La
única excepción es cuando el entorno cambia (clave de administrador rotada, base
de datos nueva) — ahí el observador ajeno tiene la clave vieja y no puede
desplegar, así que el arranque avisa para que lo cierres y levanta el suyo.

Si prefieres que lo cierre el propio comando, `npm start -- --take-over` se hace
cargo: le pide al observador ajeno que termine (y, si no se va, lo para a la
fuerza) y arranca el suyo, que es lo que deja **uno solo** sin tener que buscar la
terminal donde lo abriste. Sin ese flag no se toca un proceso que no arrancó este
script —solo se avisa—, y sobre el observador propio no hace nada: ahí no hay nada
ajeno que tomar. `--repair --take-over` hace lo mismo por el camino de la
reparación, que es donde el entorno acaba de cambiar.

**Un despliegue que no entra no se queda callado.** Si el observador deja de poder
desplegar —un esquema que el backend rechaza, un typecheck roto— el backend sigue
sirviendo lo último que sí entró y los cambios se quedan sin aplicar; la sonda de
salud no lo vería, porque las funciones de antes responden igual. El arranque lo
mira en el log del observador (cómo acabó su último intento), lo cuenta con el
error delante en vez de dar por bueno el «ya estaba vigilando», y si se le pide
que arranque el observador con el esquema ya roto no espera los tres minutos de
margen: corta en cuanto ve el fallo y lo explica. En la tabla sale en amarillo
(`!`), sin parar el arranque —la app se puede usar mientras arreglas el error—, y
el observador reintenta solo al guardar la corrección. El diagnóstico
(`npm run local:check`) no lo perdona y termina con error. Con un observador ajeno
sus errores salen en el terminal donde lo abriste: de ese no hay log que leer aquí.

**El motor de Docker que se cuelga tampoco deja el arranque mudo.** Todas las
órdenes que se le mandan llevan un techo de tiempo —un motor colgado deja la orden
esperando indefinidamente, sin imprimir nada—, así que uno que no contesta se
detecta en 20 segundos: el arranque lo cuenta con el motivo delante y lo reinicia
o
lo arranca él mismo (`docker desktop restart` / `docker desktop start`), y espera
a que vuelva antes de seguir. Si el backend ya estaba sirviendo no lo toca
—reiniciarlo pararía lo que funciona—, y se limita a avisar y a decirte qué hacer
cuando te venga bien. En Linux el motor es un servicio del sistema y reiniciarlo
necesita permisos de administrador, así que te deja el comando y termina con
error. En el diagnóstico (`npm run local:check`) un motor colgado sale en la tabla
con su motivo, en vez de dejar el comando esperando.

Lo mismo vale para el **CLI de Convex**: si el backend no contesta no falla, se
queda reintentando en bucle sin rendirse, así que sus consultas también llevan su
techo de tiempo (30 s) y el diagnóstico cuenta que el backend no responde en vez
de dar la clave de `.env.local` por caducada.

| Comando                        | Para qué sirve                                                         |
| ------------------------------ | ---------------------------------------------------------------------- |
| `npm start`                    | Todo el arranque, comprobación de salud y abre la app en el navegador. |
| `npm run local`                | Lo mismo que `npm start` (el mismo script).                            |
| `start.cmd` / `./start.sh`     | Lo mismo, con doble clic (Windows / Linux y macOS).                    |
| `npm run local -- --fresh`     | Borra la base de datos, la rehace y carga los datos de ejemplo.        |
| `npm run local -- --no-open`   | Arranque completo sin abrir el navegador al terminar.                  |
| `npm run local -- --repair`    | Arregla un entorno roto sin tocar los datos existentes.                |
| `npm run local -- --take-over` | Cierra el observador que dejó otro terminal y arranca el suyo.         |
| `npm run local:check`          | Solo la comprobación de salud (no cambia nada).                        |
| `npm run local:stop`           | Para el Vite y el observador que arrancó `npm run local`.              |

### Demo desde cero (sin pasos manuales)

Cuando lo que quieres es enseñar la app o empezar de nuevo, este es el comando:

```bash
npm run local -- --fresh
```

Borra el volumen de Docker del backend (datos incluidos), lo vuelve a levantar,
refresca la clave de administrador de `.env.local` —un backend recién creado
firma con otro secreto, así que la anterior dejaría de valer—, regenera las
claves de auth del deployment, deja las funciones desplegadas y **deja la muestra
cargada**, firmando como la cuenta de administrador.

Al terminar te dice cuántas incidencias, peticiones y repuestos han quedado y te
recuerda que basta con entrar con las credenciales de siempre: no hay que pulsar
«Cargar datos de ejemplo» ni dar de alta ninguna cuenta.

> Se pierde todo lo que hubiera en la base de datos de este entorno: es
> exactamente lo que promete la opción. Si tenías la app abierta, vuelve a
> entrar; la sesión anterior ya no vale (las claves JWT son nuevas).

### Reparar un entorno roto (sin perder datos)

Cuando el entorno se ha quedado a medias —el backend ya no acepta lo que hay en
`.env.local`, faltan variables o las funciones no llegaron a desplegarse— hay un
comando que lo diagnostica y lo arregla **sin tocar la base de datos**:

```bash
npm run local -- --repair
```

Primero imprime la misma tabla de salud del arranque normal y después arregla solo
lo que esté en rojo:

- **clave de administrador caducada** (el volumen de Docker se ha rehecho y la de
  `.env.local` ya no vale) → escribe una que funcione con este backend;
- **`.env.local` a medias** (le falta alguna línea) → añade las que falten con el
  valor de la plantilla, sin tocar las que ya están;
- **variables de auth del deployment** (`SITE_URL`, `VLY_CONVEX_AUTH_ISSUER`,
  `JWT_PRIVATE_KEY`, `JWKS`) → define las que falten y genera el par de claves si
  no hay ninguna (las que ya existan no se rotan);
- **funciones sin desplegar u observador parado** → arranca `convex dev`, que
  despliega `src/convex/` y se queda vigilando los ficheros;
- **contenedores o Vite parados** → los levanta (reutilizando lo que ya esté en
  marcha).

El observador se reinicia solo cuando la clave de administrador ha cambiado (por
ejemplo tras un `--fresh`): la que leyó al arrancar ya no valdría para desplegar.
Con uno que no arrancó este comando no puede hacer eso —cerrarlo no le toca—, así
que avisa y arranca el suyo: el ajeno ya no puede desplegar y el nuevo deja el
backend al día.

Lo único que borra datos es `--fresh`. Al terminar repite la comprobación de
salud: si algo sigue en rojo, el comando termina con error y lo deja señalado.

Un despliegue que no entra no se puede reparar desde aquí: el error está en el
código (el esquema, un typecheck) y `--repair` acaba señalándolo con el motivo,
no arreglándolo. Corrige el error y guarda: el observador reintenta solo.

```bash
npm run local:repair     # lo mismo, sin el `--`
```

`npm run local` deja **dos cosas** en segundo plano y devuelve el control a la
terminal: Vite y el observador de Convex. Los logs de cada uno acaban en un archivo
temporal que el propio comando te indica (el del backend incluye los `console.log`
de las funciones de Convex, así que sirve para depurarlas). Para parar los dos:

```bash
npm run local:stop
```

### Arranque a mano (paso a paso)

Si prefieres controlar cada pieza, o quieres entender qué hace el comando:

```bash
npm install                                  # 1. dependencias
npm run convex:up                            # 2. levanta el backend local (Docker)

npm run convex:admin-key                     # 3. copia la clave que imprime...
cp .env.example .env.local                   #    ...y pégala en .env.local
#    → CONVEX_SELF_HOSTED_ADMIN_KEY=convex-self-hosted|...

npm run convex:push                          # 4. sube funciones + esquema
npm run auth:keys                            # 5. genera JWT_PRIVATE_KEY y JWKS
npm run convex:push                          #    vuelve a subir (ya valida auth)

npm run dev                                  # 6. app en http://localhost:5173
```

Y para trabajar con recarga automática de las funciones de Convex, **dos
terminales**:

```bash
npm run convex:dev      # terminal 1: observa src/convex y despliega al guardar
npm run dev             # terminal 2: servidor de Vite
```

`npm run local` hace eso mismo por ti: deja el observador en segundo plano (y
Vite). Si prefieres verlo en tu terminal, sigue con los dos comandos de arriba
**antes** de arrancar el comando: cuando ya hay uno vigilando, `npm run local` lo
detecta y lo deja estar, en vez de arrancar un segundo que se pise con el tuyo.

## Acceder a la aplicación

En http://localhost:5173/auth → pestaña **Contraseña** → botón
**«Usar credenciales»** y **Entrar**.

| Usuario           | Contraseña   |
| ----------------- | ------------ |
| `admin@taller.es` | `admin12345` |

La primera vez que pulsas **Entrar** la cuenta de administrador se crea sola
(verás un `InvalidAccountId` en la consola: es el sondeo previsto antes del alta).
También puedes pulsar **«Entrar como invitado»** para un acceso anónimo rápido.

Dentro del panel, el botón **«Cargar datos de ejemplo»** rellena el taller con
repuestos, equipos, manuales, incidencias y peticiones de demostración. Los
manuales van en PDF —una hoja de ejemplo por manual, compuesta al vuelo— y en
notas del taller: todo el inventario tiene su expediente —la ficha de cualquier
equipo trae ya su manual asignado— y, junto a ellos, van manuales del modelo y
sueltos, que son los otros dos casos que el módulo distingue.

## Qué hace cada comando

| Comando                        | Para qué sirve                                                             |
| ------------------------------ | -------------------------------------------------------------------------- |
| `npm run local`                | Arranque completo de un solo golpe, con comprobación de salud.             |
| `npm run local -- --fresh`     | Arranque desde cero con los datos de ejemplo ya cargados.                  |
| `npm run local -- --repair`    | Diagnostica y arregla el entorno sin borrar datos.                         |
| `npm run local:check`          | Comprueba el entorno sin cambiar nada (código de salida ≠ 0 si falla).     |
| `npm run local -- --no-open`   | Arranque completo sin abrir el navegador al terminar.                      |
| `npm run local -- --take-over` | Cierra el observador que dejó otro terminal y arranca el suyo.             |
| `npm run local:stop`           | Para el Vite y el observador que arrancó `npm run local`.                  |
| `npm run convex:up`            | Arranca backend + panel en Docker (`docker/convex/docker-compose.yml`).    |
| `npm run convex:down`          | Para los contenedores. **Los datos se conservan** en un volumen Docker.    |
| `npm run convex:logs`          | Sigue los logs del backend.                                                |
| `npm run convex:admin-key`     | Imprime una clave de administrador nueva del backend local.                |
| `npm run convex:dev`           | Lo mismo que deja `npm run local` en segundo plano, pero en esta terminal. |
| `npm run convex:push`          | Despliegue único (útil en el arranque o desde CI).                         |
| `npm run auth:keys`            | Regenera `JWT_PRIVATE_KEY` y `JWKS` en el deployment.                      |
| `npm run dev`                  | Servidor de desarrollo de Vite.                                            |

## Variables de entorno

Se organizan en dos sitios distintos y es fácil confundirlos:

1. **`.env.local`** (tu máquina, en `.gitignore`): lo leen Vite y el CLI de Convex.
   `CONVEX_SELF_HOSTED_URL`, `CONVEX_SELF_HOSTED_ADMIN_KEY`, `VITE_CONVEX_URL`,
   `CONVEX_SITE_URL`, `SITE_URL`. Hay una plantilla en `.env.example`.

2. **Variables del deployment de Convex** (viven en el backend, no en el repo):
   se consultan y se cambian con `npx convex env list` / `npx convex env set`.
   Las que necesita este proyecto:
   - `SITE_URL` → `http://localhost:5173`
   - `JWT_PRIVATE_KEY` y `JWKS` → las genera `npm run auth:keys`
   - `VLY_CONVEX_AUTH_ISSUER` → `https://freebuff.com` (proveedor de identidad
     federada de freebuff; el archivo `src/convex/auth.config.ts` lo exige, aunque
     en local no se use)
   - `CONVEX_SITE_URL` viene **incorporada** en el backend; no se puede sobrescribir.

> `src/convex/auth.config.ts`, `src/convex/auth.ts` y
> `src/convex/auth/emailOtp.ts` no se deben modificar.

## Qué NO funciona en local

- **Código por email (OTP)**: `emailOtp.ts` envía los códigos a través de la
  pasarela de integraciones de freebuff y necesita `VLY_INTEGRATION_KEY`, una
  variable del proyecto original en la nube que no está en el repositorio. Usa
  contraseña o el acceso como invitado.
- **La barra flotante de Freebuff** y el envío de errores a su panel: solo tienen
  sentido dentro del editor en la nube.
- **`main.ts`** es el servidor Deno/Hono para servir `dist/` en despliegue; no se
  usa en local.

## Solución de problemas

**`docker: command not found` o «cannot connect to the Docker daemon»**
Arranca Docker Desktop y espera a que el icono deje de parpadear. Si el motor
está _colgado_ —no contesta a nada—, `npm start` lo detecta: le da 20 segundos y,
si no responde, lo reinicia él mismo (`docker desktop restart`) diciendo lo que
hace. Los contenedores se paran un momento y vuelven solos; los datos están en un
volumen y no se pierden. Si el backend ya estaba sirviendo no lo toca —reiniciar
el motor pararía lo único que funciona—, solo te dice cómo hacerlo cuando te
venga bien. En Linux sin Docker Desktop no puede: reiniciar el motor necesita
permisos de administrador, así que te deja el comando (`sudo systemctl restart
docker`) y termina con error.

**El backend no responde en `http://127.0.0.1:3210`**
Comprueba que los contenedores están sanos y mira los logs. Y si están parados,
no hace falta que adivines por qué: `npm run local:repair` no se queda esperando
(lo corta al medio minuto diciendo que el CLI de Convex se ha quedado sin
respuesta) y los vuelve a levantar solo.

```bash
docker compose -f docker/convex/docker-compose.yml ps
npm run convex:logs
```

**«port is already allocated»**
Otro proceso ocupa el 3210, el 3211 o el 6791. En este repositorio los puertos
están **fijos** en `docker/convex/docker-compose.yml` (a propósito: la plantilla
oficial los toma de la variable `PORT`, y con `PORT=0` el backend acabaría en un
puerto aleatorio que ni el CLI ni la app encontrarían). El arranque ya dice quién
lo tiene —el contenedor, su proyecto de Compose y desde qué carpeta se arrancó, o
el pid del proceso que escucha—, así que no hay que adivinar: empieza por ahí y
libéralo (o cámbialo en el compose **y** en `.env.local`).

**Errores de autenticación / bucle de vuelta a `/auth`**
Antes de tocar nada, mira qué es lo que falla:

```bash
npm run local:check
```

Si sale algo en rojo —clave de administrador caducada, variables de auth que
faltan, funciones sin desplegar, el observador parado— déjaselo al propio
comando, que lo arregla sin tocar los datos:

```bash
npm run local -- --repair
```

Y si prefieres hacerlo a mano cuando el problema son las claves JWT del
deployment:

```bash
npm run auth:keys
npm run convex:push
```

**Quiero empezar con la base de datos vacía**
El archivado y los datos viven en el volumen `convex_data`. Para reiniciar de
cero (se perderá todo) lo más corto es la opción que lo deja todo listo:

```bash
npm run local -- --fresh
```

Si prefieres hacerlo a mano y quedarte sin datos de ejemplo:

```bash
npm run convex:down
docker volume rm convex_data
npm run convex:up
```

**«Environment variable VLY_CONVEX_AUTH_ISSUER is used in auth config file but
its value was not set»**
El deployment aún no tiene las variables de la sección anterior. Lo más corto es
dejar que las ponga el comando de reparación:

```bash
npm run local -- --repair
```

A mano sería:

```bash
npx convex env set VLY_CONVEX_AUTH_ISSUER https://freebuff.com
npx convex env set SITE_URL http://localhost:5173
npm run auth:keys
```

**`src/convex/_generated/` no existe, o la app se queja de un módulo que ya está**
Es código generado, y va **en el repositorio**: es lo que `tsc -b` lee para saber qué
funciones existen (`api.dashboard`, `api.incidents`…), así que sin él no compila ni aquí
ni en el NAS. Viaja con el código a propósito —también con `git pull`, que es como se
actualiza el NAS—, y por eso se regenera y **se añade al commit** cuando se toca un
módulo:

```bash
npm run convex:up        # la primera vez: levanta el backend local
npm run convex:push      # sube el esquema y las funciones, y reescribe _generated
git add src/convex/_generated
```

Si se queda atrás, no hay que adivinar nada: «npm run nas» lo comprueba antes de
empaquetar y para diciendo qué módulos faltan.
