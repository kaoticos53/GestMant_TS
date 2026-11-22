# Handover — F8 de SPEC-0018: piloto con buzones reales, Hermes y ensayo de rollback

- **Fecha y Hora:** 2026-11-22
- **Agente / Modelo:** Buffy (Freebuff)
- **Rama / Commit:** feat/correo-f1-base-pura
- **Fase:** F8 **preparada**; no cerrada. Lo que falta es gente y credenciales, no código.

---

## 1. Qué queda de F8 y qué se ha hecho aquí

F8 son las tareas 1–10 de `docs/plan-implantacion-correo.md` («Fase 8 — Pilotaje y
producción»). En esta sesión se han dejado listos los dos montajes que no
dependen de personas:

1. **El procedimiento del piloto**, con los pasos ejecutables en la app (roles,
   buzón, escenario, métricas y cierre) — §3.
2. **La validación contra Hermes**, con las comprobaciones de conformidad
   mapeadas a lo que la app hace y a lo que se mira en el piloto — §4.
3. **El ensayo de rollback**, ejecutado de verdad: se restaura una copia en un
   deployment de banco de pruebas y se comparan los recuentos **tabla a tabla** —
   §5 y §6.

No se ha tocado código de producción. El único artefacto nuevo es
`tests/rollbackRehearsal.test.ts`, que es el ensayo repetible (y el guardarraíl
para que el rollback no se rompa sin que nadie lo note).

---

## 2. Precondiciones antes de tocar un buzón real

- [ ] Copia previa del taller hecha y verificada: `npm run nas:backup -- --host IP-DEL-NAS`.
- [ ] Ensayo de rollback en verde: `npx vitest run tests/rollbackRehearsal.test.ts`.
- [ ] Restauración probada en un deployment de banco de pruebas (§5.2), no solo en memoria.
- [ ] Los dos técnicos del piloto tienen cuenta activa y contraseña de aplicación de Hermes
      (con doble factor, la contraseña normal devuelve `account.AUTH_FAILED`).
- [ ] Aviso al taller de que el buzón es de **solo lectura**: sin enviar, sin delegar, sin legal hold.

---

## 3. Pilotaje con buzones reales (procedimiento)

### 3.1 Acotar las capacidades (la matriz es por rol, no por persona)

El default de 0017 deja `viewMailbox` y `createIncidentFromMail` activos para
manager y technician. En el piloto se acota así, sin cambiar defaults de código:

1. **Permisos** → rol `manager`: desactivar `viewMailbox`. Guardar.
   (Mutación equivalente: `api.permissions.setRolePermissions({ role, grants })`.)
2. **Permisos** → rol `technician`: desactivar `viewMailbox` y, si el piloto no
   debe dar de alta incidencias desde el correo, también `createIncidentFromMail`.
3. **Permisos** → crear el rol temporal `piloto-buzon` a partir de la plantilla
   `technician`, con `viewMailbox` activo (y `createIncidentFromMail` como se
   haya decidido en el punto 2, no por defecto).
4. **Usuarios** → asignar `piloto-buzon` a los dos técnicos del piloto.

Al cerrar el piloto (§3.4) se deshace en orden inverso. El rol temporal se
borra, no se deja «apagado».

### 3.2 Buzón de prueba: conexión, sincronización y visor

- **Ajustes del taller → Buzón**: la dirección es el buzón completo
  (`usuario@rtva.es`) y la contraseña, la de aplicación. El servidor no se
  escribe: `MAIL_SERVER_URL` está fijado a `https://hermes.rtva.es` en
  `src/lib/mailClient/account.ts` y `mailAccounts.save` no acepta otro.
- **Comprobar la conexión** (`api.mailAccounts.testConnection`): tiene que
  autenticar sin abrir la caché. Si falla, el motivo útil es el `Code` y el
  `Trace` del `soap:Fault`, no el texto.
