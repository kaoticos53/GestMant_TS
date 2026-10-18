# 2026-10-18 — En el NAS no existía el contenedor del relevo, y el correo no salía

## Lo que pasó

En el NAS, `npm run nas` terminaba bien y el panel decía que todo estaba en pie
—app, backend, dashboard y vigilante—, pero **no había ningún contenedor
`relevo`**, y los envíos de correo fallaban con «conexión rechazada».

No era un fallo del relevo: era que **nunca se había creado**. El servicio vivía
detrás de un perfil de Compose:

```yaml
profiles: ["correo"]
```

y todo lo que arranca el taller —`npm run nas`, el botón *Build* de Container
Manager— usa `docker compose up -d` **sin perfiles**, así que Compose se saltaba
ese servicio en silencio. El backend de Convex no abre conexiones TCP: sin
puente, cualquier envío que salga por Gmail, por el buzón de pruebas o por un
servidor SMTP propio se queda en el camino, y el aviso de una incidencia se
queda sin salir sin que nada más lo diga. Un perfil que hay que recordar es una
trampa: el fallo no aparece hasta que hace falta.

## Lo que se cambió

- `docker/synology/docker-compose.yml` — **fuera el perfil**: el `relevo` es un
  contenedor más del proyecto y arranca con el resto. Sin `SMTP_HOST` no estorba
  (entrega los sobres que traen su servidor y rechaza con un 400 el que no), y no
  publica ningún puerto, así que un taller que mande por Resend o por la pasarela
  no paga nada por tenerlo.
- `scripts/nas-setup-lib.mjs` — la puesta en marcha mira cómo quedó el relevo
  (`en-pie`, `parado`, `enfermo`, `falta`), lo deja en el resumen (`relevo=`) y lo
  enseña en el panel con la dirección que hay que poner en _Ajustes del taller_:
  `http://relevo:8788/enviar`. Si falta, manda a `--force-compose`, que es lo que
  hay que hacer en una instalación cuyo `docker-compose.yml` es de antes. El
  `--check` añade el relevo a los contenedores que mira y avisa si el compose lo
  declara y no está en pie; si el compose no lo trae, no reprocha nada.
- `src/lib/mail.ts` — el aviso de un envío que no llega al relevo nombra las dos
  instalaciones: `npm run mail:relay` en el ordenador y el contenedor `relevo` en
  el NAS, con la dirección de cada una (`host.docker.internal` frente a
  `relevo`). Mandar a un comando que en el NAS no existe deja el problema donde
  estaba.
- `RELEVO.md`, `SYNOLOGY.md` (entrada nueva en «Problemas frecuentes»),
  `docker/synology/.env.example`, `README.md`, `CHANGELOG.md` — la guía del NAS
  ya no habla de perfiles y cuenta qué mirar cuando el correo no sale.
- `tests/nasSetup.test.ts` — cinco pruebas: el compose sin `profiles`, la línea
  del correo en el panel, los dos veredictos del `--check` y el arranque del
  relevo en la puesta en marcha de verdad.

## Decisiones

- **Arrancarlo siempre**, en vez de encenderlo a demanda: el coste es un
  contenedor parado en la red interna del proyecto, sin puertos publicados; el
  coste del perfil era un taller que no manda correo y no lo sabe.
- **La ausencia se interpreta contra el compose**, no contra el contenedor: que
  falte el contenedor es un fallo (se levanta con `docker compose up -d relevo`)
  y que falte el servicio es una instalación de antes (se arregla con
  `--force-compose`). Son dos arreglos distintos y el panel los distingue.
- **No se toca el compose del NAS por su cuenta**: la puesta en marcha conserva
  lo que el operador haya cambiado. Se avisa, no se pisa.

## Comprobado

- El guion del NAS ejecutado de verdad, con dobles de `docker` y `curl`: las
  cuatro situaciones del relevo dan su estado y su línea de registro, y el
  `--check` distingue `relevo_declarado=si` de `no` leyendo el compose.
- Suite completa en verde (1672 pruebas, 111 archivos), `tsc --noEmit` limpio,
  eslint sin errores y `vite build` correcto.
- **Lo que no se pudo comprobar**: el NAS del taller, porque el comando pide la
  contraseña y no la guarda. El arreglo está verificado en el guion, no contra la
  instalación: queda lanzar `npm run nas -- --host … --force-compose` (el compose
  del NAS es la copia antigua y se conserva si no se le pide) y mirar en
  _Ajustes del taller → Servidor de correo_ que la dirección es
  `http://relevo:8788/enviar` y el testigo coincide con `MAIL_RELAY_TOKEN`.
