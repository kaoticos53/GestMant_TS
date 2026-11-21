# SPEC-0018 — Copias compartidas de correo al expediente

- **ID:** `SPEC-0018`
- **Título:** Copias de correo compartidas con incidencias, peticiones, equipos, manuales y compras: privacidad, visibilidad, retención y ciclo de vida
- **Estado:** **Aprobada — 2026-11-21.** La aprobación la dio expresamente el usuario en la conversación de esa fecha. F5 y F6 cerradas (esquema, compartición, sección en fichas, descargas, retención y huérfanas); F7 con backup, restauración y reset de las copias implementados. Queda el cierre de F7 (documentación y hardening) y el pilotaje de F8.
- **Fecha:** 2026-11-21
- **Fuentes clave:** `SPEC-0017` (buzón y caché), `SPEC-0002` (roles y capacidades), `SPEC-0004` (incidencias), `SPEC-0005` (equipos), `SPEC-0007` (peticiones), `SPEC-0008` (compras), `SPEC-0009` (manuales), `SPEC-0011` (papelera y almacenamiento), `SPEC-0013` (auditoría), `SPEC-0016` (modelo de datos), `src/lib/permissions.ts`, `src/lib/abilities.ts`, `src/convex/permissions.ts`, `src/convex/schema.ts`, `src/convex/incidents.ts`, `src/convex/partRequests.ts`, `src/convex/equipment.ts`, `src/convex/manuals.ts`, `src/convex/purchasing.ts`, `src/convex/trash.ts`, `src/convex/audit.ts`, `src/convex/workshopBackup.ts`, `src/convex/workshopReset.ts`, `src/convex/storageCleanup.ts`
- **Dependencia:** `SPEC-0017` está aprobada y su visor y descarga (F4) están implementados; esta spec quedó aprobada el 2026-11-21, con lo que la puerta de F5 está abierta. Esta spec no implementa el buzón ni su caché.

---

## 0. Autoridad documental y frontera con SPEC-0017

`SPEC-0017` decide el buzón personal, la descarga del RFC822, la caché LRU y su purga. Esta spec decide **qué ocurre cuando un mensaje se comparte con un registro del taller**. No se solapan:

| Materia                                                                | Documento que manda            | Regla                                                                                               |
| ---------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------- |
| Cuenta Zimbra, SOAP, cabeceras, visor, caché, LRU y «Vaciar caché»     | `SPEC-0017`                    | La caché es del buzón y se purga con él.                                                            |
| Copia compartida con una incidencia, petición, equipo, manual o compra | esta `SPEC-0018`               | La copia es un registro del destino, no una entrada de caché.                                       |
| Permisos de módulos y roles                                            | `SPEC-0002`                    | Se reutilizan las capacidades existentes; se añade solo `createIncidentFromMail`.                   |
| Papelera, retención y limpieza de `_storage`                           | `SPEC-0011`                    | La retención de la copia sigue la del destino; las huérfanas tienen su propio plazo administrativo. |
| Auditoría de seguridad                                                 | `SPEC-0013`                    | Solo el administrador lee `securityAuditLog`; la copia deja una lápida visible en el destino.       |
| Esquema y backup                                                       | `SPEC-0016` / `workshopBackup` | Se añade `mailShares` al esquema y al backup como resumen de metadatos.                             |

**Frontera que 0017 deja fijada y 0018 desarrolla:**

1. Una copia compartida **no se cuenta en `mailAccounts.cacheBytes`** ni en `cacheBodyBytes` / `cacheAttachmentBytes`.
2. **No la expulsa el LRU**, no la borra el barrido de caducidad de 30 días ni la acción «Vaciar caché».
3. **No se borra al desconectar la cuenta de correo ni al borrar la cuenta**, ni se purga por la baja del usuario.
4. Su retención y su ciclo de vida son los del registro destino, no los de la caché.
5. La caché del buzón no guarda `.eml`; una copia compartida **sí puede conservar un `.eml`** si se comparte en modo original. Son dos registros distintos y con dos dueños distintos.

---

## 1. Contexto y objetivo

El taller recibe por correo información que pertenece a una incidencia, una petición de repuesto, un equipo, un manual o una compra: una confirmación del proveedor, una foto de una avería, un presupuesto, una conversación con el SAT o una instrucción técnica. Reenviar ese correo a una carpeta personal no deja rastro en el expediente; copiar el cuerpo a una nota pierde el mensaje y sus adjuntos.

El objetivo es permitir que el dueño de un buzón **comparta un mensaje concreto** con un registro del taller, dejando una copia estable, consultable y con la misma audiencia que el registro. La copia debe sobrevivir a la purga de la caché del buzón, pero no debe convertirse en una segunda caché ni en un archivo paralelo de todo el correo.

---

## 2. Decisiones cerradas

| Código | Decisión                                             | Consecuencia                                                                                                                                                   |
| ------ | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1** | **La copia es un registro del destino, no caché.**   | Vive en `mailShares`, no en `mailBodies` / `mailAttachments`. No cuenta en el presupuesto del buzón.                                                           |
| **S2** | **Snapshot autocontenido.**                          | Al compartir se copia el mensaje seleccionado a `mailShares` y a objetos propios de `_storage`. No se guardan punteros a la caché.                             |
| **S3** | **Resumen por defecto; original opt-in.**            | El modo `summary` guarda metadatos y un extracto. El modo `original` guarda cuerpo y adjuntos, y opcionalmente el `.eml`. Los manuales solo admiten `summary`. |
| **S4** | **La audiencia es la del destino.**                  | La copia no crea un permiso nuevo ni una lista de invitados. Quien puede ver la ficha puede ver sus copias; quien no, no.                                      |
| **S5** | **`viewMailbox` solo se exige para compartir.**      | Ver una copia no requiere buzón propio. Compartir exige `viewMailbox` y la capacidad del destino.                                                              |
| **S6** | **La baja de usuario no borra copias.**              | `users.active = false` impide entrar y compartir, pero las copias ya compartidas siguen el ciclo del destino.                                                  |
| **S7** | **La retención sigue al destino.**                   | Incidencias y peticiones usan su papelera (7 días por defecto, 1–90). Equipos y manuales borrados dejan la copia en una papelera administrativa de 7 días.     |
| **S8** | **Auditoría administrativa y lápida en el destino.** | `securityAuditLog` solo lo lee el administrador. El destino muestra que hubo un correo retirado, sin volver a exponer su contenido.                            |
| **S9** | **Sin figuras que no existen en v1.**                | No hay legal hold, no se comparte con mantenimiento, no se adjunta correo a notas de manual y no se comparte con invitados ni con la página pública.           |

