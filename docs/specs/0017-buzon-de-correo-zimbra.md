# SPEC-0017 — Buzón de correo Zimbra (cliente de solo lectura)

- **ID:** `SPEC-0017`
- **Título:** Módulo de correo: buzón personal de solo lectura sobre `hermes.rtva.es`, con sincronización de cabeceras, descarga bajo demanda y caché con descarte
- **Estado:** **Aprobada — F1/F2 cerradas; F3 y F4 implementadas (cabeceras, vista, cuerpo, visor, adjuntos y caché); pendiente la validación real contra Hermes; fase 6 pendiente**
- **Fecha:** 2026-11-21
- **Fuentes clave:** [`docs/referencia-servidor-hermes.md`](../referencia-servidor-hermes.md) (canónica), [`docs/especificacion-cliente-sync-correo.md`](../especificacion-cliente-sync-correo.md), `src/convex/mailSettings.ts`, `src/convex/_auth/secretCrypto.ts`, `src/convex/permissions.ts`, `src/lib/permissions.ts`, `src/lib/abilities.ts`, `src/convex/crons.ts`, `src/convex/storageCleanup.ts`
- **Fase del producto:** fase 1 (cliente de correo). La integración con IA es fase 2 y queda fuera de esta spec.
- **Autoridad documental:** ver §0.

---

## 0. Autoridad documental y discrepancias

Tres documentos gobiernan este módulo y **no tienen el mismo rango**:

| Materia                                                                                          | Documento que manda                                                                      | Cómo se aplica aquí                                                                                                                                            |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Endpoints, operaciones SOAP, atributos, semántica de ids, errores, límites y cifras del servidor | [`docs/referencia-servidor-hermes.md`](../referencia-servidor-hermes.md)                 | **Canónico.** Si 0017 o la guía del cliente discrepan en esto, manda la referencia.                                                                            |
| Algoritmo de cliente, parseo MIME, visor, saneado y verificación de descargas                    | [`docs/especificacion-cliente-sync-correo.md`](../especificacion-cliente-sync-correo.md) | **Guía.** Se adopta salvo que 0017 decida otra cosa por el modelo Convex; sus decisiones de escritorio (SQLite, `.eml` en disco, WebView2) no son vinculantes. |
| Producto, modelo de datos Convex, permisos, caché, UI y programación                             | esta `SPEC-0017`                                                                         | **Decide** lo que no fijan el servidor ni el protocolo.                                                                                                        |

### 0.1 Discrepancias detectadas y criterio aplicado

