# Pulso Taller en un servidor Proxmox

Cómo dejar el taller corriendo en un servidor propio con **Proxmox VE**, con la
aplicación, la base de datos y los archivos viviendo dentro de casa o del taller
(y sin depender de nada que no sea tuyo). Es el mismo montaje que el del NAS
Synology —tres contenedores que se quedan, uno que pasa— pero sobre una **máquina
virtual Debian** dentro de Proxmox, con **Caddy** delante poniendo el HTTPS que en
el Synology pone DSM.

> La guía del NAS Synology está en **[SYNOLOGY.md](./SYNOLOGY.md)**: si esa es
> tu plataforma, ahí está todo; los contenedores son los mismos en las dos.

Antes de empezar, una decisión: ¿VM o contenedor LXC? Se puede hacer de las
dos formas, y no son lo mismo:

|                        | VM Debian (recomendado)    | LXC                                    |
| ---------------------- | -------------------------- | -------------------------------------- |
| Kernel del host        | Propio (aislado)           | Comparte el kernel de Proxmox          |
| Docker                 | Funciona sin nada especial | Necesita `nesting=1` y `keyctl=1`      |
| Migraciones de Proxmox | En vivo (si hay clúster)   | Más rápido, pero con menos aislamiento |
| Complejidad            | Menos piezas               | Menos recursos (RAM sobre todo)        |