### 2.1 Modos de copia

| Modo              | Qué guarda                                                                                            | Dónde se permite                            | Uso previsto                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------- |
| `summary`         | Asunto, remitente, fecha, `summary` en texto plano (≤ 8 KB) y referencia al destino.                  | Todos los destinos.                         | Dejar constancia sin duplicar cuerpo ni adjuntos. Es el modo por defecto. |
| `original`        | Lo anterior más `bodyText` (≤ 64 KB), `bodyHtml` saneado (≤ 512 KB), adjuntos y, si se marca, `.eml`. | Incidencias, peticiones, equipos y compras. | Evidencia técnica o conversación completa.                                |
| `summary` forzado | Solo el resumen.                                                                                      | Manuales.                                   | El manual ya tiene su PDF; el correo solo aporta contexto.                |

El modo `original` no copia la caché del buzón: copia **un mensaje** y lo hace una sola vez por copia. Si se comparte el mismo mensaje con tres destinos, hay tres copias independientes; cada una puede purgarse sin afectar a las otras ni al buzón.

La copia completa —cuerpo, adjuntos y, si se pide, `.eml`— no supera el límite de 50 MB por mensaje de 0017. Si se marca «Conservar el `.eml`», sus bytes cuentan dentro de ese límite; si no cabe, se rechaza la copia y se pide compartir sin el `.eml` o en modo `summary`.

---

## 3. Alcance

### Dentro

- Compartir un mensaje del buzón propio con una incidencia, una petición de repuesto, un equipo, un manual o una compra.
- Crear una incidencia nueva desde un correo, con el remitente como notificante y el técnico como autor de la compartición.
- Adjuntar una copia a una petición existente solo desde `decideRequests`.
- Ver, abrir y descargar las copias desde la ficha del destino.
- Purga administrativa de copias vivas y de copias huérfanas.
- Retención ligada al destino y papelera administrativa de 7 días para equipos y manuales borrados.
- Backup y restauración como resumen de metadatos.
- Auditoría de seguridad sin contenido del correo.

### Fuera

- Enviar, reenviar o responder correos desde el expediente.
- Compartir con mantenimiento, notas de manual, mensajes internos, notificaciones, formularios públicos o páginas públicas.
- Varias copias del mismo mensaje dentro de una misma ficha como si fueran una conversación.
- Legal hold o congelación de una copia más allá del ciclo del destino.
- Búsqueda global del contenido de las copias. Solo se buscan dentro de la ficha.
- Sincronizar cambios posteriores del correo original. La copia es una foto del momento de compartir.
- Adjuntar correo a una petición por parte del solicitante después de crearla.

---

## 4. Modelo de datos

### 4.1 `mailShares`

Una fila por copia compartida. La fila es la unidad de permiso, retención y auditoría.

| Campo                     | Tipo                                                                                                                          | Notas                                                                                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `sourceMessageId`         | `string`                                                                                                                      | Identidad del mensaje en Zimbra en el momento de compartir. **No es una clave foránea** ni se usa para volver a la caché. Se borra al purgar el contenido.         |
| `sourceEmail`             | `string`                                                                                                                      | Buzón desde el que se compartió. Se conserva mientras la copia tenga contenido.                                                                                    |
| `destinationType`         | `"incident" \| "request" \| "equipment" \| "manual" \| "purchaseOrder" \| "purchaseRequest"`                                  | Discriminante del destino.                                                                                                                                         |
| `destinationId`           | `Id<"incidents"> \| Id<"partRequests"> \| Id<"equipment"> \| Id<"manuals"> \| Id<"purchaseOrders"> \| Id<"purchaseRequests">` | Debe corresponder a `destinationType`.                                                                                                                             |
| `destinationReference`    | `string?`                                                                                                                     | Referencia o título visible copiado (`INC-0001`, `PET-0007`, `OC-0003`, título del manual…). Sirve para la papelera administrativa cuando el destino ya no existe. |
| `mode`                    | `"summary" \| "original"`                                                                                                     | `summary` es el valor por defecto. Manuales solo admiten `summary`.                                                                                                |
| `subject`                 | `string`                                                                                                                      | Asunto saneado. Se vacía al purgar el contenido.                                                                                                                   |
| `fromName`                | `string?`                                                                                                                     | Nombre visible del remitente.                                                                                                                                      |
| `fromAddress`             | `string`                                                                                                                      | Dirección del remitente. Se vacía al purgar el contenido.                                                                                                          |
| `sentAt`                  | `number`                                                                                                                      | Fecha del mensaje. Se conserva como metadato de la copia.                                                                                                          |
| `summary`                 | `string`                                                                                                                      | Extracto en texto plano, ≤ 8 KB. Se vacía al purgar el contenido.                                                                                                  |
| `bodyText`                | `string?`                                                                                                                     | Solo `original`. Texto plano, ≤ 64 KB, truncado con bandera.                                                                                                       |
| `bodyHtml`                | `string?`                                                                                                                     | Solo `original`. HTML del mensaje con la misma política de saneado de 0017; se vuelve a sanear al renderizar. ≤ 512 KB, truncado con bandera.                      |
| `bodyTruncated`           | `boolean?`                                                                                                                    | Indica que el cuerpo se recortó.                                                                                                                                   |
| `emlStorageId`            | `Id<"_storage">?`                                                                                                             | Solo `original` y solo si se pidió conservar el `.eml`. Objeto propio, no de la caché.                                                                             |
| `emlFileName` / `emlSize` | `string?` / `number?`                                                                                                         | Metadatos del `.eml`.                                                                                                                                              |
| `attachments`             | `Array<{ storageId, name, contentType, size }>?`                                                                              | Solo `original`. Objetos propios, no `mailAttachments`.                                                                                                            |
| `sharedBy`                | `Id<"users">`                                                                                                                 | Quien compartió. Es el autor de la copia y el creador de la incidencia si se creó desde correo.                                                                    |
| `sharedByName`            | `string`                                                                                                                      | Instantánea del nombre visible; sobrevive a la baja del usuario.                                                                                                   |
| `sharedAt`                | `number`                                                                                                                      | Cuándo se compartió.                                                                                                                                               |
| `clientShareId`           | `string?`                                                                                                                     | Idempotencia del formulario o de la acción. Evita duplicar la copia si se reintenta.                                                                               |
| `destinationDeletedAt`    | `number?`                                                                                                                     | Solo equipos y manuales: el destino se borró y la copia está huérfana.                                                                                             |
| `orphanPurgeAt`           | `number?`                                                                                                                     | Solo equipos y manuales: `destinationDeletedAt + 7 días`.                                                                                                          |
| `contentPurgedAt`         | `number?`                                                                                                                     | Contenido purgado; la fila queda como lápida si el destino sigue existiendo.                                                                                       |
| `contentPurgedBy`         | `Id<"users">?`                                                                                                                | Quién ordenó la purga.                                                                                                                                             |
| `purgeReason`             | `"manual" \| "destination" \| "orphan" \| "reset"`                                                                            | Motivo de la purga; se conserva en la lápida y en auditoría.                                                                                                       |
| `backupRestored`          | `boolean?`                                                                                                                    | La copia volvió de un backup: solo resumen, sin cuerpo ni `.eml`.                                                                                                  |

