# Pulso Taller en un NAS Synology

Cómo dejar el taller corriendo dentro de un NAS Synology, con Container Manager,
sin depender de nada que no sea de casa: la app, la base de datos y los archivos
viven en el NAS.

> Si tu servidor no es un Synology sino una **VM Debian en Proxmox**, el montaje
> es el mismo (mismos contenedores, mismo volumen, mismo `npm run nas`) y está
> contado en **[PROXMOX.md](./PROXMOX.md)**: cambia lo de delante — una **VM**
> con Docker y **Caddy** en lugar del proxy inverso de DSM —.

Son **tres contenedores** que se quedan y **uno que pasa**: el que sube el
esquema y las funciones al backend. El backend es un Convex autoalojado —el mismo
que usa el entorno local del repositorio (`docker/convex/`)—, así que aquí no hay
cuentas en la nube ni servicios de terceros:

| Qué                        | Dónde                                              | Contenedor                            |
| -------------------------- | -------------------------------------------------- | ------------------------------------- |
| La aplicación              | `https://taller.tudominio.com`                     | `app` (nginx)                         |
| La API de Convex           | `https://api.tudominio.com`                        | `backend` (puerto 3210)               |
| Acciones HTTP (sesiones)   | `http://127.0.0.1:3211` — solo dentro del NAS      | `backend`                             |
| Panel de administración    | `http://IP-del-NAS:6791` — solo desde la red local | `dashboard`                           |
| El esquema y las funciones | dentro del backend, subidos desde el propio NAS    | `funciones` (arranca, sube y se para) |
| Los datos                  | volumen Docker `pulso-taller_datos`                | `backend`                             |

Y las funciones las sube el propio NAS, no tu ordenador: el contenedor `funciones`
hace el despliegue cada vez que se arranca el proyecto, así que un cambio en
`src/convex/` llega con solo llevar el código y arrancar otra vez.

**Por qué dos direcciones y no una.** Quien usa la app necesita llegar a la API
(el navegador abre ahí la conexión en vivo con el backend), así que la API tiene
su propia dirección pública y su WebSocket. Las «acciones HTTP» —por donde Convex
Auth publica las claves con las que valida las sesiones— no las pide ningún
navegador: se las pide el propio backend a sí mismo, por eso se quedan en
`127.0.0.1` y no hay que publicarlas ni ponerles certificado. Es exactamente el
mismo reparto que usa el entorno local del repositorio.

## Lo que hace falta

- **DSM 7.2 o más nuevo**, con **Container Manager** instalado desde el Centro de
  paquetes, y la carpeta compartida `docker` creada (la crea él).
- **SSH activado** (Panel de control → Terminal y SNMP) para las órdenes de este
  documento. Todo lo que se hace por consola se puede hacer también desde
  **File Station** (los archivos) y desde **Container Manager** (los
  contenedores); se indica en cada paso.
- **Un ordenador** con el proyecto clonado, solo para llevar el código al NAS
  (paso 3). Ni la app se construye ahí (la compila el NAS) ni hace falta para
  desplegar las funciones (las sube el NAS al arrancar), así que **no necesita
  Node**: basta con poder copiar archivos —o con `git` en el propio NAS—.
- **Un dominio** con dos subdominios (`taller.` y `api.`). Si no lo tienes, al
  final está la variante sin dominio, solo para la red local.
- Un **certificado** para esos dos nombres: DSM lo saca de Let's Encrypt sin
  coste y sin salir de casa (paso 6).

## Todo de una vez: `npm run nas`

Los pasos 1 a 5 —la carpeta, el `.env`, el código, el proyecto en marcha y el
primer despliegue— se hacen de una sola vez desde el ordenador, con el proyecto
clonado:

```bash
npm run nas -- --host IP-del-NAS \
  --user admin \
  --app-url https://taller.tudominio.com \
  --api-url https://api.tudominio.com
```

Entra por SSH, lleva el código (sin `node_modules/`, sin `dist/` y sin
`.env.local`) y deja el NAS haciendo lo que queda: escribe el `docker-compose.yml`
y el `.env` si no están, genera el `INSTANCE_SECRET` cuando falta, construye las
imágenes, arranca los contenedores, le pide al backend la clave de administrador
y espera a que el contenedor `funciones` suba el esquema y las funciones. Termina
con un panel que dice cómo ha quedado todo, y la última línea es la URL de la app.