La recomendación es la **VM**: es la que menos sorpresas da, y el taller no pide
máquina —con **2 GB de RAM** y **20 GB** de disco llega de sobra; para tener
margen, 4 GB y 40 GB—. Si aún así eliges LXC (vale, ahorra memoria), los
ajustes de `nesting` y `keyctl` están contados más abajo, en el apartado
[«Si lo montas en un LXC»](#si-lo-montas-en-un-lxc).

En lo que sigue, «el servidor» es esa VM Debian (o el LXC ajustado).

## Lo que hace falta

- **Proxmox VE 8** o más nuevo, con una **VM Debian 12 o 13** creada en él (paso
  1). En el LXC es la variante contada aparte.
- **SSH hacia el servidor** desde el ordenador donde tienes el proyecto clonado,
  igual que en la guía del NAS: casi todo se hace por ahí.
- **Un dominio** con dos subdominios (`taller.` y `api.`) apuntando a la
  dirección del servidor. Al final está la variante sin dominio, solo red local.
- Un **puerto 80 y 443 libres** en el servidor: los pide Caddy para el
  certificado de Let's Encrypt. Si los tiene otro servicio, se mueve ese o se
  usa la variante sin dominio.

Y, como en el Synology, **el mismo proyecto**: el `docker-compose.yml` es el de
`docker/synology/docker-compose.yml` **sin cambiarlo** — los nombres de los
contenedores y el volumen son los mismos que la guía del NAS, y la misma imagen
de la app se construye en el servidor. Solo cambia delante: en vez del proxy
inverso de DSM, Caddy.

## Todo de una vez: `npm run nas`

El script de puesta en marcha del repositorio (`npm run nas`) **sirve tal cual
para el Proxmox**: habla por SSH con un Linux cualquiera y no sabe ni le importa
si lo que hay detrás es un NAS o una VM. Lo único que asume es que el usuario
con el que entra puede usar `sudo` —y, en una VM Debian recién creada, lo normal
es entrar como `root`, con lo que no hace falta que exista `sudo` (el guion que
se ejecuta dentro valora si puede) —.

```bash
npm run nas -- --host IP-del-servidor \
  --user root \
  --app-url https://taller.tudominio.com \
  --api-url https://api.tudominio.com
```

Lleva el código, escribe el `.env` si falta, genera el secreto de la instancia,
construye las imágenes dentro del servidor, arranca el backend, pide la clave de
administrador y espera a que el contenedor `funciones` suba el esquema y las
funciones. Termina con la URL de la app en la última línea, igual que en el NAS.
Y es idempotente: se puede repetir sin miedo, porque nunca pisa un `.env` que ya
esté ni rota el secreto de la instancia —rotarlo dejaría fuera a quien esté
dentro—.

Opciones útiles con la misma semántica que en el NAS: `--path` (si el proyecto
no vive en `/volume1/docker/pulso-taller`; en una VM Debian lo normal es
`/root/pulso-taller` o `/srv/pulso-taller`), `--force-compose`, `--new-key` y
`--no-build`. Si el usuario de SSH no es `root` y no puede ejecutar `sudo` sin
contraseña, el guion de dentro lo dirá: créale una (`usermod -aG sudo usuario`
en Debian, en `/etc/sudoers` con `NOPASSWD` si se quiere desatendido) o haz los
pasos a mano, que es lo que sigue.

Nota: el path por defecto del script es el del NAS
(`/volume1/docker/pulso-taller`), que en Debian no existe; pásale `--path` con
la ruta que quieras usar. Los pasos a mano de este documento usan
`/srv/pulso-taller`.

## Paso 1 — La VM Debian en Proxmox

Con el ratón, en la web de Proxmox: **Create VM** → y en la pestaña **Options**
(esto es lo que importa de verdad):

| Ajuste          | Valor                   | Por qué                                                       |
| --------------- | ----------------------- | ------------------------------------------------------------- |
| Guest OS        | Linux 6.x - 2.6 Kernel  | Debian 12/13.                                                 |
| BIOS            | **OVMF (UEFI)**         | Más moderno, sin tunear GRUB después.                         |
| Machine         | **q35**                 | Va con el UEFI.                                               |
| EFI Storage     | El almacenamiento local | Lo que pide el UEFI.                                          |
| SCSI Controller | **VirtIO SCSI single**  | El disco, rápido y bien soportado.                            |
| Cores           | 2                       | Suficiente para recompilar la app de vez en cuando.           |
| Memory          | **4096**                | Menos de eso, compilar la app dentro de la VM es un calvario. |
| Network         | VirtIO                  | Paravirtualizada, la más rápida.                              |
| Discard / Trim  | Activado                | Devuelve al almacenamiento lo que libera.                     |

**El disco** es lo que más se olvida: dale **«Discard»** y «Thin Provisioning»
para que el fichero de la VM no crezca y no se contraiga según se use. Para el
taller, **32 GB** van sobrados (los datos viven en un volumen Docker dentro, y
el backend de Convex guarda los archivos ahí mismo).

Para instalar Debian: descarga la ISO netinst de Debian 12 o 13 desde
`debian.org`, súbela a Proxmox (local → ISO Images) y arranca la VM desde ella.
En el instalador:

- **Sin escritorio**: solo **SSH server** y **standard system utilities**. Con
  entorno gráfico no hay nada que ganar en una VM de Proxmox.
- **Particionado**: todo el disco, como viene por defecto (LVM si lo pide, no
  importa cuál). Es una VM monolítica: no hace falta `/home` aparte.
- **Usuario**: el que quieras usar por SSH. Si va a ser `root` con contraseña,
  dejare `root` con contraseña en el paso «Set up users and passwords» de la
  GUI de instalación de Debian (así `root` tiene contraseña para SSH y
  `sudo` no es siquiera necesario).

Cuando termine la instalación y la VM arranque, **comprueba desde tu ordenador
que puedes entrar por SSH** antes de seguir, porque todo lo demás va por ahí:

```bash
ssh root@IP-del-servidor
```

## Paso 2 — Docker y Caddy en el servidor

Dentro de la VM (o del LXC), como `root` (o con `sudo` delante si tu usuario no
lo es):

### Docker Engine y Compose

La instalación recomendada es la del **repositorio oficial de Docker** —no el
paquete `docker.io` de Debian, que va por detrás—:

```bash
apt update && apt install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg \
  -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: $(. /etc/os-release && echo "$VERSION_CODENAME")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

apt update
apt install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
```

Para comprobar que quedó bien, antes de seguir:

```bash
docker compose version
```

Y, si quieres ver Docker funcionando en su estado más puro,
`docker run --rm hello-world`. No es obligatorio; vale con `docker compose
version` contestando con un número.

### Caddy (el HTTPS)

Caddy es el que en el Synology hace el proxy inverso de DSM: recibe el tráfico
de `taller.` y `api.` por 443, saca el certificado de Let's Encrypt y lo
renueva solo, sin nada que configurar a mano.

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  -o /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
systemctl enable --now caddy
```

Caddy lee su configuración de **`/etc/caddy/Caddyfile`**; se escribirá en el
paso 4.

## Paso 3 — La carpeta del proyecto y el código

En el servidor:

```bash
mkdir -p /srv/pulso-taller/codigo
```

Y desde el ordenador, con el proyecto clonado (lo mismo que en el paso 3 de la
guía del NAS):

```bash
tar --exclude=node_modules --exclude=dist --exclude=.env.local -czf - . \
  | ssh root@IP-del-servidor \
      'rm -rf /srv/pulso-taller/codigo && mkdir -p /srv/pulso-taller/codigo && tar xzf - -C /srv/pulso-taller/codigo'
```

Y el compose y la plantilla del `.env`:

```bash
scp docker/synology/docker-compose.yml docker/synology/.env.example \
    root@IP-del-servidor:/srv/pulso-taller/
mv /srv/pulso-taller/.env.example /srv/pulso-taller/.env  # en el propio servidor
```

> El `.env.example` llega como tal para que sea evidente qué es: en el
> servidor, con `mv` (o con un editor) se convierte en `.env`, que es lo que
> lee Compose. No lo renombres en tu ordenador, que no acaba en el repositorio
> por un motivo.

## Paso 4 — El `.env` y el Caddyfile

**El `.env`** es el mismo que en el NAS, con las mismas cinco líneas —el
archivo que has copiado ya lo trae bien explicado—:

```text
INSTANCE_NAME=pulso-taller
INSTANCE_SECRET=<32 bytes en hexadecimal>
CONVEX_CLOUD_ORIGIN=https://api.tudominio.com
SITE_URL=https://taller.tudominio.com
CONVEX_ADMIN_KEY=
```

El secreto se genera una vez, en el servidor:

```bash
openssl rand -hex 32
```

Y **no se cambia nunca**: al rotarlo dejan de valer las claves de administrador
y todas las sesiones abiertas. Cópialo donde guardes las contraseñas del
taller. `CONVEX_ADMIN_KEY` queda **vacía**: la firma el backend con el secreto
de la instancia y se pide en el paso 5, cuando esté en marcha.

**El Caddyfile** deja dos bloques: el de la app y el de la API. Con la
diferencia de que el de la API activa el WebSocket (es donde la app abre su
conexión en vivo, la petición `api/sync` que tiene que acabar en «101
Switching Protocols»):

```text
taller.tudominio.com {
    reverse_proxy localhost:8080
}

api.tudominio.com {
    reverse_proxy localhost:3210
}
```

Y nada más: **el WebSocket no hace falta activarlo** como en el proxy inverso
DSM — Caddy lo activa por defecto para todo el tráfico de `reverse_proxy`, que
es justo lo que la app necesita para su conexión en vivo.

Copia ese texto (con tus dominios) a `/etc/caddy/Caddyfile` y recarga:

```bash
systemctl reload caddy
```

A los pocos segundos Caddy contesta con el certificado de Let's Encrypt ya
puesto y, a partir de ahí, `https://taller.tudominio.com` es accesible (aunque
la app aún no esté en marcha, se ve la página de error de nginx hasta que
levantes los contenedores).