**Invariantes de la fila:**

- `mode === "summary"` implica `bodyText`, `bodyHtml`, `emlStorageId` y `attachments` ausentes.
- `destinationType === "manual"` implica `mode === "summary"`.
- `destinationDeletedAt` solo aparece en `equipment` o `manual`; nunca en incidencias, peticiones o compras.
- Una fila con `contentPurgedAt` no tiene `subject`, `fromAddress`, `summary`, `bodyText`, `bodyHtml`, `emlStorageId` ni `attachments`.
- `sourceMessageId` y `sourceEmail` se vacían al purgar; no se usan para localizar el mensaje original.

### 4.2 Índices

- `by_destination` (`destinationType`, `destinationId`, `sharedAt`) — listar las copias de una ficha.
- `by_orphan_purge` (`orphanPurgeAt`) — barrido de copias huérfanas.
- `by_client_share` (`sharedBy`, `clientShareId`) — idempotencia.
- `by_source_message` (`sourceMessageId`) — diagnóstico y prevención de duplicados; no es una relación.

No hay índice por asunto ni por remitente: la copia se busca desde su ficha, no desde una búsqueda global.

### 4.3 Lo que no se guarda

`mailShares` **no** guarda:

- una copia de `mailHeaders`, `mailBodies` ni `mailAttachments`;
- el `storageId` de un adjunto de la caché;
- el token, la contraseña ni la cuenta Zimbra;
- el buzón completo ni una lista de mensajes;
- un puntero que obligue a mantener viva la caché para poder abrir la copia.

---

## 5. Permisos

### 5.1 Capacidad nueva

Se añade a `src/lib/permissions.ts`:

- **`createIncidentFromMail`** — crear una incidencia nueva desde un correo.
  - Grupo «Incidencias», etiqueta «Crear incidencia desde correo».
  - Por defecto: `admin`, `manager` y `technician` en `true`; `guest` en `false`.
  - Los roles personalizados nacen en `false` y solo la reciben si el administrador la concede.
  - No sustituye a `manageIncidents`: sirve para el alta desde correo, no para asignar, cerrar ni modificar incidencias.

No se añade una capacidad `viewMailShares`. La visibilidad de la copia no es un permiso independiente: se deriva del destino. Crear una capacidad aparte permitiría que alguien viera una copia de una ficha que no puede abrir, o que dejara de verla al cambiar el rol sin que la ficha cambiara.

### 5.2 Compartir

| Destino              | Capacidad exigida        | Regla adicional                                                                                                                 |
| -------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Incidencia nueva     | `createIncidentFromMail` | Debe ser el dueño de la cuenta de correo y tener `viewMailbox`.                                                                 |
| Incidencia existente | `manageIncidents`        | La incidencia debe existir y no estar en papelera. Se permite adjuntar a una cerrada; la copia no cambia su estado.             |
| Petición existente   | `decideRequests`         | La petición debe existir y no estar en papelera. El solicitante no adjunta después de crearla salvo que tenga `decideRequests`. |
| Equipo               | `manageEquipment`        | El equipo debe existir.                                                                                                         |
| Manual               | `manageManuals`          | El manual debe existir. Solo `summary`.                                                                                         |
| Orden de compra      | `managePurchasing`       | La orden debe existir.                                                                                                          |
| Petición de compra   | `managePurchasing`       | La petición debe existir.                                                                                                       |

**Regla común:** compartir exige `viewMailbox` y una cuenta de correo conectada. El administrador no puede compartir desde el buzón de otra persona: **solo el dueño de la cuenta puede compartir sus mensajes**. No hay delegación ni suplantación.

### 5.3 Ver

