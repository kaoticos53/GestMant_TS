# El relevo de correo

El taller manda sus correos —el aviso a quien notificó una incidencia, el aviso
interno de una incidencia nueva y el resumen semanal— desde el backend de Convex.
Pero el backend **no abre conexiones TCP**, así que no puede hablar SMTP con el
servidor de correo de la casa.

Para eso está el relevo: un puente pequeño HTTP → SMTP que se instala al lado del
backend. Recibe el sobre —de, para, copia oculta, asunto, texto y HTML— y lo
entrega al servidor de correo. Es la opción **«Relevo propio»** de _Ajustes del
taller → Servidor de correo_, y también el camino por el que salen **«Gmail
(Google)»** y **«Ethereal (pruebas)»**: esos dos no tienen API propia, así que el
sobre lleva además su servidor, su cuenta y su contraseña, y el relevo entrega
por ahí esa vez (apartado 4).

Está en [scripts/mail-relay.mjs](./scripts/mail-relay.mjs) —el arranque— y
[scripts/mail-relay-lib.mjs](./scripts/mail-relay-lib.mjs) —el protocolo, el
mensaje y el servidor—. No usa ninguna librería de correo: `node:http`,
`node:net`, `node:tls` y SMTP a mano.

---

## 1. Qué necesitas

- **Un servidor SMTP** al que el taller pueda entregar: el propio (Postfix,
  Exchange, el del NAS…) o el de un proveedor (Resend, SendGrid, Mailgun, Brevo,
  el que sea, por su puerta SMTP).
- **Su dirección, su puerto y, si los pide, sus credenciales.**
- Node 20 o superior (el mismo que ya hace falta para `npm run dev`).

No hace falta ninguna dependencia nueva: `npm install` no cambia.

---

## 2. Arrancarlo en el ordenador

Con el backend en marcha (`npm start`), en otra terminal:

```bash
SMTP_HOST=correo.tudominio.com \
SMTP_PORT=587 \
SMTP_USER=avisos@tudominio.com \
SMTP_PASS=la-clave \
MAIL_RELAY_TOKEN=un-testigo-largo \
npm run mail:relay
```

Si prefieres no repetir las variables, déjalas en un `.env` del sistema o en el
de tu shell; el relevo lee el entorno, no un archivo propio.

Al arrancar dice por dónde escucha y a qué servidor entrega, **sin imprimir la
contraseña ni el testigo**:

```
Relevo de correo escuchando en http://127.0.0.1:8788/enviar (0.0.0.0)
Entrega por SMTP en correo.tudominio.com:587 (STARTTLS si el servidor lo ofrece).
Testigo activado: el backend tiene que mandar el mismo MAIL_RELAY_TOKEN.
Comprobación de correo.tudominio.com:587: conexión y autenticación correctas (STARTTLS si el servidor lo ofrece, AUTH PLAIN).
```

Esa última línea es la **comprobación previa**: conecta, se autentica y corta, sin
mandar ningún correo (apartado 5). Si falla, el relevo sigue escuchando y deja el
motivo escrito: el servidor de correo puede estar en otra máquina y tardar más en
levantar, y eso no puede dejar al taller sin puente.

### Variables