Se puede lanzar tantas veces como haga falta, y ese es su punto: **nunca cambia
nada que ya esté hecho**. El `docker-compose.yml` del NAS se conserva si tiene
cambios propios (los puertos de la variante sin dominio, por ejemplo), el `.env`
solo se rellena donde esté vacío —el secreto de la instancia y la clave de
administrador no se rotan nunca, porque rotarlos dejaría fuera a quien esté
dentro— y los datos no se tocan jamás: viven en el volumen. Para actualizar la
app después de un cambio, lo mismo: llevas el código y reconstruye.

Dos detalles que conviene saber antes:

- **La primera vez, las direcciones.** Si no le pasas `--app-url` y `--api-url`,
  el comando deja el `.env` escrito con la plantilla y **para antes de construir**
  —compilar la app con una dirección de mentira dejaría el sitio roto—: rellena
  esas dos líneas (o vuelve a lanzarlo con las dos opciones) y sigue desde ahí.
- **Los pasos 6 y 7 no.** El HTTPS del proxy inverso de DSM y la comprobación
  final se hacen con el ratón, en DSM; el comando te deja el taller en pie justo
  antes.

Opciones útiles: `--path` (si el proyecto no vive en
`/volume1/docker/pulso-taller`), `--force-compose` (pisar el
`docker-compose.yml` del NAS con el del repositorio), `--new-key` (pedir otra
clave de administrador, como en «Me he quedado fuera») y `--no-build` (arrancar
sin reconstruir). El host también se puede dejar fijado en `NAS_HOST`, y las
demás en `NAS_USER`, `NAS_PATH`, `NAS_APP_URL` y `NAS_API_URL`. Con
`npm run nas -- --help` sale esta misma lista.

Si prefieres ir paso a paso —o entender qué hace cada uno—, los siguientes
apartados son ese mismo camino a mano. Todo lo que hace el comando se puede hacer
por SSH y con Container Manager.

## Paso 1 — La carpeta del proyecto en el NAS

```bash
sudo mkdir -p /volume1/docker/pulso-taller/codigo
sudo chown -R "$USER" /volume1/docker/pulso-taller
```

Queda así:

```text
/volume1/docker/pulso-taller/
├── docker-compose.yml     ← copia de docker/synology/docker-compose.yml
├── .env                   ← lo escribes ahora (paso 2)
├── codigo/                ← el proyecto, con su Dockerfile dentro (paso 3)
└── .setup/                ← lo que deja `npm run nas`: el docker-compose.yml y la
                             plantilla del .env recién traídos, y el guion que hace
                             los pasos 1 a 5 dentro del NAS
```

Ya no se copia el sitio construido ni la configuración de nginx: la imagen se
compila sola desde `codigo/`, y el `Dockerfile` y el `nginx.conf` viajan dentro
del repositorio. El único archivo suelto es el `docker-compose.yml`, que está en
el repositorio, en `docker/synology/`. Cópialo desde tu ordenador (en File Station
también vale, arrastrándolo a la carpeta):

```bash
scp docker/synology/docker-compose.yml \
    admin@IP-del-NAS:/volume1/docker/pulso-taller/
```

## Paso 2 — El `.env` del proyecto

Es el archivo que lee Compose al arrancar. Vive **en el NAS** y no se sube al
repositorio. Genéralo desde `docker/synology/.env.example`:

```text
INSTANCE_NAME=pulso-taller
INSTANCE_SECRET=<32 bytes en hexadecimal>
CONVEX_CLOUD_ORIGIN=https://api.tudominio.com
SITE_URL=https://taller.tudominio.com
CONVEX_ADMIN_KEY=
```

Las cinco son todas: dos direcciones, un nombre, un secreto y una clave. La
descripción completa, con lo opcional comentado, está en el propio
`docker/synology/.env.example`; el archivo que se copia al NAS es `.env`, sin la
extensión.

El secreto se genera una vez, en el propio NAS:

```bash
openssl rand -hex 32
```

Y **no se cambia nunca**: al rotarlo dejan de valer las claves de administrador y
todas las sesiones abiertas. Cópialo donde guardes las contraseñas del taller.

`CONVEX_CLOUD_ORIGIN` es la dirección pública de la API. No es solo para que la
encuentren los navegadores: **las direcciones de las fotos y los documentos que
sirve el backend se construyen con ella**, así que si aquí pusieras una dirección
local, los adjuntos no cargarían desde fuera.

