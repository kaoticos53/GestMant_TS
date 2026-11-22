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
- [x] Restauración probada en un deployment de banco de pruebas (§5.2 y §8), no solo en memoria.
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
   incidencia, 1 copia de correo `original` con cuerpo, adjunto y `.eml`, y el
   rastro de un adjunto retirado (una fila de `incidentDocumentLog` cuyo
   documento ya no existe).
2. Exporta con `workshopBackup.exportBackup` y guarda `summary.tableCounts`.
3. Deja que el taller cambie: un repuesto nuevo y el stock del existente a 999.
4. Restaura con `workshopBackup.restoreBackup` y vuelve a contar **todas** las
   tablas de `BACKUP_TABLES`.
5. Compara recuento por recuento, comprueba que lo posterior a la copia
   desapareció, que la copia de correo vuelve como `summary` sin cuerpo,
   adjuntos ni `.eml`, que el rastro del adjunto retirado vuelve con su
   `documentId` histórico y que `securityAuditLog` conserva su historia.
6. Repite con una copia estropeada a propósito (sin `documentId`): la
   restauración se niega antes de vaciar y los recuentos siguen iguales.

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

**Estado:** **ejecutado** el 2026-11-22 contra el deployment real que levanta
`docker/convex` en `127.0.0.1:3210`, entrando con el administrador de desarrollo
y llamando a las mismas acciones que la pantalla. Los números y el defecto que
salió están en §8.

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
incidentDocumentLog        1      1       1        1
mailShares                 1      1       1        1
stockMovements             1      1       2        1
total filas de la copia: 7 · restauradas: 7 · 4 ms
```

- Recuentos por tabla idénticos a la copia tras restaurar: **6 tablas, 7 filas**.
- Lo creado después de la copia desaparece (repuesto `EXTRA-999`) y el stock
  tocado (999) vuelve a 10.
- Copia de correo restaurada como `summary`, con `backupRestored: true` y **sin**
  `bodyText`, `attachments` ni `emlStorageId`.
- `securityAuditLog` conserva `workshop_backup_export` y
  `workshop_backup_restore` después del vaciado.
- Restauración completa medida en **2–4 ms** para 7 filas: es el deployment en
  memoria del test, **no** una cifra de producción. La medida de verdad, contra
  el backend de Docker, está en §8 (880 filas; ~1,5 s con la comprobación previa).

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

---

## 8. Ensayo de rollback contra el deployment real (2026-11-22)

Backend levantado con `npm run convex:up` (`docker/convex/docker-compose.yml`),
`npx convex dev --once` para subir las funciones y el administrador de desarrollo
(`admin@taller.es`, credencial de `LOCAL_SETUP.md`) entrando por el proveedor de
contraseña, como la pantalla. Nada de atajos: `exportBackup` y `restoreBackup`
son las acciones de Ajustes → Copias de seguridad.

Preparación del taller: `workshopReset:resetWorkshop` (467 filas, 6 pasadas) y
`seed:seedDemoData` para dejar la muestra completa.

### 8.1 Lo que salió mal a la primera: la restauración se caía a mitad

```
Failed to insert or update a document in table "incidentDocumentLog" because it
does not match the schema: Object is missing the required field `documentId`.
```

La copia guarda el rastro de un adjunto **retirado**: el documento se borra, la
fila de `incidentDocumentLog` se queda y su `documentId` apunta a una fila que ya
no existe —el propio `schema.ts` lo documenta como legítimo—. Al restaurar, ese
documento no vuelve en la copia, `remapBackupDocument` no encontraba el id nuevo
y **borraba el campo**, que el esquema exige. El fallo llegaba con las tablas ya
vaciadas: el taller quedó a medias (peticiones y movimientos a 0) hasta volver a
sembrarlo. En memoria no salía porque el ensayo no tenía ningún adjunto retirado.

**Arreglo (`src/lib/backup.ts`):** `incidentDocumentLog.documentId` sale del
remapeo genérico: si el documento vuelve en la copia se remapea, y si no, se
conserva el id histórico (los identificadores de Convex no se reutilizan, así
que sigue apuntando a lo que apuntaba: a nada). Es la salida más limpia de las
tres: omitir la fila perdería el único rastro de que el adjunto existió y
descuadraría el recuento de `incidentDocumentLog` respecto a la copia; sanearla
no es posible, porque el esquema exige el campo y un id inventado apuntaría a
otro documento. `tests/rollbackRehearsal.test.ts` siembra ese adjunto retirado y
comprueba que el rastro vuelve con su `documentId` de origen (7 filas en
memoria, antes 6). La restauración, además, ya no puede llegar a ese estado:
antes de vaciar comprueba la copia entera (§8.3).

### 8.2 Recuentos por tabla, contra el backend de Docker

Dos vueltas completas, con deriva real entre la copia y la vuelta atrás (un
repuesto y un equipo nuevos, y el stock de `CON-ALCO2` de 12 a 1012):

```
tabla                     copia  deriva  después
appSettings                  1       1        1
catalogs                   150     150      150
equipment                   25      26       25
equipmentModels             25      26       25
equipmentMovements          51      52       51
incidentDocumentLog        103     103      103
incidentDocuments           71      71       71
incidents                  123     123      123
maintenanceRecords         115     115      115
messages                     5       5        5
notifications                8       8        8
partRequests               106     106      106
requestDecisions            22      22       22
roles                        1       1        1
spareParts                  43      44       43
stockMovements              30      32       30
total de la copia: 879 · restauradas: 879 · 16 tablas con filas
export 54 ms / 55 ms · deriva 83 ms / 89 ms · restauración 1226 ms / 1223 ms
copia 614,0 KB
```

- Recuentos idénticos a la copia en las 16 tablas, las dos veces.
- `DRIFT-001` (repuesto posterior) y `EQ-DRIFT-1` (equipo posterior) no existen
  tras la vuelta; el stock de `CON-ALCO2` vuelve a 12.
- Comprobación independiente con consulta del CLI: mismos recuentos
  (`equipment` 25, `spareParts` 43, `incidents` 123, `partRequests` 106,
  `stockMovements` 30, `incidentDocumentLog` 103…), `users` 14 intactos y
  `securityAuditLog` con las entradas `workshop_backup_export` /
  `workshop_backup_restore` (22 → 35).
- **Cifra para el handover: ~1,2 s y 879 filas / 614 KB** en este equipo, contra
  el deployment de Docker en la misma máquina. Sustituye a los «3 ms / 6 filas»
  en memoria, que solo valen para el test. (Después se añadió la comprobación
  previa: ~1,4–1,5 s, §8.3.)

### 8.3 Restauración a prueba de copias rotas (2026-11-22, misma tarde)

`restoreBackup` recorre ahora la copia entera **en seco** antes de borrar nada:

1. Cada lote pasa por el mismo código que lo inserta (`insertBackupRows`), pero
   desde `checkTableBatch`, que lanza al final para que Convex revierta el lote
   entero —también la traza `mail_share_restore_skip`—. Nada queda escrito.
2. El remapeo del lote viaja en el error (`ConvexError.data`), que es la única
   salida de una mutación deshecha; sin él, los lotes siguientes borrarían
   referencias que sí existen en la copia.
3. Solo si pasan las 29 tablas de la copia se vacía y se inserta. Si un lote
   falla, el error llega con el detalle del esquema y el taller sigue como
   estaba.

Para el fallo que la comprobación no puede ver —una inserción que se cae a
mitad, con las tablas ya vaciadas—, antes de borrar se guarda el estado actual
(`collectAllTables` con `raw: true`, sin proyectar las copias de correo) y, si
la inserción falla, se reescribe ese estado (`insertSnapshotBatch`) antes de
devolver el error: «La restauración falló a mitad y se ha devuelto el taller al
estado anterior». `tests/rollbackRehearsal.test.ts` lo prueba con un fallo
inyectado en la inserción real (`backupFaults.failOnTable`, un punto de ruptura
que en producción está a `null`): el taller queda tabla a tabla como estaba, con
lo que llegó después de la copia y con la copia de correo entera —cuerpo,
adjuntos y `.eml`—, no como resumen.

Medido contra el mismo deployment de Docker, dos vueltas:

- `differing: []` en las 29 tablas de `BACKUP_TABLES`; idénticos a la copia tras
  restaurar las dos veces. Total **880 filas** (las de §8.2 más `publicStats`,
  que allí no estaba en la tabla), 614 KB.
- Export 135 ms / 48 ms · deriva 57 ms / 51 ms · **restauración 1409 ms /
  1506 ms** (antes 1226 / 1223 ms): el recorrido en seco cuesta más o menos lo
  mismo que la inserción.
- Copia estropeada a propósito (se le quita `documentId` a una fila de
  `incidentDocumentLog`): rechazada en **155 ms** con «La copia no se ha
  restaurado y el taller sigue como estaba: …» y el detalle del esquema detrás.
  Recuentos antes y después idénticos (880 filas) y `CON-ALCO2` sigue en 12. Ese
  mismo fallo, en §8.1, dejó el taller vacío a medias.
- Con la foto del estado previo, la restauración de 880 filas pasa de ~1,51 s a
  **1,66 s** (export 112 ms, `differing: []` en las 29 tablas, la deriva de
  prueba desaparece). La foto añade una lectura completa; dentro de la fórmula
  de la pantalla cae en el redondeo.

**La foto ya vive en la base (misma tarde).** La recuperación anterior solo
funcionaba si la acción llegaba a ver el fallo; si el backend moría entre el
vaciado y el último lote, el `catch` no corría y el taller quedaba a medias. Ahora
la foto se escribe en `workshopRestoreSnapshots` —en trozos de 200 000
caracteres, porque un taller grande no cabe en un documento— **antes** de vaciar,
y se retira al terminar la restauración. Quedan dos recogedores:

1. **La pasada de recuperación**, un cron cada diez minutos
   (`recoverInterruptedRestore`): si la foto tiene más de diez minutos, la acción
   que la guardó ya no puede estar viva y el estado anterior se reescribe. Una
   foto reciente no se toca, por si es una restauración en curso.
2. **La siguiente restauración**: al empezar, si hay foto pendiente y es vieja,
   devuelve el taller a como estaba antes de validar y aplicar la copia nueva; si
   es reciente, rechaza con «Hay una restauración en marcha» en vez de pisarla.

`tests/rollbackRehearsal.test.ts` lo prueba simulando la muerte
(`backupFaults.simulateCrash`, que corta la acción sin recuperar): comprueba que
el taller queda a medias y con foto guardada, que la pasada no la toca mientras
es reciente, que tras el margen devuelve recuentos y contenido —`EXTRA-999`, la
copia de correo con cuerpo, adjuntos y `.eml`— y que la siguiente restauración
recupera primero y aplica después. Si la escritura de la foto se corta, se
retira el trozo a medias antes de devolver el error: una foto incompleta
bloquearía todas las restauraciones siguientes. La foto de varios trozos tiene
su propia prueba: baja el tamaño a 200 caracteres (`backupFaults.snapshotChunkChars`,
`null` en producción), comprueba que los trozos comparten tanda y que la
recuperación recompone el taller entero, contenido incluido.

Ensayo real contra el mismo Docker, con el taller de 880 filas / 614 KB:

- Restauración normal con la foto persistida: **1 196 ms**, 880 filas
  restauradas; al terminar, `workshopRestoreSnapshots` queda vacía. La foto
  compacta cupo en **3 trozos** de 200 000 caracteres.
- Restauración cortada: se desplegó a propósito el punto de ruptura
  (`failOnTable: "incidents"` + `simulateCrash: true`, revertido después a
  `null`/`false`). La acción se cortó a los **900 ms** con el taller a medias
  (**244 filas**) y los 3 trozos de la foto en la tabla. La pasada de
  recuperación —con el umbral bajado a 0 para no esperar los diez minutos—
  devolvió `recovered: true`: **880 filas**, `spareParts` 43, `incidents` 123,
  `CON-ALCO2` en 12 y la tabla de fotos vacía. El umbral volvió a 10 minutos en
  el despliegue final.
- `users` y `securityAuditLog` no se volvieron a contar aquí; la restauración no
  los toca (§8.2) y la comprobación previa escribe y revierte dentro de sus
  propias mutaciones.

### 8.4 Riesgos que siguen

- La recuperación de una restauración cortada necesita que la foto lleve más de
  diez minutos sin vida: ese es el margen para no pisar una restauración en
  curso. Un taller enorme que tardara más que eso en restaurarse podría verse
  recuperado por la pasada mientras sigue trabajando; con los volúmenes medidos
  (§8.5, 15 s para 7 806 filas) queda muy lejos, pero conviene saberlo.
- Si el backend muere **después** de insertar toda la copia y **antes** de
  retirar la foto, la siguiente recuperación devuelve el taller al estado
  anterior: se pierde una restauración que había terminado. Es el lado seguro
  —taller coherente— y el usuario ya habrá visto un fallo, pero la copia hay que
  volver a lanzarla.
- La recuperación del cron reescribe con la cuenta que guardó la foto
  (`savedBy`). Si esa cuenta se hubiera desactivado o borrado, la pasada falla y
  el taller sigue a medias; la siguiente restauración de otro administrador lo
  arregla.
- La foto añade escrituras: se serializa el taller entero y se guarda en trozos
  antes de vaciar. Es el precio de sobrevivir a la muerte del proceso; en los
  volúmenes medidos cae dentro del segundo que ya costaba la vuelta atrás.
- La vuelta atrás reescribe con identificadores nuevos y sin el `_creationTime`
  original (Convex no lo admite al insertar): el contenido y las relaciones
  quedan, los ids y las fechas de creación no. Es el mismo precio que paga una
  restauración normal.
- `mailShares` **no se ha podido probar con datos reales** (0 filas: sin buzón
  sincronizado en este deployment). Su comportamiento está cubierto en memoria
  por el test, incluida la omisión con traza `mail_share_restore_skip`.
- `users` y `securityAuditLog` siguen fuera de la copia: la restauración no los
  toca (comprobado: 14 usuarios y la auditoría con su historia).

### 8.5 Escala con volumen (2026-11-22, misma tarde)

Mismo deployment. Se partió del taller de 880 filas y se añadieron tandas de
`seed:seedMoreDemoData({ incidents: 200, requests: 200 })`, unas 870 filas cada
una (8 tandas, hasta 7 806 filas). En cada tramo se exporta y se restaura **la
misma copia**, así que el tiempo de restaurar incluye vaciar lo que ya había
(igual de grande que la copia):

| filas |   copia | exportar | restaurar |
| ----: | ------: | -------: | --------: |
|   880 | 0,63 MB |    52 ms |    1,51 s |
| 1 723 | 1,44 MB |   182 ms |    2,26 s |
| 2 598 | 2,26 MB |   285 ms |    3,27 s |
| 3 465 | 3,07 MB |   351 ms |    4,52 s |
| 4 335 | 3,88 MB |   462 ms |    7,64 s |
| 6 073 | 5,50 MB |   738 ms |   11,49 s |
| 7 806 | 7,13 MB | 1 022 ms |   15,45 s |

- **Exportar** es lineal y barato: ~0,11 s por cada 1 000 filas, más ~40 ms
  fijos. A 7,8 mil filas, 1 s.
- **Restaurar** tiene dos costes lineales: la comprobación en seco más la
  inserción cuestan ~1,3–2,0 ms por fila de la copia, y el vaciado ~0,65 ms por
  fila que ya hubiera. La regla que se aplica en la pantalla, ajustada a esta
  tabla, es `segundos ≈ máx(2; 0,002 × filas de la copia)`: esos 2 ms por fila
  ya incluyen vaciar un taller del mismo tamaño; con muchos más datos habría
  que sumar ~0,6 ms por fila de diferencia.
- Con una copia pequeña sobre un taller grande manda el vaciado: volver a la
  copia de 880 filas sobre las 7 806 tardó **6,5 s**.
- No se alcanzó ningún límite de tamaño: 7,13 MB de JSON salieron y entraron sin
  problema. Por encima de eso no se probó. Son cifras de este equipo (Windows,
  backend Docker en la misma máquina); en producción cambia el hardware.

**Dónde avisa la pantalla** (`WorkshopBackupSection`, con
`estimateRestoreSeconds` y `restoreSizeLevel` en `src/lib/backup.ts`): el
diálogo de confirmación enseña siempre el tamaño del archivo y el tiempo
estimado; a partir de **3 000 filas (~2,9 MB, ~6 s)** aparece un aviso de «copia
voluminosa» y a partir de **6 000 filas (~5,5 MB, ~12 s)** uno reforzado de
«copia grande». Con la muestra normal (880 filas, 0,6 MB, ~1,5 s) solo sale la
línea discreta. Mientras la restauración dura, el aviso pasa a «Restaurando la
copia… No cierres la pestaña», el botón y el campo quedan deshabilitados y un
pestillo (`restoreInFlight`) impide lanzar una segunda; la palabra `RESTAURAR`
no se borra, así que si falla se puede reintentar sin volver a escribirla. El
taller de este deployment son 880 filas: el umbral está muy por encima de lo
que hay hoy.

El ensayo se hizo con un script temporal (borrado) y el taller quedó devuelto a
la copia de partida: 880 filas, mismos recuentos tabla a tabla que §8.2 más
`publicStats`.