| Variable                    | Por defecto          | Para qué                                                                                           |
| --------------------------- | -------------------- | -------------------------------------------------------------------------------------------------- |
| `SMTP_HOST`                 | — (opcional)         | Servidor de correo al que entregar. Sin él, solo se entregan los sobres que traen el suyo.         |
| `SMTP_PORT`                 | `587`                | Su puerto. `465` activa TLS directo solo.                                                          |
| `SMTP_TLS`                  | `auto`               | `auto` (STARTTLS si el servidor lo ofrece), `starttls` (obligatorio), `ssl` (TLS directo), `none`. |
| `SMTP_USER` / `SMTP_PASS`   | vacías               | Credenciales, si el servidor las pide.                                                             |
| `SMTP_FROM`                 | vacía                | Remitente fijo, si el servidor exige uno concreto.                                                 |
| `SMTP_HELO`                 | `pulso-taller.local` | Nombre con el que se saluda.                                                                       |
| `SMTP_REJECT_UNAUTHORIZED`  | `true`               | `false` solo para certificados propios sin CA instalada.                                           |
| `SMTP_TIMEOUT_MS`           | `20000`              | Lo que se espera al servidor antes de rendirse.                                                    |
| `MAIL_RELAY_PORT`           | `8788`               | Puerto del puente.                                                                                 |
| `MAIL_RELAY_HOST`           | `0.0.0.0`            | Interfaz donde escucha. `127.0.0.1` lo deja solo en la máquina.                                    |
| `MAIL_RELAY_PATH`           | `/enviar`            | Ruta del sobre.                                                                                    |
| `MAIL_RELAY_TOKEN`          | vacío                | Testigo que tendrá que mandar el backend. **Ponlo.**                                               |
| `MAIL_RELAY_MAX_BODY_BYTES` | `1048576`            | Tope del sobre (1 MB).                                                                             |

Sin `SMTP_HOST` el relevo arranca igual: solo entrega los sobres que traen su
propio servidor —Gmail y el buzón de pruebas— y rechaza los demás diciendo qué
falta. Unas credenciales sueltas (`SMTP_USER`, `SMTP_PASS` o `SMTP_FROM`) sin
`SMTP_HOST` sí paran el arranque: se ignorarían en silencio y el fallo se buscaría
en el sitio equivocado. Si no hay `MAIL_RELAY_TOKEN`, arranca igual, pero avisa:
sin testigo, cualquiera que alcance el puerto puede mandar correo por él.

---

## 3. Conectarlo con la aplicación

En **Ajustes del taller → Servidor de correo**:

1. Elige **Relevo propio**.
2. Como _Dirección del relevo_, la que veas según dónde corra el backend:

   | Dónde corre el backend            | Dirección                                 |
   | --------------------------------- | ----------------------------------------- |
   | En el ordenador, nativo           | `http://127.0.0.1:8788/enviar`            |
   | En Docker (el de `npm start`)     | `http://host.docker.internal:8788/enviar` |
   | En el NAS, con el perfil «correo» | `http://relevo:8788/enviar`               |

3. Como _Testigo del relevo_, el mismo `MAIL_RELAY_TOKEN` que le hayas dado.
4. Guarda y pulsa **Enviar prueba** a tu propio correo. Si llega, el camino está
   hecho.

Al principio del panel está el **estado del camino de envío**, y se mantiene
al día solo: al abrir los ajustes —y otra vez al guardar, que es cuando cambia el
camino— la tarjeta le pide al relevo que se conecte y se autentique con lo
guardado, sin mandar ningún correo, y contesta con el servidor, el cifrado y el
método de autenticación que aceptó. Al lado dice cómo fue el último envío de
verdad; si ese intento no salió, el bloque se pinta en rojo con el motivo que
dejo el servicio. Es la forma de saber que la contraseña es la buena —o que el
puerto está abierto— sin gastar un mensaje ni tocar ningún buzón. El botón
**Comprobar ahora** repite la comprobación sin salir del panel.

`host.docker.internal` funciona de serie en Docker Desktop; el
`docker/convex/docker-compose.yml` del repositorio ya le añade la pasarela para
que también valga en Linux.

---

## 4. Gmail y el buzón de pruebas de Ethereal

Los dos salen por este mismo puente, con una diferencia: **el servidor viaja en
el sobre**. El backend no puede hablar SMTP, así que en vez de tenerlo que
configurar en el relevo, la app le manda a dónde entregar y con qué cuenta:

```json
{
  "from": { "email": "taller@gmail.com", "name": "Pulso Taller" },
  "to": ["sandra.ruiz@taller.es"],
  "subject": "Prueba de correo · Pulso Taller",
  "text": "…",
  "html": "…",
  "smtp": {
    "host": "smtp.gmail.com",
    "port": 465,
    "tls": "ssl",
    "user": "taller@gmail.com",
    "pass": "la-contraseña-de-aplicación"
  }
}
```

Si el sobre trae `smtp`, se entrega por ahí y el remitente SMTP pasa a ser esa
misma cuenta —es a la que Google y Ethereal dan permiso para mandar—, salvo que
hayas fijado `SMTP_FROM` a propósito. Lo que no cambia es lo demás: el saludo, el
tiempo de espera y la validación del certificado siguen siendo del relevo. Si el
sobre **no** trae `smtp`, se entrega por el servidor del entorno, como siempre.

`SMTP_HOST` es solo el servidor de reserva: si el taller no tiene servidor propio
y únicamente va a usar Gmail o Ethereal, no hace falta ponerlo. El relevo arranca
sin él y entrega los sobres que traen el suyo.

```bash
MAIL_RELAY_TOKEN=un-testigo-largo npm run mail:relay
```

### Gmail

1. En la cuenta de Google, activa la **verificación en dos pasos**.
2. Crea una **contraseña de aplicación** (16 letras, en _Seguridad → Contraseñas
   de aplicaciones_). La contraseña normal de la cuenta **no** vale: Google
   rechaza el envío con un `535`.
3. En _Ajustes del taller → Servidor de correo_: elige **Gmail (Google)**, pon la
   dirección del relevo, la cuenta, la contraseña de aplicación y guarda.
4. Como remitente, la propia cuenta de Gmail —o una dirección que esa cuenta
   tenga verificada en «Enviar como»—; si no, Google reescribe la cabecera.
5. Pulsa **Enviar prueba**: el correo sale por `smtp.gmail.com:465` con TLS.

### Ethereal (pruebas)

Sirve para probar el envío **sin mandar nada de verdad**: los correos se quedan en
un buzón de mentira que se lee en el navegador.