Y es también la dirección con la que se compila la app: el `docker-compose.yml` se
la pasa al construirla, así que este valor manda en los dos sitios y no hay una
segunda copia que se pueda quedar desfasada. Es además a donde sube las funciones
el contenedor `funciones`.

`SITE_URL` es la dirección de la app —la que se teclea en el navegador—. Las
funciones la usan para armar los enlaces que mandan (el aviso de una incidencia,
el resumen semanal), así que tiene que ser la de verdad y no `localhost`.

`CONVEX_ADMIN_KEY` se deja **vacía** ahora: la firma el backend con el secreto de
la instancia, así que no se puede saber hasta que haya arrancado una vez. Se pide
en el paso 5, que es lo único que no puede hacer solo el NAS.

Guarda el archivo en File Station (clic derecho → Editar, con el editor de texto)
o con `vi`. No hace falta protegerlo con permisos especiales, pero sí que no lo
vea quien no deba: lleva el secreto de la instancia y la clave del backend.

## Paso 3 — Llevar el código al NAS

El contenedor `app` se construye desde el proyecto, así que el proyecto tiene que
estar en el NAS. Lo que viaja es el **código fuente** —unos pocos megas—, no el
sitio construido ni las dependencias: eso lo pone la imagen al compilarse.

Desde la raíz del proyecto, en el ordenador (con Git Bash, macOS o Linux):

```bash
tar --exclude=node_modules --exclude=dist --exclude=.env.local -czf - . \
  | ssh admin@IP-del-NAS \
      'rm -rf /volume1/docker/pulso-taller/codigo && mkdir -p /volume1/docker/pulso-taller/codigo && tar xzf - -C /volume1/docker/pulso-taller/codigo'
```

En File Station, si prefieres el ratón: comprime el proyecto en un `.zip` —sin
`node_modules/`, sin `dist/` y **sin `.env.local`**, que lleva la clave de
administrador— y descomprímelo dentro de `codigo/`.

Si el proyecto está en un repositorio remoto, `git clone` en el NAS deja lo mismo
y actualizar luego es `git pull`. Lo que no vale es copiar `node_modules/`: los
binarios de tu ordenador —en Windows, sobre todo— no son los que necesita el NAS,
y el `npm ci` de dentro de la imagen los trae buenos.

## Paso 4 — Crear el proyecto en Container Manager

Con el ratón: **Container Manager → Project → Create**, pon de nombre
`pulso-taller` y de ruta `/volume1/docker/pulso-taller`. El asistente te deja
elegir el `docker-compose.yml` que ya está en esa carpeta; al terminar, dale a
**Start**.

La primera vez, ese **Start** construye dentro del propio NAS las dos imágenes que
salen del código —el sitio y el contenedor que sube las funciones—: instala las
dependencias, compila el sitio (Node y npm van dentro de la imagen, así que no hay
que instalarlos en el NAS) y reutiliza esa misma instalación para la segunda.
Tarda unos minutos; se ve cómo va en **Project → el proyecto → Build Details**.

Por SSH es lo mismo, y de paso compruebas que arranca bien:

```bash
cd /volume1/docker/pulso-taller
sudo docker compose up -d --build
sudo docker compose ps
```

El `--build` es lo que recompila cuando el código ha cambiado; sin él, Compose
levanta las imágenes que ya tenía. En este primer arranque el contenedor
`funciones` saldrá con un aviso y se parará: le falta la clave de administrador,
que es de lo que va el paso 5.

> En las versiones más antiguas de Container Manager la orden es
> `sudo docker-compose …` (con guion). Para saber cuál tienes:
> `docker compose version`.

Los tres que se quedan tienen que estar en `running` (el `backend`, además,
`healthy`); el de las funciones aparece como `exited (0)`, que es como debe
quedar. Si algo no arranca, el motivo está en sus registros:

```bash
sudo docker compose logs -f backend
```

En Container Manager, los registros están en **Container → el contenedor →
Details → Log**.

## Paso 5 — La clave del backend y el primer despliegue

El backend arranca vacío: no tiene ni el esquema ni las funciones de la app. Eso
lo sube el propio NAS, con el contenedor `funciones`, y lo vuelve a subir cada vez
que se arranca el proyecto. Para poder hacerlo solo le falta una cosa que no puede
saber por su cuenta: la **clave de administrador**. Así que la primera vez son dos
arranques; después, ninguno.