La copia no añade una restricción nueva a la ficha. Se aplica exactamente la audiencia real del destino:

| Destino                                   | Quién ve la copia                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Incidencia viva o archivada               | Cualquier miembro activo del taller, igual que `incidents.list` / `incidents.paginatedList`. No se exige `viewIncidents`.      |
| Petición viva o archivada                 | Cualquier miembro activo del taller, igual que `partRequests.list` / `partRequests.paginatedList`. No se exige `viewRequests`. |
| Incidencia o petición en papelera         | `manageIncidents` o `decideRequests` (coordinación), que es quien ve esa papelera.                                             |
| Equipo vivo                               | `viewEquipment` o `manageEquipment`.                                                                                           |
| Manual vivo                               | `viewManuals` o `manageManuals`.                                                                                               |
| Orden o petición de compra                | `viewPurchasing` o `managePurchasing`.                                                                                         |
| Copia huérfana de equipo o manual borrado | Solo administrador, en la papelera administrativa.                                                                             |
| Invitado, sesión anónima o página pública | Nunca.                                                                                                                         |
| `lookupEquipment` / `lookupCatalog`       | Nunca. Son lecturas para vincular o pedir material; no abren expedientes ni copias.                                            |

**Consecuencias:**

- Un usuario sin `viewMailbox` puede ver una copia si puede ver la ficha. `viewMailbox` solo se exige para **compartir**, no para consultar.
- En equipos, manuales y compras, un usuario con `viewMailbox` pero sin capacidad sobre el destino no ve la copia; en incidencias y peticiones la regla es la de la ficha (miembro activo), no la del menú.
- Cambiar el rol o revocar una capacidad surte efecto en la siguiente consulta. No hay listas de acceso cacheadas ni copias de permisos.
- La copia no aparece en la búsqueda global, en `lookupEquipment`, en `lookupCatalog` ni en la página pública. Solo se lista desde la ficha del destino y, si procede, desde la papelera administrativa.

---

## 6. Flujos

### 6.1 Compartir un mensaje con un destino existente

1. El usuario abre un mensaje en su buzón y pulsa «Compartir con el expediente».
2. El diálogo solo ofrece destinos para los que tiene capacidad y que existen.
3. Elige modo `summary` u `original`; en manuales, `original` no se ofrece.
4. Si el cuerpo no está en la caché, la acción lo descarga, verifica `s`, lo parsea y lo usa para la copia. **No escribe en `mailBodies` ni en `mailAttachments` y no actualiza `cacheBytes`.**
5. La acción crea la fila `mailShares` y los objetos propios de `_storage` en una sola operación lógica. Si falla a mitad, no deja fila con objetos huérfanos: limpia lo escrito y devuelve el error.
6. La ficha destino muestra la copia en su sección «Correos compartidos». No se envía ningún correo de aviso.
7. `clientShareId` evita duplicar la copia si el navegador reintenta la acción.

### 6.2 Crear una incidencia desde un correo

1. El usuario elige «Crear incidencia desde este correo».
2. Debe tener `viewMailbox` y `createIncidentFromMail`.
3. La incidencia nace en estado `reported`, con referencia nueva y sin asignar.
4. **Notificante:** `reporterName` y `reporterEmail` se toman del remitente del correo; si no hay nombre, se usa la dirección. No se vincula automáticamente a una cuenta de usuario.
5. **Creador:** el técnico que comparte queda como autor en `mailShares.sharedBy` y en una entrada de `history` con `by` y la nota «Creada desde correo». No se añade un campo `createdBy` nuevo a `incidents`.
6. `description` se rellena con el asunto y un extracto; el técnico puede completarla después según el flujo normal de la incidencia.
7. La copia se crea en el mismo flujo, en modo `summary` u `original`, y queda vinculada a la incidencia recién creada. Si la copia falla, no se crea la incidencia: la operación es atómica. `clientShareId` evita duplicar la incidencia si el navegador reintenta.
8. Si el usuario no tiene `lookupEquipment`, no se le ofrece vincular un equipo; la incidencia se crea sin equipo.

### 6.3 Compartir con una petición existente

- Solo `decideRequests`.
- La petición debe existir y no estar en papelera.
- El solicitante no adjunta correo después de crear la petición salvo que tenga `decideRequests`; no se añade una excepción por autoría.
- La copia no modifica líneas, estado, decisión ni adjuntos de la petición.

### 6.4 Compartir con equipo, manual o compra

- Equipo: `manageEquipment`; la copia se muestra en la ficha del equipo.
- Manual: `manageManuals`; **solo resumen**, sin cuerpo, adjuntos ni `.eml`. Las notas de manual no admiten correo en v1.
- Compra: `managePurchasing`; se permite orden y petición de compra, en `summary` u `original`. La copia no altera líneas, recepciones ni estado.

### 6.5 Abrir y descargar

- La copia se abre en el mismo visor seguro de 0017: texto plano o HTML saneado en iframe con CSP, sin scripts y con imágenes remotas bloqueadas por defecto.
- La descarga de adjuntos y del `.eml` se emite solo después de comprobar la visibilidad de la copia. Nunca se devuelve una URL de `_storage` a quien no puede ver la ficha.
- El `.eml` se sirve como descarga (`Content-Disposition: attachment`), nunca se renderiza en línea.
- El modo `summary` no ofrece descarga de cuerpo ni adjuntos; solo el resumen visible.
- Ver o descargar una copia no requiere `viewMailbox`.

### 6.6 Purga administrativa

- **Copia viva:** solo el administrador puede purgarla antes de que termine el ciclo del destino. Exige motivo. Se borran cuerpo, adjuntos y `.eml`; se conserva una lápida sin contenido en la ficha.
- **Copia huérfana:** solo el administrador, desde la papelera administrativa, puede descargar lo que quede o purgarla.
- **Purga por destino:** en incidencias y peticiones la ejecuta el flujo que las borra o el cron de papelera. En equipos y manuales el borrado no purga en el acto: marca la copia como huérfana y el barrido la purga al vencer sus 7 días. No requiere intervención manual.
- **Purga por reset:** el vaciado del taller incluye `mailShares`; los objetos quedan para el barrido de `storageCleanup`.