| Punto                           | Qué dicen los documentos                                                                                                                                      | Criterio de 0017                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SearchResponse.total`          | La referencia §4.2 dice que **no publica `total`**; su ejemplo de §9 muestra `total="793"` y la comprobación C5 lo usa.                                       | Se pagina por **longitud de página y `more`**, nunca por `total`; los contadores salen de `n` de la carpeta. La contradicción es de la referencia y se resuelve por el lado conservador.                                                                      |
| Formato de `after:`             | La misma §4.2 afirma que solo funciona `after:M/D/AAAA` y, unas líneas antes, su ejemplo usa `after:2024/01/01`.                                              | Solo se emite `M/D/AAAA`. Las demás formas se ignoran **sin error** en el servidor, así que usarlas devolvería la carpeta completa como si fuera un filtro.                                                                                                   |
| Orden del recorrido completo    | La guía §5.1 pagina con `dateDesc`; la referencia §4.2 recomienda `dateAsc` al recorrer el histórico para que los mensajes nuevos no desplacen la paginación. | Se usa **`dateAsc`** en el recorrido completo; `dateDesc` solo para el listado local, que se ordena por `date`.                                                                                                                                               |
| `view` ausente                  | Referencia §4.1: falta en `Trash`, `Personales` y `Fuentes RSS`; hay que tratarlas como correo salvo nombre de tipo no-mensaje conocido (p. ej. RSS).         | `view` ausente ⇒ correo, **salvo** `Fuentes RSS` y variantes RSS, que se excluyen por nombre. `Trash` y `Personales` se aceptan.                                                                                                                              |
| `md` de `SyncResponse`          | Aparece en la respuesta real (`md="1795210794"`) sin significado documentado; no puede ser epoch en ms (sería 1970).                                          | Se ignora. No se usa para ordenar, fechar ni calcular deltas.                                                                                                                                                                                                 |
| Metadatos por id                | La referencia no documenta operación de metadatos por id; `GetMsg` con `raw="0"` devuelve `<su>` vacío.                                                       | Las cabeceras se obtienen **solo con `Search`**; `Sync` aporta ids y borrados, no metadatos.                                                                                                                                                                  |
| Borrado remoto                  | La guía §5.3 pide cuarentena de 30 días antes de borrar un `.eml`; la caché de 0017 no guarda `.eml`.                                                         | Se marca `deletedRemoteAt` (tumba) y se oculta; la caché **no se borra en el acto**, queda sujeta al LRU y a la caducidad de 30 días. Así un delta erróneo no destruye contenido ya descargado.                                                               |
| Imágenes `cid:`                 | La guía §8.1 las incrusta como `data:`; 0017 prohíbe duplicar bytes.                                                                                          | Se guardan una vez como adjunto y el visor resuelve `cid:` a la URL del objeto en tiempo de render.                                                                                                                                                           |
| Límite por mensaje              | La guía fija 50 MB; la referencia solo verifica 25 690 819 B entregados y aclara que los 10 MB son del contenido incrustado en SOAP.                          | 0017 adopta **50 MB** como tope de cliente; no es un límite del servidor.                                                                                                                                                                                     |
| Nombres de estado               | La guía usa `header`, `ok`, `error`, `skipped_too_large`, `deleted_remote`; 0017 usa `none`, `cached`, `error`, `tooLarge` y `deletedRemoteAt`.               | Es el mismo ciclo con nombres propios: `header`→`none`, `ok`→`cached`, `skipped_too_large`→`tooLarge`, `deleted_remote`→`deletedRemoteAt`. No se mezclan en código.                                                                                           |
| Caché 512 MB / 30 días          | No aparece en ninguno de los dos documentos.                                                                                                                  | Decisión de producto de 0017.                                                                                                                                                                                                                                 |
| Copia compartida frente a caché | Ninguno de los dos documentos describe el correo compartido al expediente; la guía solo habla de la caché del buzón.                                          | Una copia compartida **no es caché**: no entra en `cacheBytes`, no la expulsa el LRU, no la borra el barrido de caducidad ni «Vaciar caché», y no se borra al desconectar la cuenta. Vive con el registro destino y se rige por su ciclo de vida (SPEC-0018). |
| Concurrencia                    | La guía sugiere 4 peticiones simultáneas; la referencia pide pocas conexiones por IP.                                                                         | 0017 baja a **2** por cuenta, porque el servidor es compartido.                                                                                                                                                                                               |
| 401 del servlet                 | La referencia §6.2 dice «renovar token»; §6.3 lo lista como «no reintentar».                                                                                  | Se descarta el token, se hace **un** `AuthRequest` y se repite **una** vez la descarga; si vuelve a fallar, se detiene. No es un bucle.                                                                                                                       |
| Frecuencia de sincronización    | La guía propone 15 min por defecto; 0017 aprobó bajo demanda + cada hora.                                                                                     | Decisión de producto (G1/G2); no contradice al servidor.                                                                                                                                                                                                      |
| Cifrado de credenciales         | La guía usa DPAPI/llavero del sistema; 0017 vive en Convex.                                                                                                   | Se usa `secretCrypto` (AES-GCM), ya auditado en el proyecto.                                                                                                                                                                                                  |

---

## 1. Contexto y objetivo

El taller ya envía correo (`SPEC-0010`), pero no puede **leer** el buzón corporativo desde la aplicación. El servidor `hermes.rtva.es` (Zimbra tras nginx) solo publica SOAP en 443: no hay IMAP, no hay EWS y EAS no garantiza el mensaje original. El buzón de referencia tiene 19 carpetas (9 de correo), 1 554 mensajes y 759 482 547 B (724 MiB); listar todas las cabeceras cuesta ~5,4 s en 13 peticiones.

Objetivo: un módulo de correo **personal y de solo lectura** dentro del panel, con la misma calidad de datos que el webmail para lo que se ve en pantalla, sin descargar los 759 482 547 B del buzón ni tocar el estado del buzón remoto.

---

## 2. Decisiones aprobadas

| Código | Decisión                                                                                                                          | Consecuencia en el diseño                                                                                                                                                                                                                                                                                           |
| ------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A1** | SOAP ejecutado en **acciones de Convex**, con una librería pura en `src/lib/mailClient/`                                          | El navegador nunca habla con Zimbra (CORS + cookie). Toda la lógica de protocolo es testeable sin red.                                                                                                                                                                                                              |
| **B1** | Las **cabeceras viven en Convex** (tablas propias)                                                                                | Listado y búsqueda local inmediatos; la sincronización solo escribe cabeceras.                                                                                                                                                                                                                                      |
| **C1** | **Una sola copia materializada** (cuerpo parseado en `mailBodies` + adjuntos en `_storage`) con caché **LRU de 512 MB / 30 días** | En la caché del buzón, el RFC822 se descarga, se verifica y se descarta: no se guarda junto a sus partes extraídas. El presupuesto cuenta **todos** los bytes persistidos del mensaje (texto, HTML y adjuntos), no solo los objetos de `_storage`. Una copia compartida al expediente es un registro distinto (C2). |
| **C2** | Las **copias compartidas no son caché**                                                                                           | Una copia compartida al expediente se guarda para el registro destino, no para el buzón: no cuenta en `cacheBytes`, no la tocan el LRU, el barrido de caducidad ni «Vaciar caché», y sobrevive a la desconexión o borrado de la cuenta de correo. Su retención es la del destino (SPEC-0018).                       |
| **D2** | Visor **HTML saneado** con alternativa en texto plano                                                                             | Se muestra el HTML del correo en un iframe aislado, con el texto como respaldo.                                                                                                                                                                                                                                     |
| **F1** | Capacidad nueva **`viewMailbox`**                                                                                                 | Quien no la tenga no ve el módulo ni sus ajustes. Cada usuario solo accede a **su** buzón.                                                                                                                                                                                                                          |
| **G1** | Sincronización **bajo demanda** (al abrir el módulo, botón «Actualizar»)                                                          | Nunca se sincroniza por mirar una carpeta: se sincroniza al entrar y al pedirlo.                                                                                                                                                                                                                                    |
| **G2** | Sincronización automática **cada hora**                                                                                           | Cron horario que recorre las cuentas habilitadas **de usuarios activos**, secuencialmente y respetando límites del servidor.                                                                                                                                                                                        |

**Lectura de D2 para aprobación:** HTML saneado en el navegador (DOMPurify) y renderizado en `<iframe sandbox srcDoc>` con CSP que bloquea scripts y recursos remotos; si el mensaje no trae HTML, se muestra el texto. Si la intención era otra variante (por ejemplo, solo HTML sin alternativa), corregirlo antes de implementar.

### 2.1 Decisiones de producto confirmadas (2026-11-21)

- **`viewMailbox` por defecto:** `admin`, `manager` y `technician` lo tienen; `guest` no. Revocable desde la matriz de permisos.
- **Contraseña:** la contraseña de aplicación se guarda **cifrada** (AES-GCM) en `mailAccounts`, para que el cron renueve el token; nunca vuelve al navegador.
- **Caché:** 512 MB y 30 días por defecto, **configurables por usuario** en Ajustes (límite 128 MB–2 GB; retención 7–365 días).

---

## 3. Alcance

### Dentro

- Alta y prueba de **una cuenta Zimbra por usuario** desde Ajustes del taller.
- Descubrimiento de carpetas de correo y sincronización de cabeceras (asunto, remitente, fecha, tamaño, adjuntos, no leído).
- Listado paginado/local por carpeta, con búsqueda local por asunto y remitente.
- Descarga del RFC822 **al abrir** el mensaje, verificación de bytes, extracción MIME y descarte del original **en la caché** (solo se conservan las partes). Una copia compartida al expediente se rige por SPEC-0018.
- Visor de texto y HTML, lista de adjuntos y descarga individual.
- Caché LRU con límite y caducidad configurables por usuario (512 MB y 30 días por defecto).
- Sincronización manual y horaria, con estado y último error visibles.
- Aislamiento por usuario en todas las lecturas, escrituras y descargas.

### Fuera (fase 2 o nunca)

- Enviar, responder, reenviar, mover, borrar o marcar como leído. **Ninguna escritura en el buzón remoto.**
- Varias cuentas por usuario, cuentas compartidas o delegadas.
- Contactos, calendario, tareas o chat del servidor.
- Notificaciones push o bandeja del sistema.
- Búsqueda en el cuerpo de mensajes no descargados (solo cabeceras locales).
- Integración con IA (tools de resumen, clasificación o borradores). La fase 2 consumirá `mailBodies.text` con el mismo aislamiento por usuario.

**Frontera con el expediente:** una copia compartida a una incidencia, petición, equipo, manual o compra **no forma parte de la caché del buzón**. Su modelo, permisos y retención son de `SPEC-0018`; esta spec solo fija que no se cuenta en `cacheBytes`, no la expulsa el LRU, no la borra el barrido de caducidad ni «Vaciar caché», y no desaparece al desconectar o borrar la cuenta de correo.

---

## 4. Arquitectura

```
UI (React)                     Convex (VPS)                        Zimbra
──────────                     ────────────                        ──────
MailboxView                    mailAccounts (action) ─────────────► POST /service/soap
  ├─ carpetas                  mailSync (action/cron)  ───────────► Auth / GetFolder / Search / Sync
  ├─ lista (virtualizada)      mailBody (action)       ───────────► GetMsg + GET /service/content/get
  └─ visor + adjuntos          mailAttachments (action)
                               │
                               ├─ mailAccounts / mailFolders / mailHeaders
                               ├─ mailBodies / mailAttachments
                               └─ _storage (solo adjuntos; el RFC822 no se conserva)
```

- `src/lib/mailClient/` es **puro**: constructores y parsers SOAP, paginación, política de caché, normalización de cabeceras. Sin React, sin Convex, sin `any`.
- Las acciones de Convex resuelven identidad y capacidad, descifran credenciales y hacen `fetch`.
- El navegador solo ve datos ya normalizados y URLs de descarga emitidas tras comprobar propiedad.

### 4.1 Ficheros nuevos previstos

```
src/lib/mailClient/
  soap.ts            # envoltorio SOAP 1.2 y contexto authToken
  folders.ts         # GetFolder: parseo y filtro de carpetas de correo
  search.ts          # Search: construcción, paginación y mapeo de <m>
  sync.ts            # Sync: ids anidados, borrados, token y more
  getMessage.ts      # GetMsg: construcción y extracción de content@url
  errors.ts          # faults, clasificación y reintentos
  cache.ts           # presupuesto LRU, caducidad y cálculo de espacio
  xml.ts             # utilidades XML compartidas
  auth.ts            # parseo puro de AuthResponse
  account.ts         # normalización del buzón y límites de caché
  types.ts           # tipos compartidos (sin any)