**1. Arranca solo el backend** (por SSH, en la carpeta del proyecto; los demás
contenedores pueden seguir parados):

```bash
cd /volume1/docker/pulso-taller
sudo docker compose up -d backend
```

Desde Container Manager vale también el **Start** del proyecto: el contenedor
`funciones` saldrá con un aviso que dice de dónde sacar la clave y se parará. Es
lo esperado esa primera vez, no un fallo.

**2. Pide la clave al backend:**

```bash
sudo docker compose exec backend ./generate_admin_key.sh | tail -1
```

Imprime una línea que empieza por el nombre de la instancia —con
`INSTANCE_NAME=pulso-taller`, algo como `pulso-taller|01ab…`—. El `tail -1` se
queda con la clave y deja fuera el `Admin key:` que la orden imprime antes. Es una
credencial: trátala como el secreto de la instancia.

**3. Pégala en el `.env`**, en la línea que dejaste vacía:

```text
CONVEX_ADMIN_KEY=pulso-taller|01ab…
```

**4. Arranca el proyecto entero:**

```bash
sudo docker compose up -d --build
```

El contenedor `funciones` se pone en marcha y hace su trabajo. Se ve cómo va en
sus registros:

```bash
sudo docker compose logs -f funciones
```

Cuando termina, se para: con `docker compose ps` aparece como `exited (0)`, y eso
es lo correcto —ha hecho su recado—. Su última línea es «listo: el esquema y las
funciones están al día». Si sale con error lo dice con palabras: mira el apartado
**Problemas frecuentes**.

Lo que hace, en orden, y por qué:

- **Espera al backend** y le pregunta qué tiene puesto, que es también la forma de
  comprobar que la clave es la de esta instancia.
- **Deja puestas las variables del deployment**: `SITE_URL` y el emisor de las
  sesiones. Van antes de subir el código porque el despliegue no entra si la
  configuración de auth pide una variable que no está puesta. Manda el `.env`:
  cambiar de dominio es editarlo y arrancar otra vez.
- **Genera las claves de Convex Auth** (`JWT_PRIVATE_KEY` y `JWKS`) **solo cuando
  faltan**. Con ellas el backend firma y valida sus propias sesiones, así que no se
  regeneran en cada arranque: rotarlas cerraría todas las sesiones abiertas.
- **Sube el esquema y las funciones** (`convex dev --once`, el mismo
  `npm run convex:push` con el que se trabaja en local) y reintenta un par de veces
  si el primer intento tropieza con un arranque recién hecho.

Nada de esto toca los datos: se puede repetir tantas veces como haga falta.

> `CONVEX_SITE_URL` no se toca: viene incorporada en el backend y sale del
> `CONVEX_SITE_ORIGIN` del compose (el `127.0.0.1:3211` de dentro del NAS). Es la
> dirección con la que el backend firma y valida sus propias sesiones.

## Paso 6 — HTTPS con el proxy inverso de DSM

El HTTPS no lo pone ningún contenedor: lo pone DSM delante, con el certificado de
Let's Encrypt, y hacia dentro todo va por HTTP y por `127.0.0.1`. Hacen falta dos
reglas y el WebSocket activado en la de la API.

**DNS.** Crea dos registros `A` en tu dominio, `taller` y `api`, apuntando a la
dirección desde la que se llega al NAS (la pública, o la local si solo lo vas a
usar dentro de casa).

**Las reglas.** Panel de control → **Portal de inicio → Avanzado → Proxy
inverso → Crear**:

| Nombre      | Origen                                      | Destino                          |
| ----------- | ------------------------------------------- | -------------------------------- |
| `pulso-app` | HTTPS · `taller.tudominio.com` · puerto 443 | HTTP · `localhost` · puerto 8080 |
| `pulso-api` | HTTPS · `api.tudominio.com` · puerto 443    | HTTP · `localhost` · puerto 3210 |

En la regla **`pulso-api`**, entra en **Encabezado personalizado** y marca
**WebSocket**. Sin eso la app carga pero no recibe datos: la conexión en vivo se
queda reintentando y el taller parece vacío.