---

## 7. Retención y ciclo de vida

### 7.1 Tabla de retención

| Destino    | Situación                    | Qué pasa con la copia                 | Quién la ve                            | Cuándo se purga                                              |
| ---------- | ---------------------------- | ------------------------------------- | -------------------------------------- | ------------------------------------------------------------ |
| Incidencia | Viva o archivada             | Activa, sin cambios.                  | Cualquier miembro activo.              | Cuando se purga la incidencia.                               |
| Incidencia | En papelera                  | Activa; no se borra con la caché.     | `manageIncidents` / `decideRequests`.  | En el `purgeAt` de la incidencia (7 días por defecto, 1–90). |
| Incidencia | Restaurada                   | Vuelve a la audiencia normal.         | Cualquier miembro activo.              | Sin cambio.                                                  |
| Petición   | Viva o archivada             | Activa, sin cambios.                  | Cualquier miembro activo.              | Cuando se purga la petición.                                 |
| Petición   | En papelera                  | Activa; no se borra con la caché.     | `manageIncidents` / `decideRequests`.  | En el `purgeAt` de la petición (7 días por defecto, 1–90).   |
| Petición   | Restaurada                   | Vuelve a la audiencia normal.         | Cualquier miembro activo.              | Sin cambio.                                                  |
| Equipo     | Vivo                         | Activa, sin cambios.                  | `viewEquipment` / `manageEquipment`.   | Cuando se borra el equipo y vence su plazo administrativo.   |
| Equipo     | Borrado                      | Huérfana, sin reattach.               | Solo administrador.                    | 7 días desde el borrado, o purga manual.                     |
| Manual     | Vivo                         | Activa, solo resumen.                 | `viewManuals` / `manageManuals`.       | Cuando se borra el manual y vence su plazo administrativo.   |
| Manual     | Borrado                      | Huérfana, solo resumen, sin reattach. | Solo administrador.                    | 7 días desde el borrado, o purga manual.                     |
| Compra     | Viva, completada o cancelada | Activa, sin cambios.                  | `viewPurchasing` / `managePurchasing`. | No hay borrado de compras en v1; sigue al registro.          |
| Taller     | Reset                        | Se purga con el taller.               | —                                      | En el reset; los objetos los barre `storageCleanup`.         |

### 7.2 Reglas

- **La copia no tiene TTL propio mientras el destino vive.** No hay un plazo de 30 días de caché que la alcance.
- **Incidencias y peticiones:** el `purgeAt` del destino es la única fecha. Restaurar antes de esa fecha conserva la copia; purgar el destino purga la copia en la misma operación. Si la copia ya estaba purgada a mano, la lápida se va con el destino.
- **Equipos y manuales:** el borrado es inmediato y no tiene papelera de módulo. Al borrar, sus copias pasan a `destinationDeletedAt` y `orphanPurgeAt = ahora + 7 días`. No se pueden reattach a otro destino. El administrador puede descargarlas o purgarlas antes.
- **Compras:** no se borran en v1. Una orden cancelada o completada sigue viva y su copia sigue visible para quien pueda ver compras.
- **Legal hold:** no existe en v1. No hay forma de congelar una copia más allá de su destino.
- **El plazo de 7 días de las huérfanas es fijo** y no depende de `storageSettings.trashRetentionDays`. La papelera de incidencias y peticiones sí usa ese ajuste, porque es la papelera del destino.

### 7.3 Purga del contenido

La purga de contenido:

1. borra de `_storage` el `.eml` y todos los adjuntos de la copia;
2. vacía `subject`, `fromAddress`, `summary`, `bodyText`, `bodyHtml`, `emlStorageId`, `emlFileName`, `emlSize` y `attachments`;
3. vacía `sourceMessageId` y `sourceEmail`;
4. deja `sharedAt`, `destinationType`, `destinationId`, `destinationReference`, `contentPurgedAt`, `contentPurgedBy` y `purgeReason`;
5. no toca la caché, la cuenta de correo ni el mensaje original.

La fila purgada es una **lápida**: la ficha muestra «Correo compartido retirado» con la fecha, sin asunto, remitente ni contenido. Si el destino desaparece, la lápida se borra con él y solo queda la traza de auditoría.

---

## 8. Baja de usuario y cambios de rol

- **Baja lógica (`users.active = false`):** el usuario no puede entrar, no puede compartir y no puede ver la ficha. Sus copias **no se borran**, no se purgan y no cambian de audiencia. La baja de 0017 detiene la sincronización y deja la caché del buzón inaccesible y sujeta a su barrido; esta spec no toca esa caché.
- **Usuario que compartió:** `sharedBy` puede estar inactivo; `sharedByName` conserva el nombre visible. La copia no depende de que el autor siga activo.
- **Pérdida de `viewMailbox`:** no puede compartir nuevas copias; las existentes siguen visibles según el destino. No se purgan por perder el buzón.
- **Pérdida de una capacidad del destino:** la copia desaparece de la vista de esa persona, pero no se borra. Si recupera la capacidad, vuelve a verla.
- **Cambio de rol:** la audiencia se recalcula en cada consulta. No se guardan ACL por copia.
- **Borrado de usuario:** no existe borrado definitivo en el sistema; solo baja lógica. Si en el futuro existiera, `sharedBy` no debe ser una clave foránea que arrastre la copia: el nombre visible ya está copiado.

---

## 9. Privacidad y seguridad