src/convex/
  mailAccounts.ts    # alta, prueba, estado, ajustes y borrado de la cuenta
  mailSync.ts        # sincronización inicial/incremental, manual y programada
  mailHeaders.ts     # consultas del listado, búsqueda y contadores
  mailBody.ts        # descarga + verificación + parseo MIME + una sola copia en caché
  mailAttachments.ts # listado y URL de descarga con comprobación de propiedad
  mailCache.ts       # barrido diario y purga manual
src/pages/dashboard/mailbox/
  MailboxView.tsx
  components/ (FolderTree, MessageList, MessageViewer, AttachmentList, HtmlFrame)
  hooks/ (useMailbox, useMailSelection, useMessageBody)
  types.ts
src/pages/dashboard/settings/
  MailboxCard.tsx
tests/
  mailClient.test.ts
  mailCache.test.ts
  mailAccounts.test.ts
  workshopSettingsView.test.tsx
  mailSync.test.ts
  mailBody.test.ts
  mailboxView.test.tsx
  fixtures/mail/auth.xml
```

---

## 5. Modelo de datos (Convex)

Todas las tablas llevan `userId` y **toda** consulta filtra por él. `accountId` permite el día de mañana tener más de una cuenta sin cambiar el modelo.

### 5.1 `mailAccounts` — una fila por usuario

| Campo                                     | Tipo                                                           | Notas                                                                                                                                          |
| ----------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `userId`                                  | `Id<"users">`                                                  | único por índice compuesto                                                                                                                     |
| `email`                                   | `string`                                                       | buzón completo (`usuario@rtva.es`); el servidor rechaza el usuario suelto                                                                      |
| `serverUrl`                               | `string`                                                       | **fijo** `https://hermes.rtva.es`; no editable (evita SSRF)                                                                                    |
| `password`                                | `string?`                                                      | **se guarda cifrada** con AES-GCM (`secretCrypto`) mientras la cuenta está conectada; se borra al desconectar y nunca se devuelve al navegador |
| `passwordHint`                            | `string?`                                                      | últimos 4 caracteres                                                                                                                           |
| `authToken`                               | `string?`                                                      | cifrado; se reutiliza mientras le queden > 6 h                                                                                                 |
| `tokenExpiresAt`                          | `number?`                                                      | `now + lifetime`                                                                                                                               |
| `status`                                  | `"disconnected" \| "connected" \| "reauthRequired" \| "error"` | `reauthRequired` cuando `account.AUTH_FAILED`                                                                                                  |
| `enabled`                                 | `boolean`                                                      | apaga la sincronización horaria sin borrar la caché                                                                                            |
| `cacheLimitBytes`                         | `number`                                                       | por defecto 512 MB; configurable entre 128 MB y 2 GB                                                                                           |
| `cacheRetentionDays`                      | `number`                                                       | por defecto 30; configurable entre 7 y 365 días                                                                                                |
| `cacheBytes`                              | `number`                                                       | total persistido (cuerpo + adjuntos); mantenido al escribir y al expulsar                                                                      |
| `cacheBodyBytes` / `cacheAttachmentBytes` | `number`                                                       | desglose para la pantalla de ajustes                                                                                                           |
| `lastSyncAt` / `lastSyncOkAt`             | `number?`                                                      | control del cron y de la UI                                                                                                                    |
| `syncLeaseUntil`                          | `number?`                                                      | evita dos pasadas simultáneas sobre la misma cuenta (una sola sesión por cuenta); lease renovable de 15 min                                    |
| `lastSyncError`                           | `string?`                                                      | mensaje saneado + `Trace` del fault, sin cuerpos ni asuntos                                                                                    |
| `createdAt` / `updatedAt`                 | `number`                                                       |                                                                                                                                                |

Índices: `by_user`, `by_enabled`.

### 5.2 `mailFolders`

`userId`, `accountId`, `remoteId`, `parentRemoteId?`, `name`, `path`, `kind` (atributo `view` tal cual), `isMail`, `syncEnabled`, `unread`, `total`, `size`, `syncToken?`, `lastSyncAt?`, `lastError?`, `sortOrder`.

Índices: `by_account`, `by_account_remote` (`accountId` + `remoteId`), `by_account_path`.

Regla de correo (referencia §4.1): `view === "message"` **o** `view` ausente. Si falta, se trata como correo **salvo** nombres de tipo no-mensaje conocidos: `Fuentes RSS` y variantes RSS se excluyen siempre; `Trash` y `Personales` se aceptan sin `view`, y `Archive` se acepta porque trae `message`. Los tipos `appointment`, `contact`, `task` y `document` (`Calendar`, `Contacts`, `Briefcase`, `Notes`, `Tasks`) quedan fuera. El mapa de exclusión vive en `src/lib/mailClient/folders.ts`.

### 5.3 `mailHeaders` — el índice que pinta la lista

`userId`, `accountId`, `folderRemoteId`, `messageId`, `conversationId?`, `subject`, `fromName`, `fromAddress`, `toSummary?`, `date`, `size` (tamaño RFC822 que reporta `Search`), `flags` (`a` adjuntos, `u` no leído), `hasAttachments`, `snippet`, `bodyState` (`"none" \| "cached" \| "tooLarge" \| "error"`), `cachedAt?`, `lastOpenedAt?`, `cachedBytes?`, `deletedRemoteAt?`.

`cachedBytes` es el total del mensaje en caché (cuerpo + adjuntos): permite expulsarlo sin sumar sus partes.

Índices:

- `by_user_folder_date` (`userId`, `folderRemoteId`, `date`) — listado de una carpeta.
- `by_user_message` (`userId`, `accountId`, `messageId`) — identidad estable del mensaje y aislamiento por usuario.
- `by_user_cached` (`userId`, `bodyState`, `cachedAt`) — barrido y métricas.
- `by_user_last_opened` (`userId`, `lastOpenedAt`) — orden de expulsión LRU.

Un mensaje que cambia de carpeta actualiza `folderRemoteId`; su id no cambia. El atributo `l` de cada `<m>` de `Search` es la carpeta actual: si no coincide con la consultada, se actualiza `folderRemoteId`. Los borrados remotos se marcan con `deletedRemoteAt` y se ocultan del listado (no se borra la fila en la misma pasada, para que una página obsoleta de `Search` no lo resucite).

### 5.4 `mailBodies`

`userId`, `accountId`, `messageId`, `text` (≤ 64 KB, truncado con bandera), `textTruncated`, `html?` (≤ 512 KB, truncado con bandera), `htmlTruncated`, `bodyBytes` (bytes UTF-8 persistidos de `text` + `html`), `parsedAt`.

Índice: `by_user_message` (`userId`, `messageId`). **Esta tabla no guarda el RFC822 ni una copia del HTML con imágenes incrustadas**: `bodyBytes` es el contenido que ocupa y se cuenta en el presupuesto de la caché.

### 5.5 `mailAttachments`

`userId`, `accountId`, `messageId`, `partIndex`, `filename?` (puede faltar en una imagen `cid:` sin nombre), `contentType`, `size` (bytes ya decodificados), `contentId?`, `inline` (parte referenciada por `cid:`), `storageId`, `createdAt`.

Índice: `by_user_message`. Se incluyen los adjuntos inline con nombre y las imágenes `cid:` aunque no lo tengan (la referencia avisa de que muchas librerías omiten los inline); todas se guardan **una sola vez** como objeto y el visor las referencia por su URL. Las que solo son recurso `cid:` no aparecen en la lista de descargas.

### 5.6 `_storage`