1. Crea una cuenta gratis en [ethereal.email](https://ethereal.email/).
2. La propia página te da un **usuario** y una **contraseña** de SMTP.
3. En _Ajustes del taller → Servidor de correo_: elige **Ethereal (pruebas)**,
   pon la dirección del relevo y esas credenciales.
4. Pulsa **Enviar prueba** y míralo en `ethereal.email/messages`.

Sale por `smtp.ethereal.email:587` con STARTTLS. Los destinatarios son de mentira:
nada llega a un buzón real, ni siquiera a la copia oculta del taller.

### Lo que conviene saber

- **La contraseña viaja en el sobre.** El relevo la necesita para autenticarse,
  así que va por el mismo camino que el testigo: si el puente está en `http://`,
  va en claro. La pantalla lo avisa. Usa `https://` —o déjalo dentro de la red del
  taller— y no lo publiques hacia internet.
- **No se guarda en el relevo.** Cada envío lleva la suya; el relevo no la
  escribe en ningún sitio, ni al arrancar, ni en un error, ni en el registro (del
  servidor solo apunta el nombre).
- **La contraseña tampoco vuelve a la app.** Se guarda en los ajustes y la
  pantalla solo ve si hay, de dónde sale y sus últimos cuatro caracteres.

---

## 5. Comprobarlo a mano

Con el relevo arrancado, sin pasar por la app:

```bash
# ¿Está vivo?
curl http://127.0.0.1:8788/salud

# Sin testigo: 401
curl -i -X POST http://127.0.0.1:8788/enviar \
  -H 'Content-Type: application/json' \
  -d '{"from":{"email":"avisos@tudominio.com"},"to":["tu-correo@tudominio.com"],"subject":"Prueba","text":"Hola"}'

# Con testigo: 200
curl -i -X POST http://127.0.0.1:8788/enviar \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer un-testigo-largo' \
  -d '{"from":{"email":"avisos@tudominio.com"},"to":["tu-correo@tudominio.com"],"subject":"Prueba","text":"Hola"}'
```

La comprobación previa se pide igual, y tampoco manda nada:

```bash
# ¿Se puede entregar? Conecta y se autentica, y corta.
curl -i -X POST http://127.0.0.1:8788/comprobar \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer un-testigo-largo' \
  -d '{}'

# Con un servidor concreto en el cuerpo —el que usa Gmail, por ejemplo—:
curl -i -X POST http://127.0.0.1:8788/comprobar \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer un-testigo-largo' \
  -d '{"smtp":{"host":"smtp.gmail.com","port":465,"tls":"ssl","user":"taller@gmail.com","pass":"la-de-aplicación"}}'
```

Vale `/comprobar` y, si el camino del relevo es otro, también con él delante
(`/correo/comprobar`). Contesta `200` con el servidor, el cifrado, el método de
autenticación y el saludo del servidor:

```json
{
  "ok": true,
  "check": {
    "host": "smtp.gmail.com",
    "port": 465,
    "tls": "ssl",
    "auth": "PLAIN",
    "greeting": "ESMTP"
  }
}
```

Códigos: `200` entregado, `400` el sobre no vale, `401` testigo que falta o no
coincide, `413` sobre demasiado grande, `502` el servidor SMTP dijo que no (el
motivo vuelve escrito) y `500` un fallo del propio relevo. En la comprobación,
`200` significa que se pudo conectar y autenticar, `502` que no (con el motivo) y
`501` que ese relevo no tiene la comprobación montada: actualízalo.

Cada envío deja una línea de registro con la hora, los destinatarios, el asunto y
lo que tardó, y cada comprobación deja la suya (`comprobación`, con el servidor si
venía en el cuerpo). **Nunca el cuerpo, el testigo ni la contraseña.**

---

## 6. En el NAS, junto al backend

El `docker/synology/docker-compose.yml` trae el servicio `relevo`, apagado por
defecto. Se enciende con su perfil:

```bash
# en la carpeta del proyecto del NAS
docker compose --profile correo up -d
docker compose logs -f relevo
```

Antes, rellena en el `.env` del proyecto:

```env
SMTP_HOST=correo.tudominio.com
SMTP_PORT=587
SMTP_TLS=auto
SMTP_USER=avisos@tudominio.com
SMTP_PASS=la-clave
MAIL_RELAY_TOKEN=un-testigo-largo
```

Si en vez de un servidor propio vas a usar **Gmail** o el buzón de pruebas, no hay
nada que añadir aquí: esas credenciales se guardan en _Ajustes del taller_ y viajan
en el sobre de cada envío. `SMTP_HOST` sigue haciendo falta como reserva —pon el
del servicio que uses, por ejemplo `smtp.gmail.com`—, pero los envíos de Gmail no
lo usan.

El servicio **no publica ningún puerto**: quien le manda el correo es el backend,
por la red interna del proyecto, en `http://relevo:8788/enviar`. Si el servidor de
correo es el propio NAS y usa un certificado que el contenedor no conoce, pon
`SMTP_REJECT_UNAUTHORIZED=false`; si puedes, mejor instala la CA y déjalo en
`true`.

Para verlo en marcha: `docker compose ps` (con `--profile correo`) y
`docker compose logs relevo`. Y para apagarlo:
`docker compose --profile correo stop relevo`.

---

## 7. Seguridad

- **Pon testigo.** El puerto del relevo es una puerta para mandar correo en
  nombre del taller. Sin `MAIL_RELAY_TOKEN`, cualquiera que llegue a él puede
  usarlo. Con testigo, solo el backend.
- **No lo publiques hacia internet.** No hace falta: el backend lo alcanza por la
  red del taller o por la del proyecto de Docker. En el NAS no se publica ningún
  puerto; en el ordenador, si quieres cerrarlo más, `MAIL_RELAY_HOST=127.0.0.1`.
- **Nada de credenciales en el repositorio.** `SMTP_PASS` va en el `.env` del
  servidor o en el entorno del proceso. El relevo no las imprime nunca, ni al
  arrancar, ni en un error, ni en el registro.
- **Las credenciales del sobre son del sobre.** Una contraseña de aplicación de
  Gmail o la de un buzón de pruebas viaja con cada envío que la usa, y el relevo
  la descarta al terminar. Si el puente está en `http://`, esa contraseña —y el
  testigo— van en claro: no lo saques de la red del taller sin `https://`.
- **Correo saliente en claro.** Con `SMTP_TLS=auto` se cifra si el servidor lo
  ofrece. Si el servidor es de la propia máquina y no ofrece TLS, se entrega en
  claro dentro de la red del taller; si eso no te vale, pon `starttls` y el relevo
  se negará a mandar sin cifrar.

---

## 8. Lo que no hace

- **No guarda cola ni reintenta.** Si el servidor SMTP dice que no, el motivo
  vuelve al backend, que lo apunta en el histórico del correo (_Ajustes del
  taller → Últimos envíos_). La cola y los reintentos son cosa del servidor de
  correo, no de un puente.
- **No firma DKIM ni gestiona SPF.** Eso lo pone el servidor de correo que hace
  la entrega final; el relevo solo se lo pasa.
- **No es un servidor de correo.** No recibe, no tiene buzones y no habla IMAP.
- **No lee adjuntos.** El sobre del taller no los lleva: el PDF del parte se
  consulta en la app.

---

## 9. Cuando algo no sale

| Lo que ves                           | Qué mirar                                                                                                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `401` en el histórico                | El testigo del ajuste y el `MAIL_RELAY_TOKEN` del relevo no son el mismo.                                                                                                                  |
| `502` con `535`                      | Usuario o contraseña del SMTP. En Gmail, casi siempre que se ha usado la contraseña de la cuenta en vez de una contraseña de aplicación.                                                   |
| `Connection refused` al enviar       | El relevo no está arrancado (`npm run mail:relay`) o la dirección no es la suya. Si el ajuste apunta al `8025`, ese es el visor de Ethereal, no el puente: el relevo escucha en el `8788`. |
| `Connection refused` con `localhost` | Con el backend en Docker, `localhost` es el contenedor. Usa `http://host.docker.internal:8788/enviar` (ver el apartado 3).                                                                 |
| `400` en la comprobación             | El relevo arrancó sin `SMTP_HOST` y el sobre no traía servidor propio: elige Gmail o Ethereal en los ajustes, o pon `SMTP_HOST`.                                                           |
| `501` al comprobar                   | Ese relevo es anterior a la comprobación previa (`/comprobar`): actualiza `scripts/mail-relay-lib.mjs` y `scripts/mail-relay.mjs`.                                                         |
| `404` al comprobar                   | El relevo escucha en otro camino que no espera la comprobación: usa `/comprobar` a secas o revisa `MAIL_RELAY_PATH`.                                                                       |
| `502` con `no se pudo` / `EAI_AGAIN` | El nombre del servidor SMTP del sobre no resuelve desde el relevo: revisa la cuenta y la red.                                                                                              |
| `502` con `no ofrece STARTTLS`       | El servidor no cifra: pon `SMTP_TLS=none` si es de la red del taller, o cambia de puerto/servidor.                                                                                         |
| `502` con `no contestó en 20 s`      | Cortafuegos del servidor de correo o puerto equivocado.                                                                                                                                    |
| `EADDRINUSE` al arrancar             | Ya hay algo en el 8788: cambia `MAIL_RELAY_PORT` o para el otro proceso.                                                                                                                   |
| El backend no lo alcanza             | Según dónde corra: `127.0.0.1`, `host.docker.internal` o `relevo` (ver la tabla del apartado 3).                                                                                           |
| `certificate ... self signed`        | `SMTP_REJECT_UNAUTHORIZED=false` (y entiende lo que implica).                                                                                                                              |