**El cortafuegos**, si es que lo hay — una VM Debian recién instalada no trae
uno activado —: deja entrar 22, 80 y 443; nada más. **No
publiques a internet** el 3210 (la API sin HTTPS), el 6791 (el panel de Convex,
que va por HTTP sin credenciales propias más allá de la clave) ni el 8080: son
de dentro. Si vas a usar la variante sin dominio, esos tres puertos sí se
publican en la red local (apartado final).

## Paso 5 — Arrancar los contenedores y la clave del backend

En el servidor:

```bash
cd /srv/pulso-taller
docker compose up -d --build
```

> La primera vez tarda: el servidor **compila la app dentro de su imagen**
> (Node y npm van dentro del `Dockerfile`, no hay que instalar nada más en el
> servidor). Son unos minutos, mirables con `docker compose logs -f` o
> directamente esperando; en la guía del NAS se llama «Build Details»
> porque Container Manager lo enseña con una barra; aquí, la terminal.

El contenedor `funciones` saldrá **parado con un aviso** —le falta la clave de
administrador—. Es lo esperado la primera vez. Pídesela al backend:

```bash
docker compose exec backend ./generate_admin_key.sh | tail -1
```

Imprime una línea tipo `pulso-taller|01ab…`. Pégala en el `.env`, en la línea
`CONVEX_ADMIN_KEY=`, y vuelve a levantar:

```bash
docker compose up -d --build
```

El contenedor `funciones` sube el esquema y las funciones y **se para con
`exited (0)`** —ha hecho su recado—. Su última línea, en `docker compose logs
funciones`, es «listo: el esquema y las funciones están al día». Si sale con
error, lo dice con palabras; el apartado de **Problemas frecuentes** está al
final, y es el mismo catálogo que el de la guía del NAS (los motivos son los
mismos: la clave, las variables de auth o el WebSocket).

## Paso 6 — Comprobar que funciona

1. `https://taller.tudominio.com` carga la presentación.
2. `https://taller.tudominio.com/auth` → pestaña **Contraseña** → botón **«Usar
   credenciales»** → en el taller entra con `admin@taller.es` / `admin12345`
   (la cuenta de administrador se crea sola la primera vez que se entra).
3. Dentro, el panel del taller carga con sus módulos, y en la consola del
   navegador la petición `api/sync` acaba en **101 Switching Protocols** (es la
   conexión en vivo por el WebSocket). Si se queda «pendiente», es el
   Caddyfile: comprueba que `api.` está en él con su `reverse_proxy` al 3210.
4. El panel de administración de Convex abre en `http://IP-servidor:6791` (desde
   la red local) con la clave de administrador del paso 5.
5. Prueba un adjunto: sube un manual o una foto. Si se sube pero no se ve, es
   el `CONVEX_CLOUD_ORIGIN` del `.env` (las direcciones de los archivos se
   construyen con él).
6. Para una demo, el panel del taller trae **«Más datos de ejemplo»**.

## Los datos y las copias de seguridad

Todo el estado va en el volumen Docker `pulso-taller_datos`, igual que en el
NAS, y las dos copias de la guía del NAS valen igual:

**Copia lógica** (desde el ordenador, con la dirección pública y la clave de
administrador):

```bash
export CONVEX_SELF_HOSTED_URL=https://api.tudominio.com
export CONVEX_SELF_HOSTED_ADMIN_KEY='pulso-taller|01ab…'
npx convex export --include-file-storage --path respaldo-pulso.zip
```

**Copia del volumen** (con el backend parado):

```bash
cd /srv/pulso-taller
docker compose stop backend
mkdir -p /srv/respaldos
docker run --rm -v pulso-taller_datos:/datos -v /srv/respaldos:/respaldo alpine \
  tar czf /respaldo/convex-$(date +%F).tar.gz -C /datos .
docker compose start backend
```

(Como `root` en la VM no hacen falta los `sudo` que lleva la guía del NAS.) Y,
si el servidor es una VM, hay una tercera copia que el NAS no puede soñar:
**la snapshot de la propia VM desde Proxmox**, con el taller parado o sin
pararlo —es una copia «en frío» instantánea del servidor entero—. Para eso:

```bash
qm snapshot <vmid> pulso-taller-$(date +%F) --description "Copia del taller"
```

La base de la seguridad sigue siendo la copia lógica: te saca los datos a un
zip que se puede devolver a cualquier instalación —esta o la nube—.

## Actualizar

Recuerda que todo esto lo hace `npm run nas -- --host IP-del-servidor --user
root` desde el ordenador (se puede repetir, y es idempotente). A mano:

- **La app** (lo que se ve y sus textos): lleva el código otra vez (paso 3) y
  `docker compose up -d --build`. El sitio va dentro de la imagen, así que
  hasta que no se recompila no cambia; y la imagen se sustituye entera, sin
  restos de la versión anterior.