- **En la caché, solo adjuntos**: un objeto por parte adjunta, ya decodificada (incluidas las imágenes inline referenciadas por `cid:`).
- **En la caché del buzón el RFC822 no se guarda**: se descarga en memoria, se verifica contra `s`, se parsea y se descarta. Guardarlo junto a sus adjuntos y su cuerpo sería la duplicación que esta spec evita. Una copia compartida al expediente puede conservar el `.eml`; es otro registro, no esta caché.
- El espacio de los adjuntos se contabiliza en `mailAccounts.cacheBytes`; la expulsión borra los objetos y sus filas.
- `storageCleanup` no los toca mientras `mailAttachments` los cite; el test comprueba que el barrido de huérfanos los ve.
- **Las copias compartidas no son adjuntos de la caché.** Una copia compartida al expediente (SPEC-0018) es otro registro, aunque conserve un `.eml`: no se suma a `mailAccounts.cacheBytes`, no la expulsa el LRU, no la borra el barrido de caducidad ni «Vaciar caché». Su ciclo y retención son del destino (SPEC-0018).

---

## 6. Contrato con Zimbra (resumen operativo)

Todas las peticiones SOAP van a `POST /service/soap` con `Content-Type: text/xml; charset=utf-8`, sobre SOAP 1.2, y `Accept-Encoding: gzip`. `AuthRequest` no lleva contexto; el resto, `<context><authToken>…</authToken></context>` en la cabecera.