1. **Minimización:** el modo por defecto es `summary`; el original es una elección explícita. Manuales solo guardan resumen.
2. **Sin buzón completo:** una copia es un mensaje, no una carpeta ni una cuenta. No se copian cabeceras de otros mensajes.
3. **Sin acceso cruzado:** nadie puede compartir desde el buzón de otra persona. El administrador no tiene un explorador de buzones ajenos.
4. **Sin público:** invitados, sesiones anónimas, páginas públicas y `lookupEquipment` / `lookupCatalog` no ven copias.
5. **HTML:** se guarda con la misma política de saneado de 0017 y se vuelve a sanear en el visor; iframe con `sandbox`, CSP, sin scripts, sin formularios y con imágenes remotas bloqueadas por defecto.
6. **`.eml`:** se descarga como archivo, nunca se renderiza. Se advierte de que puede contener adjuntos maliciosos. El tamaño máximo es el de 0017 (50 MB por mensaje).
7. **Adjuntos:** se guardan como objetos propios; no se reutilizan los `storageId` de la caché. `storageCleanup` los respeta mientras `mailShares` los cite.
8. **Logs:** ni asunto, ni remitente, ni cuerpo, ni nombres de adjuntos en logs. Solo ids, destino y resultado.
9. **Auditoría:** `securityAuditLog` registra `mail_share_create`, `mail_share_purge`, `mail_share_orphan` y `mail_share_restore_skip` con `target` y metadatos sin contenido. Solo el administrador puede leerla, como hoy.
10. **Lápida:** el destino ve que hubo un correo retirado, pero no su asunto, remitente ni cuerpo. La lápida no reabre el contenido.
11. **Sin legal hold:** no hay excepción de retención. Si se necesita conservar una copia, se conserva el destino; no se añade un candado en v1.

---

## 10. API prevista

### 10.1 Públicas

| Función                             | Tipo       | Permiso                                  | Uso                                                                        |
| ----------------------------------- | ---------- | ---------------------------------------- | -------------------------------------------------------------------------- |
| `mailShares.share`                  | `action`   | `viewMailbox` + capacidad del destino    | Descarga/parsea si hace falta y crea la copia.                             |
| `mailShares.createIncidentFromMail` | `action`   | `viewMailbox` + `createIncidentFromMail` | Crea incidencia y copia en un flujo.                                       |
| `mailShares.listForDestination`     | `query`    | Audiencia del destino                    | Lista las copias visibles y las lápidas.                                   |
| `mailShares.get`                    | `query`    | Audiencia del destino                    | Devuelve metadatos y contenido sanitizado.                                 |
| `mailShares.download`               | `query`    | Audiencia del destino                    | Devuelve URL de descarga de adjunto o `.eml` tras comprobar visibilidad.   |
| `mailShares.purge`                  | `mutation` | Administrador                            | Purga una copia viva con motivo.                                           |
| `mailShares.listOrphaned`           | `query`    | Administrador                            | Papelera administrativa de equipos/manuales borrados.                      |
| `mailShares.purgeOrphaned`          | `mutation` | Administrador                            | Purga una huérfana antes del plazo.                                        |
| `mailShares.downloadOrphaned`       | `action`   | Administrador                            | URL de un adjunto o del `.eml` de una huérfana, sin audiencia del destino. |

### 10.2 Internas

| Función                  | Uso                                                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `purgeForDestination`    | La llaman `_incidents/trash`, `_partRequests/trash`, `equipment.remove` y `manuals.remove` para purgar o marcar huérfanas. |
| `markDestinationDeleted` | Marca `destinationDeletedAt` y `orphanPurgeAt` en equipos y manuales.                                                      |
| `sweepOrphaned`          | `internalMutation` diaria: purga las huérfanas cuyo `orphanPurgeAt` venció.                                                |
| `purgeForReset`          | El reset del taller borra las filas; los objetos quedan para `storageCleanup`.                                             |

### 10.3 Contrato de `share`

Entrada:

- `messageId` del mensaje del usuario;
- `destinationType`;
- `destinationId` (salvo incidencia nueva);
- `mode` (`summary` u `original`);
- `includeEml` (solo `original`, por defecto `false`);
- `clientShareId` opcional.

Comprobaciones, en este orden:

1. sesión activa, no anónima;
2. `viewMailbox`;
3. cuenta de correo propia y conectada;
4. mensaje propio (el `messageId` pertenece a la cuenta del usuario);
5. destino existente y no en papelera;
6. capacidad del destino;
7. modo permitido para el destino;
8. límites de tamaño.

La acción no escribe en la caché. Si el mensaje ya está cacheado, lee el contenido; si no, lo descarga con la lógica de 0017 y lo usa directamente para el snapshot.

---

## 11. Interfaz

### 11.1 Buzón

- Acción «Compartir con el expediente» en el visor de mensajes.
- Diálogo con selector de destino filtrado por capacidad y tipo.
- Selector de modo; `original` deshabilitado en manuales.
- Casilla «Conservar el `.eml` original» solo en `original`; apagada por defecto.
- Aviso: «La copia queda en el expediente y no se borra al vaciar la caché del buzón».
- Si no hay destinos disponibles, se explica qué capacidad falta.

### 11.2 Ficha del destino

- Sección «Correos compartidos» en incidencias, peticiones, equipos, manuales y compras.
- Cada fila: asunto, remitente, fecha, quién compartió, modo y fecha de compartición.
- Acciones: abrir, descargar adjuntos, descargar `.eml` (si existe), purgar (solo administrador).
- Lápida: «Correo compartido retirado» sin asunto ni remitente.
- En manuales, la sección solo muestra resúmenes y no ofrece adjuntos ni `.eml`.

### 11.3 Papelera administrativa

- En «Ajustes del taller → Almacenamiento», tarjeta «Copias de correo huérfanas», visible solo para administrador.
- Lista: destino original, referencia, asunto, remitente, fecha de borrado, fecha de purga y tamaño.
- Acciones: descargar lo disponible, purgar ahora. No hay «restaurar» ni «reattach».
- Al vencer, el cron purga y deja traza en `securityAuditLog`.