- **Las funciones** (lo que hay en `src/convex/`): lleva el código y arranca
  **solo** ese contenedor, que es el que las sube:

  ```bash
  cd /srv/pulso-taller
  docker compose up -d --build funciones
  ```

  Sube y se para, como en el primer arranque. Los datos no se tocan.

- **Los contenedores** (backend y panel): cuando quieras traer una versión
  nueva de las imágenes de Convex:

  ```bash
  docker compose pull && docker compose up -d
  ```

  Los datos están en el volumen y sobreviven.

**Y las piezas del servidor que no son del taller** también se mantienen, y no
se tocan solas:

- **Debian**: `apt update && apt full-upgrade` de vez en cuando, y —muy
  aconsejable— **updates desatendidos** para los parches de seguridad:

  ```bash
  apt install -y unattended-upgrades
  dpkg-reconfigure -plow unattended-upgrades
  ```

- **Proxmox**: las actualizaciones del hipervisor van por su web (node -> shell
  → `apt update && apt full-upgrade` en el propio nodo), fuera del alcance de
  esta guía. Lo que sí conviene reflejar aquí: **un reinicio de la VM no toca
  nada del taller** — Compose tiene `restart: unless-stopped` en los tres
  contenedores que se quedan, y `restart: "no"` en `funciones` porque su
  trabajo es subir y pararse—. Cuando la VM vuelva, el taller está corriendo
  solo.

- **Caddy**: lo renueva la instalación del paquete. No hay nada que hacer.

## Sin dominio: solo red local

Como en el Synology, tres cambios:

1. `.env`: `CONVEX_CLOUD_ORIGIN=http://IP-del-servidor:3210` y
   `SITE_URL=http://IP-del-servidor:8080`.
2. **IP fija** o reserva DHCP en el router: la dirección va grabada dentro de
   la app compilada, y cambiarla es recompilar.
3. Publicar los puertos en la red local: en el `docker-compose.yml`, cambia
   `"127.0.0.1:8080:80"` por `"8080:80"` y `"127.0.0.1:3210:3210"` por
   `"3210:3210"`. El 6791 si quieres el panel desde otro equipo de la red.

Y en el **Caddyfile**, no: con dominio no hace falta y sin dominio tampoco —
cada puerto sale directo—. Se entra en `http://IP-del-servidor:8080`. Dos
apuntes honestos, los mismos de la guía del NAS: por HTTP el navegador no
considera el sitio «seguro» (el portapapeles y otras API del navegador solo
funcionan en `https://` o `localhost`), y `api.` no se usa para nada.

## Si lo montas en un LXC

Ahorra memoria (el contenedor no lleva el kernel de una VM), pero tienes que
saber lo que estás eligiendo: **comparte el kernel del host Proxmox** y Docker
dentro necesita dos ajustes en el contenedor. Se ponen en la web de Proxmox, en
el contenedor → **Options → Features**:

| Option    | Valor | Para qué                                                            |
| --------- | ----- | ------------------------------------------------------------------- |
| `nesting` | 1     | Contenedores dentro del contenedor (es lo que Docker necesita).     |
| `keyctl`  | 1     | El llavero de claves del kernel, que Docker usa para sus volúmenes. |

Por línea de órdenes:

```bash
pct set 100 --features nesting=1,keyctl=1
```

(sustituye `100` por el ID real de tu contenedor), y después **reinícialo**.
Con eso Docker funciona. Dos cautelas que vienen de la documentación de
Proxmox: `nesting` expone algo del `procfs`/`sysfs` del host al contenedor, y
un LXC privilegiado lo empeora —usa contenedor **no privilegiado**—. El resto
de esta guía vale igual: hay que instalar Docker y Caddy dentro, igual que en
la VM, e instalar Debian desde la plantilla LXC de Proxmox es desde
**local → CT Templates**.

## Qué no funciona aquí

Es lo mismo que no funciona en el entorno local ni en el Synology, por la misma
razón: son piezas que dependen del proyecto original en la nube.

- **Entrar con código por email (OTP)**: manda los códigos por la pasarela de
  integraciones y necesita `VLY_INTEGRATION_KEY`. Usa contraseña o el acceso
  como invitado.