- **Sincronizar ahora** (Módulo Buzón → «Sincronizar ahora»,
  `api.mailSync.syncNow`): comprobar el árbol de carpetas y que las cabeceras
  entran sin cuerpos.
- **Abrir un mensaje**: cuerpo en HTML y en texto, sin marcar leído en el
  webmail. **Adjuntos**: se descargan con el helper (blob binario), no abren la
  app en la pestaña. **Vaciar caché** (Ajustes → Buzón): el buzón sigue ahí y
  las copias compartidas no se tocan.

Cifras de referencia del servidor (documento del 2026-11-20, **no medidas en esta
sesión**): cuentas de referencia con 19 carpetas, Inbox 793 mensajes, 1 554
cabeceras en 9 carpetas en 5,4 s con páginas de 500, y 759 482 547 B en total.
Sirven para saber si la sincronización del piloto va como debe.

### 3.3 Escenario del piloto (una vuelta completa)

Con los dos técnicos y sus buzones reales:

| # | Qué | Dónde | Qué se comprueba |
|---|---|---|---|
| 1 | Buzón real por técnico | Ajustes → Buzón | Cada uno ve solo el suyo; el otro no aparece |
| 2 | Incidencia compartida | Ficha de incidencia → Correo | El técnico la ve; el invitado no; sin acceso cruzado |
| 3 | Petición compartida | Ficha de petición → Correo | Ídem, con la referencia correcta |
| 4 | Copia en equipo | Ficha de equipo → Correo | Ídem |
| 5 | Copia en manual | Ficha de manual → Correo | Se guarda como **resumen**, sin cuerpo |
| 6 | Copia en compra | Orden/petición de compra → Correo | Ídem |
| 7 | Purga por administrador | Papelera de huérfanas | La copia desaparece para todos; queda la traza |

### 3.4 Métricas que hay que anotar (y umbrales de sentido común)

| Métrica | Cómo se mide | Umbral para seguir |
|---|---|---|
| Sincronización inicial por buzón | Reloj entre «Sincronizar ahora» y la lista | < 60 s en el equipo del taller |
| Sincronización incremental | Segunda pasada tras abrir un mensaje | < 10 s, sin volver a bajar todo |
| Errores por buzón | `mailLog` / estado de la cuenta | 0 `account.AUTH_FAILED` tras configurar |
| Caché por buzón | Ajustes → Buzón (bytes) | Por debajo de `cacheLimitBytes` (por defecto 512 MB) |
| Copias compartidas | Recuento y peso | No crecen con el buzón; una copia = un mensaje |
| Comprensión caché/copia | Pregunta directa al técnico | Sabe que vaciar caché no borra lo compartido |

Cualquier `soap:Fault` durante el piloto se apunta con **Code + Trace**: el
`Trace` es lo único que permite encontrarlo en `mailbox.log` del servidor.

### 3.5 Cierre del piloto

1. **Usuarios** → devolver a los dos técnicos a su rol normal.
2. **Permisos** → borrar el rol `piloto-buzon`.
3. **Permisos** → restaurar el default de `viewMailbox`: primero `manager`,
   después `technician` (y `createIncidentFromMail` según lo decidido en §3.1).
4. Programar el cron de sincronización y comprobar la **primera pasada** en
   producción (`api.mailSync.syncDue`).
5. Comunicar limitaciones: solo lectura, sin envío, sin delegación, sin legal hold.

---

## 4. Validación contra Hermes

El servidor es Zimbra detrás de nginx y **no publica IMAP ni SMTP** (993, 143,
587, 465 y 25 dan timeout): todo va por SOAP en 443. La app ya habla así
(`src/lib/mailClient/soap.ts`), de modo que la validación es de conformidad, no
de puertos.

