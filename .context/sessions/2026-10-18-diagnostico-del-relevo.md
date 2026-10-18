# 2026-10-18 — El envío por Ethereal fallaba y el error no decía dónde

## Lo que pasó

Un envío de prueba por **Ethereal (pruebas)** falló con:

```
error sending request for url (https://localhost:8025/enviar):
tcp connect error: Connection refused (os error 111)
```

y la comprobación previa, igual, contra `http://localhost:8025/enviar/comprobar`.

No era un fallo del envío: eran **tres cosas a la vez**, y ninguna se veía en la
pantalla.

1. **El 8025 no es el relevo.** Es el visor de mensajes de Ethereal. El relevo
   (`scripts/mail-relay.mjs`) escucha en el **8788**. La dirección guardada
   apuntaba a un puerto que no entrega correo.
2. **El relevo no estaba arrancado.** Nada escuchaba en el 8788.
3. **`localhost` no es el ordenador del taller.** El backend corre en Docker
   (`convex-backend-1`, 3210/3211): dentro del contenedor, `localhost` es el
   contenedor. Desde ahí se llega al ordenador por `host.docker.internal:8788`,
   que en este equipo resuelve a `192.168.65.254` y **sí** alcanza el relevo.

Además, el relevo exigía `SMTP_HOST` para arrancar, aunque Gmail y Ethereal
mandan su servidor en cada sobre: justo el caso más fácil era el que no arrancaba.

## Lo que se cambió

- `src/lib/mail.ts` — **`mailRelayAddressHint`**: avisa al escribir la dirección
  del puerto 8025 (visor de Ethereal), de `https://` en el 8788 y de `localhost`
  cuando el backend va en contenedor. No bloquea el guardado.
  **`mailRelayFailureHint`**: a un fallo de conexión le añade que el relevo tiene
  que estar arrancado y cuál es su dirección.
- `src/convex/_mail/deliver.ts` y `src/convex/mailSettings.ts` — usan esa pista
  al apuntar el motivo de un envío fallido y al contestar la comprobación.
- `src/pages/dashboard/settings/MailServerCard.tsx` — el aviso se enseña en ámbar
  bajo la dirección del relevo, y el marcador de Gmail y Ethereal pasa a ser
  `http://host.docker.internal:8788/enviar`.
- `scripts/mail-relay-lib.mjs` / `scripts/mail-relay.mjs` — el relevo arranca sin
  `SMTP_HOST` (`smtp: null`) y usa `resolveSmtp` para decidir el servidor de cada
  entrega: el del sobre o el del entorno; si no hay ninguno, 400 con una frase que
  dice qué falta. Credenciales sueltas sin `SMTP_HOST` siguen parando el arranque.
- `RELEVO.md`, `.context/specifications.md`, `CHANGELOG.md` — al día, con las filas
  nuevas de «Cuando algo no sale» y la tabla de variables corregida.

## Cómo quedó comprobado

- `npx tsc -p tsconfig.app.json --noEmit` → 0.
- `npx vitest run tests/mailRelay.test.ts tests/mailSettings.test.ts tests/mailServerCard.test.tsx`
  → 101/101.
- Relevo arrancado a mano sin `SMTP_HOST`: `GET /salud` 200; `POST /comprobar`
  sin `smtp` 400 con el motivo; con un `smtp` inalcanzable, 502 con el error SMTP.
- Desde el contenedor del backend: `fetch('http://host.docker.internal:8788/salud')`
  → `{"ok":true}`.

## Lo que queda en manos de quien configura

La dirección guardada hay que cambiarla en **Ajustes del taller → Servidor de
correo**: `http://host.docker.internal:8788/enviar`, con la cuenta y la contraseña
del buzón de Ethereal ya guardadas. El relevo tiene que estar arrancado
(`npm run mail:relay`); sin `MAIL_RELAY_TOKEN` avisa de que queda abierto.