| Operación          | Uso               | Reglas que no se negocian                                                                                                                                                                                                                                                                                                                         |
| ------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AuthRequest`      | Abrir sesión      | `account by="name"` con el buzón completo; una sola petición por sesión; `lifetime` en ms                                                                                                                                                                                                                                                         |
| `GetFolderRequest` | Árbol             | Resolver por nombre/ruta, nunca por id fijo; `view` puede faltar                                                                                                                                                                                                                                                                                  |
| `SearchRequest`    | Cabeceras         | `types="message"`, `limit=500`; bucle por `offset` mientras `more="1"` o la página traiga exactamente 500, y se para en `more="0"` o página incompleta; **`dateAsc` para el recorrido completo** (inicial e incremental); el listado se ordena localmente por `date` desc; `after:` solo `M/D/AAAA`; `in:"/Inbox"` con las comillas como `&quot;` |
| `SyncRequest`      | Borrados y token  | `l` = carpeta, `msgCutoff="0"`, `changeLimit="1000"`, `deleteLimit="1000"`; ids en `<folder><m ids>`; borrados en `<deleted><m ids>` o `ids` directo en `<deleted>`; `token` en la respuesta; `more="1"` se itera; sin metadatos                                                                                                                  |
| `GetMsgRequest`    | Preparar descarga | `read="0"` **siempre**, `raw="1"`, `useContentUrl="1"`; **no** se usa `raw="0"` para metadatos (devuelve `<su>` vacío)                                                                                                                                                                                                                            |
| Content servlet    | RFC822            | URL devuelta tal cual (si es relativa, se resuelve contra el origen fijo sin cambiar path ni query); cookie `ZM_AUTH_TOKEN`; comparar bytes con `s`; no validar `Content-Length` ni `Content-Type` (la respuesta es _chunked_ y `text/plain`)                                                                                                     |

- **Timeout:** 10 s conexión, 60 s SOAP, 180 s descarga.
- **Reintentos:** 3 con espera 1 s / 4 s / 15 s + jitter en timeouts, 408, 425, 429 y 5xx **sin fault de negocio**; `Retry-After` manda. Nunca se reintentan `account.AUTH_FAILED`, 403, 404, `service.INVALID_REQUEST`, `mail.QUERY_PARSE_ERROR` ni `mail.NO_SUCH_PART`. Un 500 con `soap:Fault` se clasifica por su `<Code>` antes de decidir. La única excepción es el 401 del servlet: se renueva el token una vez y se repite una vez la descarga (ver §0.1).
- **`account.AUTH_FAILED` es ambiguo** (contraseña, cuenta o formato del identificador): se reporta tal cual, se pide la contraseña de aplicación y no se prueban variantes (`DOMINIO\usuario` ni el usuario suelto).
- **Token ausente o caducado** (`AUTH_REQUIRED` / `AUTH_EXPIRED`): renovar con la contraseña cifrada y repetir **una** vez.
- **Token de carpeta inválido** (`INVALID_SYNC_TOKEN`): vaciar `syncToken` y reindexar esa carpeta sin borrar cuerpos.
- **Límite por mensaje:** 50 MB configurable, **decisión de 0017** (la guía del cliente también usa 50 MB); por encima se marca `tooLarge` y no se descarga. La referencia solo verifica entregas de hasta 25 690 819 B y aclara que el límite de 10 MB afecta únicamente al contenido incrustado en SOAP, no al servlet.
- **Nunca** se usa el contenido incrustado de SOAP (`raw=1` sin `useContentUrl`): pierde bytes.

La lógica de protocolo se implementa en `src/lib/mailClient/` con fixtures XML reales (incluidos fault, `more="1"`, ids anidados y `view` ausente).

---

## 7. Sincronización

### 7.1 Primera sincronización (por cuenta)

1. **Comprobar que el usuario sigue activo** (`users.active !== false`); si está de baja, no se toca la cuenta ni se hace ninguna petición. Tomar el **lease** de sincronización de la cuenta (`syncLeaseUntil`); si otra pasada lo tiene, abandonar sin hacer peticiones. Descifrar contraseña/token; reutilizar el token si le quedan > 6 h y, si no, `AuthRequest` (una sola por pasada). Si faltara la contraseña y el token no sirviera, la cuenta pasa a `reauthRequired` y no se reintenta.
2. `GetFolder` → upsert de `mailFolders` (solo correo) con conteos del servidor.
3. Por carpeta habilitada: `Search` paginado (`offset += 500`, `sortBy="dateAsc"`) mientras `more="1"` o la página traiga 500; upsert de `mailHeaders`; guardar conteos.
4. `Sync` sin token para obtener el token inicial; devuelve todos los ids actuales (se ignoran porque `Search` ya trajo las cabeceras) y los borrados; si trae `more="1"`, se itera antes de guardar el token.

### 7.2 Sincronización incremental

«Incremental» aquí significa que **no se descargan cuerpos** y que se escriben solo las cabeceras que cambian; el recorrido de cada carpeta es completo porque el delta de `Sync` no trae metadatos (referencia §4.3, guía §5.1).

1. Por carpeta: `Sync(token)` → ids cambiados, ids borrados, token nuevo y conteos. Los ids cambiados no traen metadatos: se usan solo como señal; el refresco real es el `Search` completo del punto 3.
2. Los borrados se marcan `deletedRemoteAt` y se ocultan del listado; **no se borra la caché en el acto**: queda sujeta al LRU y a la caducidad de 30 días, para que un delta erróneo no destruya contenido ya descargado (criterio de la guía §5.3, adaptado a que la caché no guarda `.eml`).
3. Se recorre la carpeta con `Search` **completo** (`sortBy="dateAsc"`, páginas de 500 mientras `more="1"` o la página venga llena); se compara con lo local y se escribe solo lo que cambia (upsert de las nuevas): asunto, remitente, fecha, tamaño, flags, `l` (posibles movimientos) y mensajes nuevos. Cada id devuelto por el recorrido se acumula como visto en esta pasada; si reaparece uno marcado, el upsert limpia `deletedRemoteAt`. No se descarga ningún cuerpo. La referencia mide 1 554 cabeceras de 9 carpetas en 5,4 s y ~13 peticiones.
4. Solo si el recorrido completo termina se marcan como `deletedRemoteAt` las cabeceras de esa carpeta cuyos ids no estén en el conjunto visto en **esta** pasada (`MarkMissing` de la guía §5.1). Si el mensaje había cambiado de carpeta, el upsert de la carpeta destino limpia la marca; si la carpeta destino no se sincroniza, se queda oculto. Un corte no marca ausentes ni avanza el token.
5. Si la respuesta de `Sync` trae `more="1"`, se itera (procesando también los ids de cada página) antes de dar la carpeta por sincronizada y guardar el token.
6. El token **solo avanza** cuando la escritura de esa carpeta ha terminado. Un corte deja la carpeta como estaba y la siguiente pasada no duplica nada (upsert por `accountId + messageId`).
7. Reconciliación manual («Reindexar carpeta»): repite el recorrido completo sin token y recalcula contadores; nunca borra cuerpos ya descargados que sigan citados.

### 7.3 Disparadores

| Disparador         | Comportamiento                                                                                                                                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Abrir el módulo    | Si `lastSyncAt` tiene más de 10 min, sincroniza en segundo plano y muestra el estado                                                                                                                                                                                |
| Botón «Actualizar» | Sincroniza la cuenta completa (o solo la carpeta activa, a elección del usuario)                                                                                                                                                                                    |
| Cron horario       | `crons.hourly` en el minuto 20; lee las cuentas `enabled` **cuyo usuario sigue activo** (`users.active !== false`), salta las sincronizadas hace < 50 min y **programa una acción por cuenta** espaciada 2 s; cada acción toma su lease y las carpetas van en serie |
| Primer alta        | Sincronización inicial completa con progreso visible                                                                                                                                                                                                                |

Cada pasada deja en la cuenta `lastSyncAt`, `lastSyncOkAt` y `lastSyncError`. La UI distingue «sin conexión», «credenciales caducadas» y «error del servidor».

**Baja de usuario:** la baja es lógica (`users.active = false`) y no toca `mailAccounts`; por eso el cron y la sincronización bajo demanda comprueban `users.active` antes de nada. Una cuenta de un usuario de baja no se sincroniza, no renueva token y no hace peticiones. La caché queda inaccesible y sujeta al barrido de 0017, que sigue aplicando la caducidad aunque el usuario no pueda entrar; las copias compartidas no se modifican.

### 7.4 Límites de carga

- Máximo **2 peticiones simultáneas** por cuenta; las carpetas se recorren en serie.
- El cron espacia las cuentas 2 s entre sí para no disparar el limitador por IP.
- Cada acción de cuenta tiene su propio presupuesto de 10 minutos; si no termina, la siguiente continúa desde la carpeta pendiente (se guarda `lastSyncAt` por carpeta).

---

## 8. Caché: una sola copia y presupuesto completo (C1)

**Regla de una sola copia.** En la caché del buzón, el RFC822 descargado es **efímero**: se mantiene en memoria durante la acción, se verifica contra `s`, se parsea y se descarta. No se escribe en el `_storage` de la caché ni en una fila de la caché. Lo que se persiste es exactamente el contenido ya separado:

| Qué                                                | Dónde                           | Bytes que cuenta                                          |
| -------------------------------------------------- | ------------------------------- | --------------------------------------------------------- |
| Texto y HTML del cuerpo                            | `mailBodies` (base de datos)    | `bodyBytes` = longitud UTF-8 real de `text` + `html`      |
| Adjuntos, incluidos los inline con nombre o `cid:` | `_storage`, un objeto por parte | `size` = bytes decodificados del adjunto                  |
| Cabeceras e índice                                 | `mailHeaders` / `mailFolders`   | **fuera del presupuesto** (no son caché y no se expulsan) |

No hay ninguna otra copia **en la caché del buzón**: el HTML guardado conserva las referencias `cid:` y el visor las resuelve **en tiempo de render** contra el adjunto ya guardado. No se incrustan imágenes como `data:` en el HTML persistido, porque eso duplicaría los mismos bytes.

Por eso `cachedBytes` no tiene por qué coincidir con el `size` de `Search`: los adjuntos se guardan decodificados (sin base64) y el cuerpo se guarda ya extraído, así que el total persistido suele ser menor que el RFC822 original, pero es el que ocupa de verdad y el que se cuenta.

**Presupuesto y contabilidad.**

- Límite: 512 MB por cuenta (configurable entre 128 MB y 2 GB). Retención: 30 días (configurable entre 7 y 365).
- `cacheBytes = Σ mailBodies.bodyBytes + Σ mailAttachments.size`; se mantiene también el desglose `cacheBodyBytes` / `cacheAttachmentBytes` para la pantalla de ajustes.
- `mailHeaders.cachedBytes` guarda el total del mensaje (cuerpo + adjuntos) para poder expulsarlo sin sumar sus partes.
- Los tres contadores se actualizan en la **misma transacción** que crea o borra las filas; una pasada de reconciliación recalcula el total si hay desajuste.
- La pantalla de ajustes muestra también el tamaño estimado del índice de cabeceras, que queda **fuera** del presupuesto porque no es caché y no se puede expulsar sin perder el listado. Así el consumo total es visible aunque solo el contenido descargado se someta a LRU.
- El presupuesto mide **bytes de contenido**; el overhead de filas e índices (pequeño y no evictable) se informa aparte, no se suma al LRU.

**Expulsión.**

- Unidad de expulsión: el **mensaje completo** (fila de `mailBodies`, sus adjuntos y sus objetos de `_storage`). Nunca se deja medio mensaje cacheado.
- Al abrir uno nuevo, se expulsan los mensajes con `lastOpenedAt` más antiguo hasta que `cacheBytes + cachedBytes(nuevo) ≤ 90 % del límite`. Si aun así no cabe (mensaje mayor que el límite, imposible con el tope de 50 MB), no se cachea y se muestra desde el texto descargado en memoria.
- Al cachear se fija `lastOpenedAt` y se actualiza en cada apertura; el barrido diario de las 04:45 elimina lo que supere los 30 días desde `lastOpenedAt` (o `cachedAt` si faltara) y reconcilia contadores.
- Un mensaje expulsado conserva su cabecera; al abrirlo se vuelve a descargar.

**Restos y huérfanos.** Si una apertura falla a mitad (por ejemplo, tras guardar dos adjuntos), la acción borra lo escrito antes de devolver el error, y el barrido diario elimina adjuntos sin fila o con `messageId` ya expulsado. `storageCleanup` no toca los adjuntos citados por `mailAttachments`; el test de integración lo comprueba.

**Nunca** se cachea un mensaje mayor de 50 MB ni uno cuyos bytes no coincidan con `s`.

### 8.1 Las copias compartidas no son caché

Una copia compartida al expediente (SPEC-0018) es un registro del destino, no un mensaje del buzón. Aunque se haya creado desde un mensaje, **no entra en el ciclo de la caché**:

- **No cuenta en `cacheBytes`** ni en `cacheBodyBytes` / `cacheAttachmentBytes`; el presupuesto de la cuenta sigue midiendo solo `mailBodies.bodyBytes` + `mailAttachments.size`.
- **No la expulsa el LRU**: la expulsión solo elige mensajes de `mailHeaders` con cuerpo cacheado; una copia compartida no es candidata.
- **No la borra el barrido de caducidad** de los 30 días: ese barrido solo mira `mailHeaders` / `mailBodies` / `mailAttachments` del buzón.
- **No la borra «Vaciar caché»**: esa acción vacía el contenido descargado de la cuenta, no los registros del expediente.
- **No se borra al desconectar ni al borrar la cuenta de correo**: la desconexión borra credenciales, token y, según la elección, la caché; la copia compartida sigue el ciclo del destino.
- **No se purga por la baja del usuario**: la baja detiene la sincronización y deja la caché inaccesible, pero no toca las copias ya compartidas.
- **Su retención es la del destino**, no los 30 días de la caché. El detalle está en SPEC-0018.

---

## 9. Visor (D2)

1. Al abrir, si `bodyState !== "cached"`, la acción descarga el RFC822, verifica `bytes.length === s` usando el `s` de `GetMsg` y contrastándolo con el de la cabecera si existe, lo parsea con `postal-mime` y **descarta el original en la caché**: solo persiste el cuerpo y los adjuntos. La copia compartida al expediente, si existe, es otro registro (SPEC-0018).
2. Se extraen: texto plano, HTML, y todas las partes con disposición `attachment`, con nombre de fichero **o** con `ContentId` (imágenes `cid:`, aunque no traigan nombre). Estas últimas se guardan como recurso del visor y no se listan como adjunto descargable si no tienen nombre.
3. Las imágenes `cid:` se guardan como adjuntos inline (`inline: true`) y el visor sustituye cada referencia por la URL de su objeto en `_storage` en el momento de renderizar; no se incrustan como `data:` en el HTML persistido. Las imágenes remotas se bloquean por defecto (privacidad), con un botón «Mostrar imágenes remotas» que añade `https:` a `img-src` solo para ese render.
4. El HTML se sanea en el navegador con DOMPurify (lista blanca; fuera `script`, `iframe`, `object`, `embed`, `base`, `form`, `link`, `meta`, atributos `on*` y `javascript:`). La CSP se inyecta **después** del saneado, para que el propio saneador no la elimine.
5. Se renderiza en `<iframe sandbox srcDoc>` con CSP `default-src 'none'; img-src data: <origen de _storage>; style-src 'unsafe-inline'; font-src data:` (el origen se inyecta desde la configuración, nunca desde el correo) y `color-scheme: light` forzado. Tras cargar, se aplica el ajuste de contraste de la guía §8.3 sobre el **fondo efectivo**, no solo sobre `body`. **No se usa `dangerouslySetInnerHTML`** (sigue prohibido fuera de `chart.tsx`).
6. Si no hay HTML, se muestra el texto en `<pre>`; si el HTML se truncó, se avisa y se ofrece el texto.
7. Cabecera del visor: asunto, remitente, fecha, tamaño, carpeta, adjuntos. Sin acciones de escritura.
8. Adjuntos: nombre, tipo y tamaño; la lista incluye los inline con nombre; descarga individual mediante acción que comprueba propiedad y devuelve una URL de `_storage` (la misma que usa el visor para las imágenes `cid:`).
9. Estados: cargando, error de descarga, mensaje demasiado grande, credenciales caducadas.

---

## 10. Ajustes e interfaz

### 10.1 Ajustes del taller → «Mi buzón»

Pestaña nueva (`WorkshopTabId = "mailbox"`), visible solo con `viewMailbox` y **siempre referida al usuario que la abre**:

- Servidor (fijo, solo lectura), cuenta (precargada con el correo del perfil), contraseña de aplicación (se guarda cifrada; nunca se muestra de vuelta).
- Botones «Probar conexión» (Auth + GetFolder, muestra nº de carpetas) y «Guardar».
- Estado: conectado / credenciales caducadas / error, con último intento.
- Sincronización: activar/desactivar, «Sincronizar ahora», último resultado.
- Caché: consumo, límite (128 MB–2 GB, por defecto 512 MB) y retención (7–365 días, por defecto 30), «Vaciar caché».
- «Desconectar» (borra credenciales y token; conserva o borra la caché según elección).

El administrador **no** puede leer ni configurar el buzón de otra persona: no hay pantalla de administración de buzones ajenos. Si un usuario pierde `viewMailbox`, sus datos quedan inaccesibles y la caché se purga en el siguiente barrido. **Las copias compartidas no se purgan con esa caché**: siguen el ciclo del registro destino y no dependen de que el usuario conserve `viewMailbox`.

### 10.2 Módulo «Correo»

- `NavId = "mailbox"`, etiqueta «Correo», icono `Mail`, badge con no leídos del servidor.
- `TAB_ACCESS_POLICY`: `{ kind: "capability", capability: "viewMailbox", staffOnly: true }`.
- `MODULE_META`: título «Correo» y descripción del buzón personal.
- La entrada de «Ajustes del taller» en el menú se muestra también a quien tenga `viewMailbox`.
- Tres paneles con `react-resizable-panels`: carpetas | lista | visor. Lista virtualizada con `@tanstack/react-virtual`.
- Móvil: un panel a la vez (carpetas → lista → visor) con botón atrás.
- Vacíos y errores explicados: sin cuenta configurada, sin carpetas, sin mensajes, credenciales caducadas, servidor no disponible.
- Búsqueda local por asunto/remitente dentro de la carpeta activa (sin tocar el servidor).

---

## 11. Permisos y seguridad

- **Capacidad `viewMailbox`** en `src/lib/permissions.ts`:
  - `admin`, `manager` y `technician`: concedida por defecto (el correo es una herramienta personal del taller).
  - `guest`: nunca.
  - Ajustable desde la matriz de permisos como cualquier otra capacidad.
- **Sujeto `Mailbox`** en `lib/abilities.ts` con acción `view`/`manage`, condicionado a `viewMailbox` y a `{ userId }`.
- Toda consulta, mutación o acción pública: identidad con `memberStatus`/`requireMailboxMember` (que parte de `getAuthUserId`), comprobación de capacidad y cuenta **del propio usuario**; nunca se acepta un `userId` del cliente.
- Credenciales y token cifrados con `secretCrypto` (AES-GCM); nunca vuelven al navegador; la UI solo ve pista y estado.
- `serverUrl` fijo: no hay peticiones a hosts arbitrarios (SSRF).
- TLS siempre verificado.
- Logs sin asuntos, direcciones, cuerpos ni tokens: solo ids, códigos y `Trace`.
- URL de descarga de adjunto emitida tras comprobar `userId` y `storageId`; se documenta que la URL de `_storage` es aleatoria pero estable, y por eso solo se entrega a su dueño. La misma URL resuelve las imágenes `cid:` en el visor; nunca se persiste una copia `data:` de ellas.
- Borrar la cuenta borra credenciales, carpetas, cabeceras, cuerpos y adjuntos de ese usuario.
- **Las copias compartidas no forman parte de la cuenta de correo.** No se borran al desconectar ni al borrar la cuenta, no se cuentan en `cacheBytes` y no las toca el LRU, el barrido de caducidad ni «Vaciar caché». Su ciclo y sus permisos son los del registro destino (SPEC-0018).
- Eventos en `securityAuditLog` para alta, cambio de credenciales, desconexión y vaciado de caché (sin datos del correo).
- `mailAccounts`, `mailFolders`, `mailHeaders`, `mailBodies` y `mailAttachments` son datos personales: se excluyen de exportaciones, del reset de datos de demostración y de cualquier volcado de depuración.

---

## 12. Dependencias (autorizadas por el usuario)

| Paquete           | Para qué                                                  | Dónde se usa                | Estado             |
| ----------------- | --------------------------------------------------------- | --------------------------- | ------------------ |
| `fast-xml-parser` | Parsear SOAP en el runtime de Convex (no hay `DOMParser`) | `src/lib/mailClient/`       | ✅ Instalado en F1 |
| `postal-mime`     | Parsear RFC822, texto, HTML, `cid:` y adjuntos            | Acción `mailBody` (y tests) | ✅ Instalado en F4 |
| `dompurify`       | Sanear HTML en el navegador                               | `HtmlFrame.tsx`             | ✅ Instalado en F4 |

F1 instaló `fast-xml-parser`. `postal-mime` y `dompurify` se instalaron en la fase 4; no hicieron falta tipos aparte. Las versiones quedan fijadas en `package.json`.

---

## 13. Plan de implementación

| Fase                      | Entregable                                                                                                                                            | Criterio de salida                                                                                                                                                     | Tamaño       | Estado                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------ |
| **0. Base pura**          | `fast-xml-parser`; `mailClient/` con builders/parsers, paginación, política de caché y fixtures XML                                                   | `tests/mailClient.test.ts` y `tests/mailCache.test.ts` en verde; `tsc` sin errores                                                                                     | 1 sesión     | ✅ F1 cerrada                                                |
| **1. Cuenta y carpetas**  | Tablas, `mailAccounts`, ajustes «Mi buzón», capacidad `viewMailbox`, `GetFolder` y prueba de conexión                                                 | Alta y prueba de conexión con fixtures; la prueba real contra Hermes es puerta de F3; aislamiento entre dos usuarios probado                                           | 1–2 sesiones | ✅ F2 cerrada; prueba real en F3                             |
| **2. Cabeceras**          | `Search` paginado, upsert, listado virtualizado, contadores, búsqueda local y módulo «Correo» (`NavId`, `MODULE_META`, `TAB_ACCESS_POLICY`, renderer) | 1 554 cabeceras < 30 s (medido en la referencia: 5,4 s); 0 cuerpos descargados; segunda pasada sin duplicados                                                          | 1–2 sesiones | ✅ Backend, vista, lista y paginación; prueba real pendiente |
| **3. Incremental y cron** | `Sync` (borrados + token), reanudación, reconciliación, cron horario y estado                                                                         | Delta de Archive `41 → 0`; token inválido reinicia sin perder datos; cron corre y salta cuentas al día **y las de usuarios de baja**                                   | 1–2 sesiones | ✅ Backend y tests; prueba real pendiente                    |
| **4. Cuerpo y visor**     | `postal-mime` y `dompurify`; `GetMsg` + servlet, verificación de bytes, MIME, una sola copia, HTML saneado, texto, `cid:`                             | Bytes = `s`; el RFC822 no queda almacenado; 4 adjuntos visibles; sin cambios de leído en el webmail                                                                    | 2 sesiones   | ✅ Implementada; prueba real pendiente                       |
| **5. Adjuntos y caché**   | Extracción y descarga de adjuntos, LRU configurable (512 MB/30 días por defecto), barrido diario, «Vaciar caché»                                      | Expulsión correcta contando cuerpo y adjuntos; descarga posterior sin volver a bajar el mensaje; **ninguna copia compartida entra en el presupuesto ni en el barrido** | 1–2 sesiones | ✅ Implementada; prueba real pendiente                       |
| **6. Cierre**             | Tests de seguridad/arquitectura, `tsc`, docs (`0010`, `0013`, `0015`, `0016`, esta spec) y revisión de `storageCleanup`                               | Suite relevante en verde; sin regresiones en `tests/arquitectura.test.ts` ni `tests/seguridad.test.ts`                                                                 | 1 sesión     | Pendiente                                                    |

F1 y F2 están cerradas. F3 y F4 están implementadas de extremo a extremo en código: cabeceras, vista, lista virtualizada, paginación, descarga y verificación de cuerpos, MIME, visor HTML saneado en iframe, adjuntos, LRU, caducidad, «Vaciar caché» y barrido diario. Solo queda la validación real contra Hermes (1 554 cabeceras, apertura y adjuntos de un mensaje, segunda pasada y token).

Total orientativo: **8–11 sesiones de trabajo**; F1/F2 están cerradas y F3/F4 implementadas salvo la prueba real. Cada fase termina con algo usable y verificable; no se empieza la siguiente sin su criterio de salida.

---

## 14. Criterios de aceptación

- **CA-001 — Alta y aislamiento**
  - **Dado** un usuario con `viewMailbox`
  - **Cuando** guarda su cuenta y otro usuario abre el módulo
  - **Entonces** cada uno ve solo su buzón; ninguna consulta, cuerpo, adjunto ni URL cruza de un usuario a otro, y el segundo no puede leer las credenciales del primero.
- **CA-002 — Sincronización inicial**
  - **Dado** un buzón con 1 554 mensajes en 9 carpetas de correo
  - **Cuando** se sincroniza por primera vez
  - **Entonces** hay 1 554 cabeceras, **0** cuerpos descargados y tarda menos de 30 s.
- **CA-003 — Incremental**
  - **Dado** un buzón ya sincronizado sin cambios
  - **Cuando** corre la pasada horaria
  - **Entonces** no se duplica ninguna cabecera, no se descarga ningún cuerpo y el token de cada carpeta avanza.
- **CA-004 — Borrados**
  - **Dado** un mensaje borrado en el webmail
  - **Cuando** se sincroniza
  - **Entonces** desaparece de la lista (tumba `deletedRemoteAt`), su caché no se borra en el acto y queda sujeta al LRU y a la caducidad, sin afectar a los demás.
- **CA-005 — Solo lectura**
  - **Dado** un mensaje no leído
  - **Cuando** se abre en el módulo
  - **Entonces** el webmail lo sigue mostrando como no leído y no cambia de carpeta.
- **CA-006 — Integridad**
  - **Dado** un mensaje de 2 625 302 B
  - **Cuando** se descarga
  - **Entonces** los bytes coinciden exactamente con `s`; si no coinciden, no se cachea y se informa del error. Tras el parseo, el RFC822 no queda almacenado.
- **CA-007 — Adjuntos**
  - **Dado** un mensaje con 4 adjuntos, algunos inline con nombre
  - **Cuando** se abre
  - **Entonces** se listan los 4 y cada uno se descarga con su nombre y tipo.
- **CA-008 — Caché sin duplicación**
  - **Dado** un mensaje con adjuntos abierto y cacheado
  - **Cuando** se inspecciona el almacenamiento y el presupuesto
  - **Entonces** no existe ningún objeto con el RFC822 completo; el mensaje ocupa la suma de sus adjuntos decodificados y su `bodyBytes`, ambos incluidos en `cacheBytes`, y al superar el límite configurado (512 MB por defecto) se expulsan primero los mensajes menos usados respetando el 90 % y conservando las cabeceras.
- **CA-009 — Caducidad**
  - **Dado** un cuerpo abierto hace más de 30 días
  - **Cuando** corre el barrido diario
  - **Entonces** se borra su caché y el mensaje se puede volver a abrir bajo demanda.
- **CA-010 — Credenciales**
  - **Dado** una contraseña caducada
  - **Cuando** la sincronización recibe `account.AUTH_FAILED`
  - **Entonces** la cuenta pasa a `reauthRequired`, no se reintenta en bucle y la UI pide la nueva contraseña.
- **CA-011 — HTML**
  - **Dado** un correo con HTML y otra versión en texto
  - **Cuando** se abre
  - **Entonces** el HTML se muestra saneado en un iframe sin scripts, sin recursos remotos y con texto legible en modo claro; si el HTML falta, se muestra el texto.
- **CA-012 — Permisos**
  - **Dado** un usuario sin `viewMailbox`
  - **Cuando** entra al panel
  - **Entonces** no ve el módulo ni la pestaña de ajustes, y cualquier acción directa le devuelve un error de permiso.
- **CA-013 — Imágenes `cid:` sin copia doble**
  - **Dado** un correo con imágenes inline referenciadas por `cid:`
  - **Cuando** se abre y se inspecciona lo guardado
  - **Entonces** cada imagen existe solo como objeto de `mailAttachments`; el HTML persistido conserva `cid:` y el visor lo resuelve a la URL del objeto, sin `data:` en la fila.
- **CA-014 — Movimientos y reapariciones**
  - **Dado** un mensaje que cambia de carpeta en el webmail o se restaura
  - **Cuando** se sincroniza
  - **Entonces** su cabecera se actualiza a la carpeta nueva, no se duplica y no queda marcada como borrada al terminar la pasada (siempre que la carpeta destino se sincronice).
- **CA-015 — Baja de usuario**
  - **Dado** un usuario con cuenta de correo conectada
  - **Cuando** se le da de baja (`users.active = false`)
  - **Entonces** el cron no sincroniza su cuenta, no renueva token ni hace peticiones; la caché queda inaccesible y sujeta al barrido; las copias compartidas no se modifican.

### 14.1 Verificación automatizada

| Área                                                           | Tests                                                                                                                                    | Estado         |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Parsers SOAP y fixtures                                        | `tests/mailClient.test.ts`                                                                                                               | ✅ F1          |
| Política de caché (LRU, caducidad, presupuesto)                | `tests/mailCache.test.ts`                                                                                                                | ✅ F1          |
| Cuenta, cifrado y aislamiento                                  | `tests/mailAccounts.test.ts`                                                                                                             | ✅ F2          |
| Ajustes «Mi buzón» y permisos                                  | `tests/workshopSettingsView.test.tsx`, `tests/workshopSettingsViewHelpers.test.ts`, `tests/abilities.test.ts`, `tests/navConfig.test.ts` | ✅ F2          |
| Paginación, token, borrados y reanudación con `fetch` simulado | `tests/mailSync.test.ts`                                                                                                                 | ✅ F3 backend  |
| Bytes, MIME y extracción de adjuntos                           | `tests/mailBody.test.ts`                                                                                                                 | Pendiente (F4) |
| Vista, lista virtualizada, estados y paginación                | `tests/mailboxView.test.tsx`, `tests/mailHeaders.test.ts`                                                                                | ✅ F3          |
| Visor de cuerpo, MIME, HTML y `cid:`                           | `tests/mailBody.test.ts`                                                                                                                 | Pendiente (F4) |
| Baja de usuario en el cron                                     | `tests/mailSync.test.ts`                                                                                                                 | ✅ F3 backend  |
| Reglas del repositorio                                         | `tests/arquitectura.test.ts`, `tests/seguridad.test.ts`                                                                                  | ✅             |

Comandos de cierre por fase: `npm run typecheck`, `npx vitest run <tests tocados>` y, al final, `npm run security:check`.

---

## 15. Riesgos y límites conocidos

| Riesgo                                                                               | Impacto                                                                  | Mitigación                                                                                                                            |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| El token dura ~48 h y hay una sesión por cuenta                                      | El cron se queda sin sesión                                              | Contraseña de aplicación cifrada para renovar; estado `reauthRequired` claro                                                          |
| El delta no trae metadatos                                                           | No se pueden actualizar cabeceras por id                                 | `Search` completo de cada carpeta en cada pasada (5,4 s medidos para 1 554); `Sync` solo para borrados y token                        |
| Refresco completo de cabeceras cada hora                                             | Carga y ancho de banda (~13 peticiones, 100–300 KB por página)           | Coste medido 5,4 s para 1 554; cuentas en serie, 2 peticiones y lease; si crece, se baja la frecuencia por carpeta                    |
| La referencia se contradice sobre `SearchResponse.total` (§4.2 frente a §9/C5)       | Contadores engañosos si se usa                                           | Paginar por página/`more`; contar con `n` de carpeta y con lo local; ignorar `total`                                                  |
| Limitación por IP del servidor                                                       | 429/503 intermitentes                                                    | ≤ 2 peticiones simultáneas, cuentas en serie, espera creciente                                                                        |
| 512 MB de caché por usuario por defecto (adjuntos en `_storage` + cuerpos en Convex) | Espacio en NAS y cuota de documentos                                     | Presupuesto configurable que cuenta cuerpo + adjuntos, LRU, barrido y desglose visible                                                |
| Cuerpos en la base, no en `_storage`                                                 | La cuota de documentos de Convex crece con lo abierto                    | `bodyBytes` acotado (64 KB texto / 512 KB HTML) y contado en el presupuesto; el barrido lo libera                                     |
| HTML de correo pesado o malicioso                                                    | Lentitud o fuga                                                          | Saneado, iframe con `sandbox`, CSP, imágenes remotas bloqueadas                                                                       |
| Correo con 2FA                                                                       | `AUTH_FAILED` ambiguo                                                    | Instrucción de usar contraseña de aplicación; nunca probar variantes de usuario                                                       |
| Cambios en el servidor                                                               | Ruptura silenciosa                                                       | Fixtures + comprobaciones C1–C12 de la referencia en integración                                                                      |
| Datos personales en Convex                                                           | Privacidad                                                               | Aislamiento por `userId`, sin logs de contenido, borrado al desconectar                                                               |
| Baja de usuario con cuenta activa                                                    | El cron seguiría sincronizando un buzón sin acceso                       | El cron y la sincronización bajo demanda comprueban `users.active`; la baja detiene la sincronización sin tocar `mailAccounts`        |
| Confundir copia compartida con caché                                                 | El LRU, la caducidad o «Vaciar caché» borrarían evidencia del expediente | La copia compartida queda fuera de `cacheBytes`, del LRU, del barrido y de «Vaciar caché»; su retención es la del destino (SPEC-0018) |

---

## 16. Autorización de implementación

La aprobación de esta spec autoriza a:

1. Instalar `fast-xml-parser`, `postal-mime` y `dompurify` (y sus tipos si hacen falta).
2. Añadir cinco tablas (`mailAccounts`, `mailFolders`, `mailHeaders`, `mailBodies`, `mailAttachments`), sus índices y la capacidad `viewMailbox`.
3. Añadir el cron horario de sincronización y el barrido diario de caché, con comprobación de `users.active` para no sincronizar cuentas de usuarios de baja.
4. Crear el módulo «Correo», la pestaña «Mi buzón» en Ajustes y ampliar `NavId`, `MODULE_META`, `TAB_ACCESS_POLICY` y `DashboardTabRenderer`.
5. Escribir en `_storage` **solo los adjuntos** (incluidos los inline) y en `mailBodies` el cuerpo parseado; en la caché del buzón, el RFC822 se descarta tras verificarlo. El presupuesto por defecto de 512 MB cuenta cuerpo y adjuntos y es configurable por usuario.
6. Actualizar las specs `0010`, `0013`, `0015` y `0016` cuando la implementación esté cerrada.

**Límite con SPEC-0018:** esta spec no implementa las copias compartidas al expediente; solo deja fijado que, cuando existan, no forman parte de la caché del buzón, no se suman a `cacheBytes`, no las tocan el LRU, el barrido de caducidad ni «Vaciar caché», y no se borran al desconectar o borrar la cuenta de correo. Su modelo, permisos y retención son de SPEC-0018.

**Decisiones de producto confirmadas (2026-11-21):**

- `technician` tiene `viewMailbox` por defecto, revocable desde la matriz de permisos.
- La contraseña de aplicación se guarda cifrada en la aplicación para que el cron renueve el token.
- La caché usa 512 MB y 30 días por defecto, configurables por usuario en Ajustes.
- La baja de un usuario (`users.active = false`) detiene la sincronización de su cuenta: el cron y la sincronización bajo demanda comprueban el estado del usuario antes de tocar `mailAccounts`.
- Las copias compartidas al expediente **no son caché**: no cuentan en `cacheBytes`, no las toca el LRU, el barrido de caducidad ni «Vaciar caché», y no se borran al desconectar o borrar la cuenta de correo. Su retención es la del destino (SPEC-0018).

F1/F2 están cerradas y F3 está implementada (backend, vista, lista virtualizada y paginación por offset). Queda la validación real contra Hermes y las fases 4–6.