| ID | Comprobación del servidor | Cómo se comprueba en Pulso Taller | Estado |
|---|---|---|---|
| C1 | `AuthRequest` con el buzón completo | «Comprobar la conexión» y primera sincronización | A ejecutar en el piloto |
| C2 | Formato `DOMINIO\usuario` rechazado | No aplica: la app normaliza y guarda el buzón completo | Cubierto por diseño |
| C3 | 19 carpetas, Inbox con 793 | Árbol de carpetas del módulo Buzón | A ejecutar |
| C4 | 1 554 cabeceras en ~5,4 s | Sincronización inicial (§3.4) | A ejecutar |
| C5 | `total` de carpeta coherente con `n` | Contador de cada carpeta en la lista | A ejecutar |
| C6 | `Sync` con token: 0 cambios | Segunda sincronización sin novedades | A ejecutar |
| C7 | Bytes descargados = atributo `s` | Descargar un `.eml` y comparar con el tamaño de la cabecera | A ejecutar |
| C8 | Servlet sin cookie → 401 | No aplica: la cookie la pone el cliente | Cubierto por diseño |
| C9 | `raw=1` sin `useContentUrl` pierde bytes | No aplica: el cliente pide `useContentUrl=1` | Cubierto por diseño |
| C10 | Abrir un mensaje no lo marca leído | Abrir y mirar el webmail | A ejecutar |
| C11 | Token caducado → renovación | Dejar la pestaña más de 48 h o simular caducidad | A ejecutar |
| C12 | Token de carpeta inválido → reinicio | Forzar reconexión de una carpeta | A ejecutar |

Las cifras C3/C4/C7 son las del documento de referencia del servidor
(`docs/referencia-servidor-hermes.md`, verificado el 2026-11-20), no medidas en
esta sesión: aquí no hay credenciales de Hermes ni cuentas reales.

---

## 5. Ensayo de rollback

### 5.1 Qué se ha ejecutado aquí

`tests/rollbackRehearsal.test.ts` monta un deployment Convex **en memoria**
(`convex-test`, la misma pieza que usa la suite) y ejecuta los handlers reales
que usa la pantalla de Ajustes, no una copia de la lógica:

1. Siembra un taller: 2 equipos, 1 repuesto con su movimiento de stock, 1
   incidencia y 1 copia de correo `original` con cuerpo, adjunto y `.eml`.
2. Exporta con `workshopBackup.exportBackup` y guarda `summary.tableCounts`.
3. Deja que el taller cambie: un repuesto nuevo y el stock del existente a 999.
4. Restaura con `workshopBackup.restoreBackup` y vuelve a contar **todas** las
   tablas de `BACKUP_TABLES`.
5. Compara recuento por recuento, comprueba que lo posterior a la copia
   desapareció, que la copia de correo vuelve como `summary` sin cuerpo,
   adjuntos ni `.eml`, y que `securityAuditLog` conserva su historia.

### 5.2 Cómo se replica en un deployment de banco de pruebas (pendiente de ejecutar)

1. Levantar el banco de pruebas con el backend aislado (`npm run convex:up`, o un
   deployment de staging con su propio `SITE_URL` y `CONVEX_SITE_URL`) y un
   administrador propio.
2. Exportar la copia desde **Ajustes → Copias de seguridad** del entorno de
   origen y guardar el JSON.
3. En el banco de pruebas: **Ajustes → Copias de seguridad → Restaurar**, elegir
   el JSON y escribir `RESTAURAR`.
4. Exportar otra vez en el banco de pruebas y comparar los `tableCounts` de los
   dos resúmenes, tabla a tabla. Alternativa sin pantalla: repetir
   `tests/rollbackRehearsal.test.ts` con los datos del entorno.
5. Muestras manuales: una incidencia con su equipo, una copia de correo en modo
   resumen, y `securityAuditLog` con las entradas anteriores a la restauración.

**Estado:** no ejecutado contra un deployment vivo. En este equipo Docker no está
arrancado (`docker ps` falla) y el backend autoalojado de `127.0.0.1:3210` no
responde, así que no hay banco de pruebas al que apuntar sin levantar
infraestructura. Lo ejecutado es el mismo procedimiento sobre el deployment en
memoria con los handlers reales.