- **El correo del resumen semanal**: se envía por esa misma pasarela, así que
  queda apuntado en los registros y no sale. El resumen se sigue pudiendo
  descargar a mano desde el panel del taller.
- **La barra flotante de Freebuff** y el envío de errores a su panel.

Todo lo demás —incidencias, peticiones, almacén, manuales, archivado automático
y limpiezas de madrugada (tareas del propio backend)— funciona igual.

## Problemas frecuentes

**La app carga, pero no llega ningún dato (o se queda «cargando»).**
Es el WebSocket, como en el NAS. Mira en la consola del navegador la petición
`api/sync`: si no pone `101 Switching Protocols`, revisa el Caddyfile —el bloque
de `api.` debe apuntar a `localhost:3210`— y recarga (`systemctl reload
caddy`). Y comprueba que la API responde: `curl -sS
https://api.tudominio.com/version`.

**El certificado no llega.** Caddy lo pide a Let's Encrypt, y Let's Encrypt ha
de poder **llegar a tu servidor por el 80** — la validación HTTP-01 va por ahí.
Si el 80 está cerrado en el cortafuegos o el registro DNS de `api.` no apunta a
la dirección pública de la VM, el certificado no se emite y `curl https://api./
version` se queda en un error de TLS. En los registros lo dice:
`journalctl -u caddy -f` mientras lo intenta de nuevo.

**El contenedor `funciones` sale con un aviso y se para.**
Le falta la clave de administrador (la primera vez, antes del paso 5) o la que
hay no es la de esta instancia: lo dice con esas palabras en `docker compose
logs funciones`. Al copiarla, cuidado con el pico `|` que lleva en medio: en
`bash` va entre comillas. Puesta la clave, `docker compose up -d funciones`.

**Entro y me devuelve a `/auth` en bucle.**
Faltan variables del deployment, o el esquema y las funciones no llegaron a
subirse —mira `docker compose logs funciones`, y si el motivo es «Environment
variable VLY_CONVEX_AUTH_ISSUER is used in auth config file but its value was
not set», es que falta algo en el `.env` del servidor—. Para ver si el
deployment contesta:

```bash
docker compose exec backend curl -sS http://127.0.0.1:3211/.well-known/openid-configuration
```

**«port is already allocated».** Otro servicio tiene el 8080, el 3210 o el 6791. Mira quién es (`ss -tulpn | grep 8080`) y cambia el puerto en el compose
(y en el Caddyfile, si es la app).

**La construcción se queda sin memoria o sin espacio.** Se ve en la terminal:

```bash
cd /srv/pulso-taller
docker compose build app
```

Compilar el sitio pide alrededor de un giga de memoria libre. Si la VM corta,
dale más RAM **en caliente** (Proxmox lo permite con balloon o parando) o
construye en el ordenador y lleva la imagen hecha, como en el apartado del mismo
nombre de la guía del NAS (`docker save`, `ssh … 'docker load'`).

**Los adjuntos se suben pero no se abren.**
El `CONVEX_CLOUD_ORIGIN` del `.env` no es la dirección desde la que se usa la
app. Cámbialo y `docker compose up -d --build` (la dirección va grabada dentro
de la app compilada: sin recompilar, seguiría llamando al sitio de antes).

**«Me he quedado fuera» / quiero otra clave.**
La clave la firma el backend con el `INSTANCE_SECRET`:

```bash
docker compose exec backend ./generate_admin_key.sh | tail -1
```

Pégala también en el `.env` del servidor (`CONVEX_ADMIN_KEY`) y arranca el
proyecto. Si lo que se ha perdido es el secreto de la instancia, no hay vuelta
atrás: sin él no se firman claves nuevas.

**El panel de Convex no abre desde mi ordenador.**
Solo escucha en la propia máquina (`http://IP-servidor:6791` desde tu red
local) y, además, el navegador tiene que poder llegar a `api.tudominio.com`:
es lo que el panel usa para hablar con la API. Si el DNS aún no está, déjalo
para después de configurar el HTTPS.