### 11.4 Accesibilidad y móvil

- El diálogo y la sección usan los componentes y convenciones de 0015.
- No se añaden notificaciones por correo ni avisos in-app por compartir.
- La sección es responsive: en móvil, las filas se apilan y las acciones quedan en un menú.

---

## 12. Ficheros previstos

```text
src/lib/mailShare.ts                 # políticas puras: modos, resumen, retención, audience
src/convex/mailShares.ts             # API pública
src/convex/_mailShares/
  persist.ts                         # snapshot, purga y lápidas
  audience.ts                        # visibilidad derivada del destino
  orphan.ts                          # papelera administrativa de equipos/manuales
src/pages/dashboard/mailbox/components/ShareMailDialog.tsx
src/pages/dashboard/shared/SharedMailSection.tsx
src/pages/dashboard/settings/OrphanMailSharesCard.tsx
tests/mailShares.test.ts
tests/mailSharesView.test.tsx
tests/mailSharesBackup.test.ts
```

`src/lib/mailShare.ts` no importa React ni Convex. Las comprobaciones de capacidad viven en `src/convex/mailShares.ts` y reutilizan `hasCapability` / `hasAnyCapability`.

---

## 13. Backup, restauración y reset

### 13.1 Backup

- `mailShares` se añade a `BACKUP_TABLES`.
- La exportación guarda **solo metadatos**: `destinationType`, `destinationReference`, `subject`, `fromName`, `fromAddress`, `sentAt`, `sharedByName`, `sharedAt`, `mode`, `contentPurgedAt` y `purgeReason`. Viajan también `destinationId` y `sharedBy` como referencias: sin el primero la restauración no puede remapear la ficha y sin el segundo no se puede reconstruir la fila; ninguno de los dos es contenido.
- Se excluyen siempre `summary` (es un extracto del cuerpo), `bodyText`, `bodyHtml`, `emlStorageId`, `emlFileName`, `emlSize`, `attachments`, `sourceMessageId` y `sourceEmail`.
- Una copia `original` se exporta con `mode: "summary"` y `backupRestored: true`. Al restaurar, no hay cuerpo, adjuntos ni `.eml`; la ficha lo indica con la marca «Copia restaurada: solo metadatos» y el resumen queda vacío.
- Si el destino no se puede remapear al restaurar, la copia se omite y se registra `mail_share_restore_skip`; no se crea una huérfana artificial.

### 13.2 Reset

- `mailShares` entra en `RESET_TABLES` porque es trabajo del taller, no configuración.
- El reset borra las filas; los objetos de `_storage` quedan sin cita y `storageCleanup` los barre en su pasada nocturna.
- `securityAuditLog` no se toca.

### 13.3 Limpieza de almacenamiento

`storageCleanup` ya recorre todas las tablas del esquema y sus cadenas. Al añadir `mailShares`, sus `emlStorageId` y `attachments[].storageId` quedan citados y no se borran mientras la fila exista. El test debe comprobar que:

- una copia activa protege su `.eml` y sus adjuntos;
- una copia purgada ya no los protege;
- una copia huérfana los protege hasta su purga;
- la caché del buzón no se ve afectada.

---

## 14. Fases de implementación

| Fase                     | Contenido                                                                     | Cierre                                             |
| ------------------------ | ----------------------------------------------------------------------------- | -------------------------------------------------- |
| 1. Esquema y permisos    | `mailShares`, índices, `createIncidentFromMail`, helpers de audiencia.        | `npx tsc --noEmit`, test de esquema y permisos.    |
| 2. Compartir y ver       | Acción `share`, creación de incidencia, sección en fichas, visor y descargas. | Test de aislamiento y visibilidad.                 |
| 3. Retención y huérfanas | Enganches en papeleras, borrado de equipos/manuales, cron de huérfanas.       | Test de restauración, purga y plazo.               |
| 4. Backup y reset        | `mailShares` en backup, sanitización, restauración como resumen, reset.       | Test de backup y storage cleanup.                  |
| 5. UI y cierre           | Revisión de accesibilidad, móvil y cierre de la UI construida en fases 2–3.   | `tests/mailSharesView.test.tsx` y revisión visual. |

Equivalencia con el plan: fases 1–2 = F5, fase 3 = F6, fases 4–5 = F7; F8 es el pilotaje posterior.

---

## 15. Criterios de aceptación

- **CA-001 — La copia sobrevive a la caché**
  - **Dado** un mensaje compartido con una incidencia
  - **Cuando** se vacía la caché, se desconecta la cuenta o se supera el plazo de 30 días
  - **Entonces** la copia sigue disponible y `mailAccounts.cacheBytes` no la cuenta.

- **CA-002 — `viewMailbox` no hace falta para ver**
  - **Dado** un usuario activo con acceso a la incidencia pero sin `viewMailbox`
  - **Cuando** abre la ficha
  - **Entonces** ve y descarga la copia; no ve el módulo de correo.

- **CA-003 — Solo el dueño comparte**
  - **Dado** un usuario con `viewMailbox` y un mensaje de otra cuenta
  - **Cuando** intenta compartirlo
  - **Entonces** la acción se rechaza; no hay suplantación ni delegación.

- **CA-004 — Audiencia del destino**
  - **Dado** una copia en una incidencia viva
  - **Cuando** la consulta un miembro activo sin `viewIncidents`
  - **Entonces** la ve, igual que ve la incidencia.
  - **Y** un invitado, una sesión anónima o una consulta pública no la ven.

- **CA-005 — Baja de usuario**
  - **Dado** un usuario que compartió una copia y después se da de baja
  - **Cuando** otro miembro abre el destino
  - **Entonces** la copia sigue visible y no se purga; el nombre del autor queda como instantánea.