### 5.3 Runbook de rollback (lo que se hace si el piloto va mal)

1. **Cortar la puerta, no los datos**: Permisos → quitar `viewMailbox` (y
   `createIncidentFromMail`) a los roles del piloto. El buzón desaparece del menú;
   las copias compartidas siguen su ciclo y siguen visibles en su ficha.
2. **Parar la sincronización** de las cuentas afectadas: Ajustes → Buzón →
   desactivar la cuenta (`mailAccounts.enabled = false`). No hace falta borrar
   nada.
3. **No borrar tablas ni caché para «volver atrás».** Los datos quedan: las
   cabeceras y cuerpos en caché, las copias en su tabla.
4. **Credenciales**: dejar la cuenta en `reauthRequired` y pedir contraseña de
   aplicación; no reintentar en bucle (el servidor limita sesiones por cuenta).
5. **Espacio**: bajar `cacheLimitBytes` o vaciar caché. Nunca tocar las copias
   compartidas.
6. **Si hay que volver a una copia completa**: restaurar en el banco de pruebas
   (§5.2), comparar recuentos y solo entonces decidir la restauración en
   producción. La restauración vacía las tablas de `BACKUP_TABLES` y las vuelve a
   escribir: `users` y `securityAuditLog` no entran.
7. **Comprobar**: `mailLog` sin envíos nuevos, `lastSyncAt` congelado, copias
   intactas, y el aviso de versión nueva de la PWA sin pendientes.

---

## 6. Lo medido en esta sesión

Ensayo de rollback (`npx vitest run tests/rollbackRehearsal.test.ts`):

```
tabla                  copia  antes  deriva  después
equipment                  2      2       2        2
spareParts                 1      1       2        1
incidents                  1      1       1        1
mailShares                 1      1       1        1
stockMovements             1      1       2        1
total filas de la copia: 6 · restauradas: 6 · 3 ms
```

- Recuentos por tabla idénticos a la copia tras restaurar: **5 tablas, 6 filas**.
- Lo creado después de la copia desaparece (repuesto `EXTRA-999`) y el stock
  tocado (999) vuelve a 10.
- Copia de correo restaurada como `summary`, con `backupRestored: true` y **sin**
  `bodyText`, `attachments` ni `emlStorageId`.
- `securityAuditLog` conserva `workshop_backup_export` y
  `workshop_backup_restore` después del vaciado.
- Restauración completa medida en **3 ms** para 6 filas (memoria; no es una
  cifra de producción).

Estado de la validación automática en esta sesión: `npx tsc --noEmit` sin
errores, `eslint` sin avisos en el ensayo, suite completa **2871 pruebas en 272
archivos** en verde (69 saltadas) y `npm run security:check` en verde (10
archivos, 62 pruebas).

**No medido:** nada contra Hermes (sin credenciales), nada contra un deployment
vivo, y ningún tiempo de sincronización real de un buzón del taller.

---

## 7. Riesgos y deuda para quien siga

- ⚠️ La restauración **omite** una copia de correo si su ficha destino no existe,
  y lo audita como `mail_share_restore_skip`. En un ensayo con recuentos hay que
  esperar esa diferencia, no tratarla como fallo.
- ⚠️ El backup guarda `mailShares` solo como metadatos: al restaurar, los
  adjuntos y `.eml` no vuelven (los objetos siguen en el almacén hasta que
  `storageCleanup` los barra). Es el comportamiento de F7, no una regresión.
- ⚠️ `users` y `securityAuditLog` no entran en la copia: un banco de pruebas
  necesita su propio administrador y no hereda la auditoría del origen.
- [ ] Ejecutar §5.2 en un deployment vivo y anotar aquí los recuentos de verdad.
- [ ] Ejecutar la tabla de §4 con una cuenta real y anotar C1–C12.
- [ ] Si el piloto se alarga, comprobar C11 (caducidad del token a las ~48 h).