**El certificado.** Panel de control → **Seguridad → Certificado → Añadir → Obtener
un certificado de Let's Encrypt**, con los dos nombres. Después, en esa misma
pantalla, **Configuración**: elige el certificado para `taller.tudominio.com` y
para `api.tudominio.com` (si son dos certificados, se asigna uno a cada nombre).

**El cortafuegos.** Panel de control → Seguridad → **Cortafuegos**: permite el 443
(y el 80 mientras Let's Encrypt valida el dominio; después se puede cerrar). El
8080, el 3210 y el 6791 no se abren hacia fuera: se quedan en el NAS.

**Comprobación rápida** de que la API está publicada, antes de tocar la app:

```bash
curl -sS https://api.tudominio.com/version
```

Tiene que contestar algo (puede ser literalmente `unknown`: lo que importa es que
responde y no da un error). Si esto falla, el problema está en el DNS, en el proxy
o en el certificado, no en la app.

## Paso 7 — Comprobar que funciona

1. `https://taller.tudominio.com` carga la presentación.
2. `https://taller.tudominio.com/auth` → pestaña **Contraseña** → botón **«Usar
   credenciales»** → en el taller entra con `admin@taller.es` / `admin12345`
   (la cuenta de administrador **se crea sola** la primera vez que se entra).
3. Dentro, el panel del taller carga con sus módulos. Si tienes la consola del
   navegador abierta verás una petición `api/sync` en **101 Switching Protocols**:
   eso es la conexión en vivo. Si se queda «pendiente», revisa el WebSocket de la
   regla `pulso-api` (paso 6).
4. El panel de Convex abre en `http://IP-del-NAS:6791` (desde la red local) y se
   entra con la clave de administrador del paso 5: ahí se miran los datos, los
   registros y las variables del deployment.
5. Prueba un adjunto: sube un manual o añade una foto a una incidencia. Si se
   sube pero no se ve, el `CONVEX_CLOUD_ORIGIN` del `.env` no es la dirección
   pública (las direcciones de los archivos se construyen con él).
6. Para una demo, el panel del taller trae **«Más datos de ejemplo»**: rellena el
   inventario, las incidencias y las peticiones de muestra.

## Los datos y las copias de seguridad

Todo el estado —base de datos, archivos y funciones desplegadas— vive en el
volumen `datos` del proyecto, que Compose renombra con el nombre del proyecto:

```bash
sudo docker volume ls | grep pulso
# pulso-taller_datos
```

**Copia lógica** (la que se recomienda: se puede volver a cargar en cualquier
instalación, también en la nube). Se hace desde el ordenador, con la dirección
pública de la API y la clave de administrador del `.env` del NAS:

```bash
export CONVEX_SELF_HOSTED_URL=https://api.tudominio.com
export CONVEX_SELF_HOSTED_ADMIN_KEY='pulso-taller|01ab…'
npx convex export --include-file-storage --path respaldo-pulso.zip
```

(El `|` de la clave va entre comillas: si no, la shell se queda con lo de
después. Y las dos variables, en el mismo terminal, antes de cada orden.)

Y para devolverla a un deployment:

```bash
npx convex import respaldo-pulso.zip
```

**Copia del volumen** (la copia «en frío», sin lógica de por medio): con el
backend parado, para que no haya nada a medias.

```bash
cd /volume1/docker/pulso-taller
sudo docker compose stop backend
sudo mkdir -p /volume1/docker/respaldos
sudo docker run --rm -v pulso-taller_datos:/datos \
  -v /volume1/docker/respaldos:/respaldo alpine \
  tar czf /respaldo/convex-$(date +%F).tar.gz -C /datos .
sudo docker compose start backend
```

## Actualizar

Recuerda que todo esto lo hace solo `npm run nas -- --host IP-del-NAS` desde el
ordenador: lleva el código y reconstruye. A mano, es lo que sigue.

- **La app** (lo que se ve y sus textos): vuelve a llevar el código al NAS
  (paso 3) y recompila el proyecto —**Container Manager → Project → Build**, o
  `sudo docker compose up -d --build`—. El sitio va dentro de la imagen, así que
  hasta que no se recompila no cambia; y como la imagen se sustituye entera, no
  quedan restos de la versión anterior mezclados con la nueva.
- **Las funciones** (lo que hay en `src/convex/`): vuelve a llevar el código al
  NAS (paso 3) y arranca **solo** ese contenedor, que es el que las sube. Hay que
  recompilar su imagen —el código va dentro—, y no hace falta tocar la app: el
  sitio no cambia por tocar una función.

  ```bash
  cd /volume1/docker/pulso-taller
  sudo docker compose up -d --build funciones
  ```

  Sube y se para, como en el primer arranque. Los datos no se tocan. Desde
  Container Manager, **Project → Build** reconstruye las dos imágenes y luego basta
  con arrancar el proyecto: más lento, pero igual de correcto.

- **Los contenedores** (backend y panel): cuando quieras traer una versión nueva
  de las imágenes,

  ```bash
  cd /volume1/docker/pulso-taller
  sudo docker compose pull
  sudo docker compose up -d
  ```

  Los datos están en el volumen y sobreviven. Si prefieres que no se muevan solos,
  fija una versión en el compose (`ghcr.io/get-convex/convex-backend:<versión>`) y
  súbela cuando te venga bien.

## Sin dominio: solo red local

Si el taller no sale de casa, se puede montar sin dominio, sin proxy inverso y sin
certificado. Son tres cambios:

1. En `.env`, la dirección local: `CONVEX_CLOUD_ORIGIN=http://IP-del-NAS:3210`.
   (`npm run nas` no pisa un `.env` que ya esté, así que este cambio se queda.)
2. Deja **IP fija** al NAS (reserva en el router) o la app dejará de encontrar la
   API el día que cambie. De la dirección se encarga el propio `.env`: la app se
   compila con ese mismo valor, así que no hay nada más que ajustar.
3. Publica los puertos en la red local en lugar de solo en el NAS: en el
   `docker-compose.yml`, cambia `"127.0.0.1:8080:80"` por `"8080:80"` y
   `"127.0.0.1:3210:3210"` por `"3210:3210"` (los comentarios del archivo lo
   señalan), y permite 8080 y 3210 desde la red local en el cortafuegos de DSM.

El contenedor `funciones` sube a esa misma dirección (`CONVEX_CLOUD_ORIGIN`), así
que la IP del NAS tiene que valer también desde dentro; con la IP fija que pide el
apartado anterior, así es. Y sin dominio no hay `SITE_URL` pública que apuntar: se
pone `http://IP-del-NAS:8080`, que es donde entra quien usa la app.

Se entra entonces en `http://IP-del-NAS:8080`. Dos apuntes honestos: por HTTP el
navegador no considera el sitio «seguro» (el portapapeles y otras API del
navegador solo funcionan en `https://` o en `localhost`), y `api.tudominio.com` no
se usa para nada —el WebSocket va directo al 3210—, así que ese puerto tiene que
quedar abierto en la red.

## Qué no funciona aquí

Es lo mismo que no funciona en el entorno local, por la misma razón: son piezas
que dependen del proyecto original en la nube.

- **Entrar con código por email (OTP)**: `emailOtp.ts` manda los códigos por la
  pasarela de integraciones de freebuff y necesita `VLY_INTEGRATION_KEY`. Usa
  contraseña o el acceso como invitado.
- **El correo del resumen semanal**: se envía por esa misma pasarela, así que
  queda apuntado en los registros y no sale. El resumen se sigue pudiendo
  descargar a mano desde el panel del taller.
- **La barra flotante de Freebuff** y el envío de errores a su panel.

Todo lo demás —incidencias, peticiones, almacén, manuales, archivado automático y
limpiezas de madrugada (que son tareas del propio backend)— funciona igual.

## Problemas frecuentes

**La app carga, pero no llega ningún dato (o se queda «cargando»).**
Es casi siempre el WebSocket. Mira en la consola del navegador la petición
`api/sync`: si no pone `101 Switching Protocols`, entra en la regla `pulso-api`
del proxy inverso y marca **WebSocket** en Encabezado personalizado. Y comprueba
que la API responde: `curl -sS https://api.tudominio.com/version`.

**El contenedor `funciones` sale con un aviso y se para.**
Es lo que pasa cuando le falta la clave de administrador en el `.env` (la primera
vez, antes del paso 5) o cuando la que hay no es la de esta instancia: lo dice con
esas palabras en `sudo docker compose logs funciones`. Al copiarla, cuidado con el
pico `|` que lleva en medio: en un `bash` va entre comillas, o la shell se queda
con lo de después. Puesta la clave, `sudo docker compose up -d funciones` y ya no
sale más.

**Entro y me devuelve a `/auth` en bucle.**
Faltan variables del deployment, o el esquema y las funciones no llegaron a
subirse. Mira las últimas líneas de `sudo docker compose logs funciones` (el
despliegue no entra si la configuración de auth pide una variable que no está
puesta, y lo dice con estas palabras: «Environment variable
VLY_CONVEX_AUTH_ISSUER is used in auth config file but its value was not set»).
Arreglarlo suele ser poner lo que falte en el `.env` —el caso normal es
`CONVEX_ADMIN_KEY`— y volver a arrancar el contenedor. Para ver qué tiene ahora el
deployment, y de paso comprobar que la clave vale:

```bash
sudo docker compose exec backend \
  curl -sS http://127.0.0.1:3211/.well-known/openid-configuration
```

Esa es la dirección con la que el backend valida sus propias sesiones: si no
devuelve el documento de configuración, el problema está ahí.

**«port is already allocated».**
Otro servicio de DSM o de otro contenedor tiene el 8080, el 3210 o el 6791. Mira
quién es y cambia el puerto **en el compose y en la regla del proxy** (o libera el
puerto). En el NAS: `sudo netstat -tulpn | grep 8080`.

**La construcción de la app se queda sin memoria o sin espacio.**
Compilar el sitio pide su momento: alrededor de un giga de memoria libre y un par
de gigas de disco para la imagen. Por SSH, con la salida a la vista, se ve dónde
se atasca:

```bash
cd /volume1/docker/pulso-taller
sudo docker compose build app
```

Si el NAS no puede con ello, la imagen se puede construir en el ordenador y
llevarla ya hecha; para eso hay que quitar el bloque `build:` del servicio `app`
del `docker-compose.yml`, que pasará a usar la imagen que se le cargue:

```bash
docker build -f docker/synology/Dockerfile \
  --build-arg VITE_CONVEX_URL=https://api.tudominio.com -t pulso-taller-app:local .
docker save pulso-taller-app:local | ssh admin@IP-del-NAS 'docker load'
```

El contenedor de las funciones también se construye en el NAS, pero pide mucho
menos —no compila el sitio—; si aun así hiciera falta, se construye igual desde el
ordenador y se quita su bloque `build:`:

```bash
docker build -f docker/synology/Dockerfile --target funciones \
  -t pulso-taller-funciones:local .
docker save pulso-taller-funciones:local | ssh admin@IP-del-NAS 'docker load'
```

Sin `--target`, esa misma orden construye la aplicación: la última fase del
`Dockerfile` es la de nginx a propósito.

**Los adjuntos se suben pero no se abren.**
El `CONVEX_CLOUD_ORIGIN` del `.env` no es la dirección desde la que se usa la app.
Cámbialo y `sudo docker compose up -d --build` (volver a levantar el backend con
otra dirección no toca los datos). El `--build` hace falta porque esa misma
dirección va grabada dentro de la app: sin recompilar, la app seguiría llamando
al sitio de antes.

**«Me he quedado fuera» / quiero otra clave de administrador.**
La clave la firma el backend con el `INSTANCE_SECRET`, así que se puede volver a
pedir tantas veces como haga falta, y las anteriores siguen valiendo:

```bash
sudo docker compose exec backend ./generate_admin_key.sh | tail -1
```

Al cambiarla hay que actualizarla también en el `.env` (`CONVEX_ADMIN_KEY`), que es
la que usa el contenedor `funciones` para desplegar. Si lo que se ha perdido es el
secreto, no hay vuelta atrás: sin él no se firman claves de administrador nuevas.

**El panel de Convex no abre desde mi ordenador.**
Se sirve solo en la red local (`http://IP-del-NAS:6791`) y, además, el navegador
tiene que poder llegar a `api.tudominio.com` (es lo que el panel usa para hablar
con la API). Si el DNS aún no está puesto, déjalo para después de configurar el
proxy inverso.

**He tocado el `INSTANCE_SECRET` y ya nadie entra.**
Al rotarlo se invalidan las claves de administrador y las sesiones: hay que sacar
una clave nueva —como en el apartado «Me he quedado fuera»—, actualizar
`CONVEX_ADMIN_KEY` en el `.env`, arrancar el proyecto y volver a entrar en la app.
Los datos siguen ahí.