- **CA-006 — Retención por destino**
  - **Dado** una incidencia con copia en la papelera
  - **Cuando** se restaura antes de `purgeAt`
  - **Entonces** la copia vuelve a la audiencia normal.
  - **Cuando** se purga la incidencia
  - **Entonces** la copia se purga con ella.

- **CA-007 — Equipo o manual borrado**
  - **Dado** un equipo o manual con copia
  - **Cuando** se borra el destino
  - **Entonces** la copia pasa a la papelera administrativa, solo la ve el administrador y no se puede reattach.
  - **Y** a los 7 días se purga, salvo purga manual anterior.

- **CA-008 — Manual solo resumen**
  - **Dado** un manual
  - **Cuando** se intenta compartir en modo `original`
  - **Entonces** se rechaza; solo se guarda el resumen.

- **CA-009 — Sin filtraciones por búsquedas auxiliares**
  - **Dado** una copia en un equipo
  - **Cuando** se usa `lookupEquipment` o `lookupCatalog`
  - **Entonces** no se devuelve ni el asunto ni la copia.

- **CA-010 — Backup sin contenido**
  - **Dado** una copia `original`
  - **Cuando** se exporta el backup
  - **Entonces** no incluye cuerpo, adjuntos ni `.eml`; al restaurar aparece como `summary` con la marca «Copia restaurada: solo metadatos».

- **CA-011 — Auditoría y lápida**
  - **Dado** una copia purgada por el administrador
  - **Cuando** se consulta el destino
  - **Entonces** se ve una lápida sin contenido.
  - **Y** `securityAuditLog` registra la purga, visible solo para el administrador.

- **CA-012 — Almacenamiento**
  - **Dado** una copia con `.eml` y adjuntos
  - **Cuando** se ejecuta `storageCleanup`
  - **Entonces** no borra sus objetos mientras la fila los cite.
  - **Cuando** se purga la copia
  - **Entonces** los objetos quedan sin cita y se pueden barrer.

---

## 16. Trazabilidad

| Requisito              | Criterios              | Tests previstos                                               |
| ---------------------- | ---------------------- | ------------------------------------------------------------- |
| S1, S2, S3             | CA-001, CA-008, CA-012 | `tests/mailShares.test.ts`, `tests/storageCleanup.test.ts`    |
| S4, S5                 | CA-002, CA-004, CA-009 | `tests/mailShares.test.ts`, `tests/mailSharesView.test.tsx`   |
| S5, S6                 | CA-003, CA-005         | `tests/mailShares.test.ts`, `tests/seguridad.test.ts`         |
| S7                     | CA-006, CA-007         | `tests/mailShares.test.ts`, `tests/trash.test.ts`             |
| S8                     | CA-010, CA-011         | `tests/audit.test.ts`, `tests/mailSharesBackup.test.ts`       |
| Backup/reset           | CA-010                 | `tests/workshopBackup.test.ts`, `tests/workshopReset.test.ts` |
| Reglas del repositorio | —                      | `tests/arquitectura.test.ts`, `tests/seguridad.test.ts`       |

Comandos de cierre por fase: `npx tsc --noEmit`, `npx vitest run <tests tocados>` y, al final, `npm run security:check`.

---

## 17. Riesgos y límites

| Riesgo                                   | Impacto                                          | Mitigación                                                                                                 |
| ---------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Confundir copia con caché                | El LRU o «Vaciar caché» borrarían evidencia      | `mailShares` no comparte tablas, presupuesto ni barrido con la caché; test explícito.                      |
| Audiencia más amplia que la ficha        | Fuga de correo a quien no ve el expediente       | La audiencia se deriva del destino en cada consulta; invitados y público nunca.                            |
| Audiencia más estrecha que la ficha      | La copia desaparece para quien debería verla     | Se replica la regla real de `incidents.list` / `partRequests.list`, no la del menú.                        |
| Copia huérfana sin plazo                 | Archivos y datos personales para siempre         | `orphanPurgeAt` fijo de 7 días y barrido diario.                                                           |
| `.eml` malicioso                         | Riesgo al descargarlo                            | Descarga explícita, `Content-Disposition: attachment`, aviso y límite de 50 MB.                            |
| HTML del correo                          | XSS o fuga de recursos remotos                   | Saneado con la política de 0017 y de nuevo en el visor, iframe sandbox, CSP e imágenes remotas bloqueadas. |
| Backup con contenido                     | Copias de seguridad con datos que no deben salir | Exportación solo de metadatos; restauración como `summary` sin cuerpo ni `.eml`.                           |
| Purga del destino y copia fuera de plazo | Copia visible sin ficha                          | La purga del destino purga la copia en la misma operación; no hay ventana.                                 |
| Manuales con cuerpo                      | Duplicar documentación y adjuntos                | `mode` forzado a `summary`; test de rechazo.                                                               |
| Baja del autor                           | Copia inaccesible o borrada por error            | La copia no depende de `sharedBy`; solo de la audiencia del destino.                                       |

---

## 18. Aprobación solicitada

Aprobar esta spec autoriza a:

1. Añadir la capacidad `createIncidentFromMail` a `src/lib/permissions.ts` y sus valores por defecto.
2. Añadir la tabla `mailShares`, sus índices y los tipos generados.
3. Implementar las acciones y consultas de §10 y la sección «Correos compartidos» en las fichas.
4. Enganchar la purga en las papeleras de incidencias y peticiones y en el borrado de equipos y manuales.
5. Añadir la papelera administrativa de copias huérfanas.
6. Incluir `mailShares` en `BACKUP_TABLES` y `RESET_TABLES`, con exportación solo de metadatos.
7. Añadir la cobertura de tests de §16.

Esta aprobación **no** autoriza a modificar la caché del buzón, a duplicar `mailBodies` / `mailAttachments`, a compartir con invitados o a implementar 0017 si aún no está aprobada.
