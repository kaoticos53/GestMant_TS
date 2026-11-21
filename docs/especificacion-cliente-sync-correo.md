# Cliente de correo para `hermes.rtva.es` — guía de construcción

**Versión:** 2.1
**Fecha:** 2026-11-20
**Estado:** cliente de referencia implementado y probado contra el servidor real
**Cliente de referencia:** `src/RtvaMail.App` (aplicación de escritorio)
**Referencia canónica del servidor:** [`docs/referencia-servidor-hermes.md`](referencia-servidor-hermes.md)

---

## 0. Alcance y relación con la referencia del servidor

Este documento cubre **cómo construir un cliente**: arquitectura, algoritmo de sincronización, modelo local, presentación de mensajes, seguridad, configuración y pruebas.

**No cubre el contrato del servidor.** Los endpoints, las operaciones SOAP, sus atributos, la semántica de los datos, los errores y los límites están en [`referencia-servidor-hermes.md`](referencia-servidor-hermes.md), que es la **referencia canónica**. Aquí solo se resumen y se enlazan.

| Necesito saber… | Dónde |
|---|---|
| Qué protocolos acepta el servidor, autenticación, operaciones y errores | Referencia canónica §2–§6 |
| Semántica de ids, tamaños, fechas y cuerpo del mensaje | Referencia canónica §5 |
| Límites del servicio (token, página, tamaño de mensaje) | Referencia canónica §7 |
| EAS, Autodiscover e IMAP | Referencia canónica §8 |
| Cómo estructurar el cliente, sincronizar, almacenar y mostrar | Este documento §3–§10 |
| Cómo verificar que el cliente funciona | Este documento §11 |

**Regla ante discrepancias:** si algo de este documento contradice a la referencia canónica, es un error de este documento y debe corregirse aquí. No se duplican payloads XML: para copiar peticiones, ir a la referencia canónica §9.

### Restricciones y trampas

Todas las restricciones del servidor y las trampas que afectan a la implementación están en una única tabla en **§2**, con su consecuencia para el cliente y la sección de referencia. No se repiten aquí.

### Regla de oro: solo lectura

El cliente **nunca** modifica el buzón remoto: ni `read="1"`, ni mover, ni borrar, ni marcar como leído al sincronizar o al abrir. El contrato de solo lectura está en la referencia canónica §3.4.

---

## 1. Resumen ejecutivo

- La vía es la **API SOAP de Zimbra** en `https://hermes.rtva.es/service/soap`. EWS no está instalado e IMAP/SMTP no están publicados; EAS existe pero no entrega el mensaje original con garantías.
- **Sincronizar cabeceras es barato:** 1 554 mensajes de las 9 carpetas de correo en 5,4 s y ~13 peticiones, sin descargar cuerpos.
- **Descargar el cuerpo es caro y se hace bajo demanda:** al abrir un mensaje, 0,45 s para uno de 2,5 MB.
- El mensaje se entrega **íntegro**: comparar siempre los bytes con el atributo `s` del servidor.
- El buzón de referencia son **1 554 mensajes y 759 482 547 B (724 MB)**, con Inbox 793 / 453 MB y Sent 713 / 264 MB.
- El cliente de referencia usa una base SQLite con una fila por mensaje (cabecera) y un `.eml` por mensaje descargado.
- La parte que más fallos concentra no es el protocolo sino el **visor**: MIME, `cid:`, saneado, contraste y límite de tamaño del motor de render.

---

## 2. Restricciones y trampas que condicionan el diseño

Resumen operativo en una sola tabla. El detalle y la evidencia están en la referencia canónica; la columna **Ref.** apunta a ella salvo cuando dice «este doc».

| Restricción | Consecuencia en el cliente | Ref. |
|---|---|---|
| SOAP es la única vía práctica para obtener el RFC822 original | Un solo backend; no invertir en EWS | §2 |
| `account by="name"` exige el buzón completo | La configuración guarda `usuario@dominio`; no se prueban variantes | §3.2 |
| Token de ~48 h y una sesión por cuenta | Un `AuthRequest` por sesión; renovar antes de caducar | §3.2 |
| `account.AUTH_FAILED` es ambiguo | Mensaje al usuario y reintento manual; nunca reintentos automáticos | §3.3 |
| `GetMsg` sin `read="0"` marca como leído | Atributo obligatorio en todas las descargas | §3.4 |
| El delta no trae metadatos | El listado se construye con `Search`; `Sync` solo para borrados y token | §4.3 |
| `useContentUrl="1"` y descarga por el servlet con cookie | Dos pasos por mensaje; el contenido incrustado no se escribe nunca | §4.4, §5.2 |
| `s` es el tamaño exacto del RFC822 | Verificación obligatoria antes de dar una descarga por buena | §5.2 |
| `Search` pagina de 500 en 500 | Bucle por `offset` hasta página incompleta | §4.2 |
| EWS 404 e IMAP filtrado | Sin planes alternativos sobre esos protocolos | §2, §8 |
| El motor HTML hereda el modo oscuro del sistema y pinta el lienzo negro | Forzar esquema claro y calcular el fondo efectivo antes de corregir el color | este doc §8.3 |
| El motor HTML no admite `NavigateToString` por encima de ~2 MB | Servir el HTML grande desde un fichero temporal | este doc §8.4 |
| La biblioteca MIME omite los adjuntos inline | Recorrer todas las partes con nombre o disposición `attachment` | este doc §8.2 |

Presupuesto medido del buzón de referencia: **1 554 cabeceras en 5,4 s**; descarga completa opcional de **724 MB**.

---

## 3. Arquitectura de referencia

Cuatro capas, independientes del protocolo en todo lo que no sea el cliente SOAP:

```
UI                        ventana principal, ajustes, lector
  │
Servicios                 SyncService   orquesta sincronización y descarga
  │                       MailReader    MIME → HTML seguro
  │                       MailStore     SQLite + ficheros .eml
  │                       ZimbraClient  SOAP + content servlet
  │
Infraestructura           HTTP (TLS, timeouts, reintentos)
                          cifrado de credenciales
                          motor de render HTML
```

Flujo de datos:

```
arranque → AuthRequest → GetFolder
        → por carpeta: Search paginado (cabeceras) + Sync (borrados)
        → lista en pantalla, sin cuerpos
        → usuario selecciona → GetMsg + servlet → .eml en disco
        → MailReader → HTML saneado + CSP → visor
```

Independencia de protocolo: si se añadiera un backend alternativo, solo cambiaría `ZimbraClient`; el resto del cliente trabaja con `(carpeta, id, tamaño, ruta del .eml)`.

---

## 4. Operaciones que consume el cliente

Solo lo que el cliente necesita decidir. El contrato completo (peticiones, respuestas, atributos y errores) está en la referencia canónica §4.

| Operación | Para qué | Datos que usa el cliente | Cuidado |
|---|---|---|---|
| `AuthRequest` | Abrir sesión | `authToken`, `lifetime` | Identificador = buzón completo |
| `GetFolderRequest` | Construir el árbol de carpetas | `id`, `name`, `absFolderPath`, `view`, `n`, `s` | `view` puede faltar |
| `SearchRequest` | Listar cabeceras y paginar | `id`, `s`, `d`, `f`, `l`, `<e>`, `<su>` | Orden y `offset` correctos |
| `SyncRequest` | Detectar borrados y avanzar token | `folder/m/id`, `deleted`, `token`, `more` | Ids anidados; sin metadatos |
| `GetMsgRequest` | Preparar descarga | `content@url`, `s` | `read="0"`, `raw="1"`, `useContentUrl="1"` |
| Content servlet | Obtener el RFC822 | bytes y su tamaño | Solo cookie; comparar con `s` |

Convenciones que el cliente fija (no las impone el servidor):

- Página de 500 en `Search`; tres reintentos con espera creciente; cuatro peticiones simultáneas como máximo.
- Límite de 50 MB por mensaje; los mayores quedan como `skipped_too_large`.
- No se persiste el cuerpo en la base: la verdad del contenido es el `.eml`.

---

## 5. Algoritmo de sincronización

### 5.1 Política recomendada: cabeceras al sincronizar, cuerpo al abrir

```
authenticate()                                   # referencia canónica §3
folders = GetFolder()
for folder in folders where kind == 'message' and sync_enabled:
    headers = []
    offset = 0
    do:
        page = SearchRequest(folder, sortBy=dateDesc, offset, limit=500)
        headers += page.messages
        offset += 500
    while page.count == 500

    UpsertHeaders(folder, headers)                # asunto, remitente, fecha, tamaño, adjuntos
    MarkMissing(folder, headers)                  # lo que ya no aparece → deleted_remote + cuarentena
    StoreFolderCounts(folder, page.total)

    delta = SyncRequest(folder, folder.token)     # borrados + token; sin metadatos
    Quarantine(delta.deleted)
    folder.token = delta.token
```

Al seleccionar un mensaje:

```
if not store.IsDownloaded(id):
    resp = GetMsg(id, read=0, raw=1, useContentUrl=1)
    bytes = GET resp.content.url  (Cookie: ZM_AUTH_TOKEN)
    assert len(bytes) == resp.size
    write atomically → store.MarkDownloaded(id, path, sha256)
render(path)
```

### 5.2 Variante: descarga completa del buzón

El mismo bucle puede descargar los cuerpos pendientes en lotes de 50 con commit por lote. Presupuesto: 724 MB y ≈ 63 min a 200 KB/s sostenidos; reservar ≥ 1,2 GB. Los mensajes mayores del límite configurado se marcan `skipped_too_large`.

### 5.3 Reglas de consistencia

1. El token de carpeta solo avanza cuando los datos de esa página están comprometidos.
2. Un mensaje está `downloaded` solo si el fichero existe y su tamaño coincide con `s`.
3. Nunca se borra un `.eml` por un delta: se mueve a cuarentena (30 días por defecto).
4. Si un mensaje cambia de carpeta, se actualiza `folder_id`; el `.eml` no se mueve.
5. La identidad es `(cuenta, id remoto)`. El `Message-ID` solo sirve para detectar duplicados entre carpetas.
6. La sincronización es idempotente: `INSERT … ON CONFLICT DO UPDATE` y no se re-descarga lo que ya está en disco.

### 5.4 Reanudación y reconciliación

- Corte a mitad de página: el token no avanza; la siguiente ejecución vuelve a listar y no duplica nada.
- `repair`: `GetFolder`, `Search` completo por carpeta, comparar con la base, marcar `missing_remote` y `pending`, y poner `token = NULL` para forzar un delta limpio. Nunca borra `.eml`.
- Base corrupta o borrada: se reconstruye el índice leyendo los `.eml` presentes.

---

## 6. Modelo local

### 6.1 Esquema SQLite

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE folder (
    remote_id       TEXT PRIMARY KEY,          -- id opaco del servidor
    parent_remote_id TEXT,
    name            TEXT NOT NULL,
    path            TEXT NOT NULL,             -- absFolderPath
    kind            TEXT NOT NULL,             -- message | calendar | contact | ...
    is_mail         INTEGER NOT NULL DEFAULT 0,
    sync_enabled    INTEGER NOT NULL DEFAULT 1,
    token           TEXT,                      -- token de SyncRequest (NULL = sin inicializar)
    server_count    INTEGER NOT NULL DEFAULT 0,
    local_count     INTEGER NOT NULL DEFAULT 0,
    last_sync_at    TEXT
);

CREATE TABLE message (
    remote_id       TEXT PRIMARY KEY,
    folder_id       TEXT NOT NULL REFERENCES folder(remote_id),
    subject         TEXT,
    sender          TEXT,                      -- "Nombre <direccion>"
    sent_at         TEXT,                      -- ISO-8601 UTC
    size_bytes      INTEGER,
    has_attachments INTEGER NOT NULL DEFAULT 0,
    unread          INTEGER NOT NULL DEFAULT 0,
    downloaded      INTEGER NOT NULL DEFAULT 0, -- 0 = solo cabecera
    eml_path        TEXT,
    eml_sha256      TEXT,
    downloaded_at   TEXT,
    status          TEXT NOT NULL DEFAULT 'header' -- header | ok | error | skipped_too_large | deleted_remote
);

CREATE INDEX idx_message_folder ON message(folder_id, sent_at DESC);
CREATE INDEX idx_message_status ON message(status, downloaded);
```

Migración desde una versión anterior: `ALTER TABLE … ADD COLUMN` y marcar `downloaded = 1` donde `eml_path` no esté vacío.

### 6.2 Ficheros

```
%LOCALAPPDATA%\<Aplicación>\
├── mail.db
└── eml\<carpeta>\<id>.eml
```

- El `.eml` se escribe en `*.tmp`, se verifica el tamaño, se calcula SHA-256, se hace `fsync` y se renombra.
- Nombre basado en el id remoto, nunca en el asunto.
- Adjuntos: no se extraen por defecto (el `.eml` ya los contiene); la interfaz permite guardar uno concreto al vuelo.

---

## 7. Transporte y robustez

| Aspecto | Valor |
|---|---|
| Timeouts | conexión 10 s; lectura 60 s; descarga de cuerpo 180 s |
| Reintentos | 3 con espera 1 s, 4 s, 15 s + jitter |
| Reintentar en | 408, 425, 429, 500, 502, 503, 504, timeouts, reset de conexión |
| No reintentar en | 400, 401, 403, 404, 449 |
| `Retry-After` | si viene, manda sobre la espera calculada |
| Concurrencia | keep-alive, máximo 4 peticiones simultáneas |
| Compresión | `Accept-Encoding: gzip` para SOAP; `identity` para EAS |
| User-Agent | estable, p. ej. `RTVA-Mail/1.0` |
| Límite por mensaje | 50 MB por defecto, configurable |

Clasificación de errores:

```
Transient   → reintentar (red, 429, 5xx)
Auth        → abortar; pedir contraseña o renovar token según el código
Protocol    → abortar la operación y registrar el Trace
Item        → aislar ese mensaje y continuar con el resto
Fatal       → abortar (configuración, TLS)
```

Si la aplicación puede ejecutarse dos veces a la vez, usar un bloqueo exclusivo sobre la base (`busy_timeout` + tabla de bloqueo).

---

## 8. Lectura y presentación de mensajes

Aquí se concentran los fallos que no aparecen en las pruebas de protocolo.

### 8.1 Parseo MIME

- `HtmlBody` para el HTML; si no existe, `TextBody` dentro de `<pre>`.
- Resolver `cid:` a `data:` URI: recorrer las partes `image/*` con `ContentId`, decodificar y sustituir en el HTML.
- Codificaciones habituales: `base64`, `quoted-printable`, UTF-8 e ISO-8859-1. Usar una biblioteca MIME madura; no implementarlo a mano.

### 8.2 Adjuntos

`MimeKit.Message.Attachments` **solo** incluye las partes con `Content-Disposition: attachment`. Muchos correos traen adjuntos inline con nombre (imágenes, firmas) y el servidor los marca con `a`; con ese API se mostraban **0 adjuntos** en un mensaje que tenía 4.

```csharp
foreach (var entity in message.BodyParts)
{
    var disposition = entity.ContentDisposition;
    var name = disposition?.FileName ?? (entity as MimePart)?.FileName;
    var isAttachment = disposition is { Disposition: ContentDisposition.Attachment };
    if (!isAttachment && string.IsNullOrWhiteSpace(name)) continue;
    // listar / guardar
}
```

El equivalente en otras bibliotecas: recorrer todas las partes MIME y filtrar por disposición `attachment` **o** por presencia de nombre de fichero.

### 8.3 Visor: fondo oscuro y contraste

**Síntoma:** algunos correos se ven con letras negras sobre fondo negro.

**Causa (reproducida con WebView2 157 en Windows en modo oscuro):** el motor hereda `prefers-color-scheme: dark` y pinta el **lienzo** del documento casi negro, aunque `body` y `html` tengan fondo transparente (`getComputedStyle` devuelve `rgba(0,0,0,0)`). Los correos de Zimbra fijan `color:#000000` en cada `div`, así que el texto desaparece. Afecta solo a los mensajes con color explícito, de ahí que parezca aleatorio.

Corrección en tres capas:

1. En el HTML del lector:

```html
<meta name="color-scheme" content="light">
<style>:root{color-scheme:light}html,body{background:#ffffff}</style>
```

2. En el control de render:

```csharp
Reader.DefaultBackgroundColor = System.Drawing.Color.White;
Reader.CoreWebView2.Profile.PreferredColorScheme = CoreWebView2PreferredColorScheme.Light;
```

3. Script de contraste tras cargar el documento: calcular el **fondo efectivo** subiendo por los ancestros (un `div` con `color:#000` dentro de una banda azul no tiene fondo propio) y corregir solo si el contraste es insuficiente:

```js
function bgOf(el) {
  for (var n = el; n; n = n.parentElement) {
    var b = parse(getComputedStyle(n).backgroundColor);
    if (b && b.a > 0.5) return b;
  }
  return { r: 255, g: 255, b: 255, a: 1 };
}
// fondo oscuro + texto oscuro  → color #f0f0f0 !important
// fondo claro + texto casi blanco → color #1b1b1f !important
```

Comprobado: `#000` + `#111` → `rgb(240,240,240)`; blanco + blanco → `rgb(27,27,31)`; correo normal sin cambios. En el motor real, tras la corrección: `bodyBg=rgb(255,255,255)`, `dark=false` y captura legible.

### 8.4 Visor: límite de `NavigateToString`

`NavigateToString` falla por encima de ~2 MB. Un correo con imágenes incrustadas genera HTML de 2,5 MB, así que:

- Si `html.Length < 1_500_000`, usar `NavigateToString`.
- Si no, escribir en un fichero temporal y navegar con `file://`.
- En `NavigationStarting`, permitir esa ruta propia y cancelar el resto, abriendo los enlaces en el navegador del sistema.

### 8.5 Saneado y CSP

Eliminar `<script>`, `<iframe>`, `<object>`, `<embed>`, `<base>`, `<form>`, `<link>`, `<meta>`, atributos `on*` y URLs `javascript:`. Inyectar:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:">
```

Esto bloquea scripts y recursos remotos, incluidas las imágenes de seguimiento. La CSP no impide el script del anfitrión que aplica el ajuste de contraste.

### 8.6 Alternativa sin motor HTML

Un visor de texto plano es más simple y seguro, pero pierde formato e imágenes. Si se usa, mostrar el `TextBody` y reservar el HTML para una vista bajo demanda.

---

## 9. Seguridad y privacidad

| Requisito | Implementación |
|---|---|
| Contraseña | Nunca en el repositorio, en ajustes en claro, en logs ni en argumentos. Cifrada con DPAPI (ámbito usuario) o almacén equivalente del sistema |
| Alternativa | Variable de entorno o llavero del SO |
| Token | En memoria; si se persiste, cifrado y con caducidad. Nunca en logs |
| TLS | Verificación activa; prohibido desactivarla |
| Logs | Sin cuerpos, asuntos, direcciones ni tokens; solo ids, códigos y `Trace` |
| Ficheros | `.eml` con permisos del usuario; directorio restringido |
| Cifrado en reposo | Recomendado (BitLocker o equivalente) por ser correo corporativo |
| Retención | Cuarentena configurable (30 días por defecto) y purga documentada |
| RGPD | Minimización (solo el buzón del usuario), registro de ejecuciones, sin reenvío a terceros |
| Dependencias | Versiones fijadas; auditoría de paquetes en CI |

**Rotación:** si la contraseña se ha compartido por canales informales, debe rotarse. Ni este documento ni el código contienen la contraseña.

---

## 10. Configuración de la aplicación

| Campo | Ejemplo | Notas |
|---|---|---|
| Servidor | `https://hermes.rtva.es` | Sin barra final; solo 443 |
| Cuenta | `usuario@rtva.es` | Buzón completo, obligatorio |
| Contraseña | — | Cifrada; nunca en claro en disco ni en logs |
| Sincronización automática | 15 min (1–1440) | Temporizador; manual si se desactiva |
| Carpetas | todas las de tipo correo | Configurable |
| Límite por mensaje | 50 MB | Los mayores se marcan `skipped_too_large` |
| Retención de cuarentena | 30 días | Borrados remotos |
| Extraer adjuntos | no | El `.eml` ya los contiene |

Persistencia de ajustes en un fichero local (`settings.json`) con servidor, cuenta, intervalo y contraseña cifrada en base64. La contraseña **nunca** se escribe en el repositorio ni se muestra en la interfaz.

---

## 11. Plan de pruebas

Las cifras de referencia provienen de la referencia canónica §7 y de la cuenta de pruebas descrita allí.

### 11.1 Unitarias (sin servidor)

| ID | Caso | Resultado esperado |
|---|---|---|
| U1 | Delta con `<m ids>` dentro de `<folder>`, `<deleted>` y `more="1"` | ids y borrados correctos; se itera |
| U2 | Búsqueda con `<su>`, `<e t="f">`, `f="a"` | asunto, remitente, fecha y adjunto mapeados |
| U3 | Mensaje mayor que el límite configurado | `skipped_too_large`, sin descarga |
| U4 | Reejecución sobre el mismo lote | 0 descargas nuevas, 0 duplicados |
| U5 | Corte tras escribir `.eml` y antes del commit | Tras reiniciar, el mensaje termina `ok` una sola vez |
| U6 | Token caducado | Renueva y repite la petición |
| U7 | Token de carpeta inválido | Reinicia la carpeta sin borrar `.eml` |
| U8 | `.eml` base64 con adjunto grande y acentos | Bytes intactos; SHA-256 estable |
| U9 | HTML de 3 MB con imágenes `cid:` | Se sirve desde fichero, no desde `NavigateToString` |
| U10 | Correo con `#000` sobre fondo oscuro | Texto legible tras el ajuste de contraste |

### 11.2 Integración (servidor real, cuenta de pruebas)

| ID | Caso | Resultado esperado |
|---|---|---|
| I1 | Autenticación con el buzón completo | 200, `authToken`, `lifetime` ≈ 48 h |
| I2 | Autenticación con contraseña incorrecta | `account.AUTH_FAILED`, sin reintentos |
| I3 | Autenticación con `DOMINIO\usuario` | `account.AUTH_FAILED` |
| I4 | Árbol de carpetas | 19 carpetas; Inbox con 793 mensajes |
| I5 | Sincronización de cabeceras de las 9 carpetas | **1 554 filas en ~5,4 s** y **0 `.eml`** en disco |
| I6 | Delta con token de Archive | 41 ids y después `changed=0` |
| I7 | Descarga del mensaje `17438` | **2 625 302 B = `s`**, MIME con 8 partes y 4 adjuntos |
| I8 | Descarga del mensaje `16924` | **25 690 819 B = `s`** |
| I9 | Descarga sin cookie y con `?auth=` | 401 en ambos casos |
| I10 | `raw=1` sin `useContentUrl` | Tamaño distinto de `s`: camino rechazado |
| I11 | Abrir un mensaje desde la lista | Se descarga **1** `.eml`; el resto sigue solo con cabecera |
| I12 | Segunda sincronización sin cambios | `changed=0`; 0 descargas |
| I13 | Leer mensajes desde el cliente y mirar el webmail | El buzón sigue sin cambios de leído |
| I14 | Correo con fondo oscuro y texto negro | Se muestra legible |
| I15 | Mensaje con 4 adjuntos inline | Se listan los 4 |

### 11.3 Criterios de aceptación

1. Sincroniza las cabeceras de las 9 carpetas de correo (**1 554** mensajes) en menos de 30 s sin descargar ningún cuerpo.
2. Abre cualquier mensaje: el `.eml` descargado coincide **al byte** con el atributo `s`.
3. Segunda ejecución sin cambios: 0 descargas, 0 duplicados, menos de 10 s.
4. Ningún mensaje cambia de estado leído/no leído ni de carpeta por acción del cliente.
5. Corte forzado a mitad de sincronización: al relanzar no se pierde ni se duplica nada.
6. Todos los correos se leen con texto legible, también con el sistema en modo oscuro.
7. Los mensajes con adjuntos muestran la lista completa y permiten guardarlos.
8. Los `.eml` descargados se abren correctamente en un cliente de correo externo.

---

## 12. Riesgos y límites conocidos

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R1 | Limitación de peticiones por IP del servidor | 429/503 intermitentes | Concurrencia ≤ 4 y espera creciente; pedir exención al administrador |
| R2 | SOAP restringido por IP en el futuro | 403 en `/service/soap` | Verificar I1 desde la red real de ejecución |
| R3 | Cuenta con doble factor | `account.AUTH_FAILED` | Contraseña de aplicación |
| R4 | Rotación de contraseña | Sincronización detenida | Mensaje claro y reintento tras actualizarla |
| R5 | `view` ausente en algunas carpetas | Carpetas ignoradas por error | Tratar como correo salvo tipo conocido no-mensaje |
| R6 | Buzón de 724 MB | Espacio y tiempo | Cabeceras por defecto; cuerpos bajo demanda; ≥ 1,2 GB si se descarga todo |
| R7 | Cambios de versión en el servidor | Ruptura de alguna respuesta | Pruebas de integración I4–I10 como red de seguridad |
| R8 | Correos con HTML muy pesado | Lentitud al abrir | Servir desde fichero; imágenes `cid:` ya resueltas |

---

## 13. Estado del cliente de referencia (2026-11-20)

Implementado y probado:

| Capacidad | Detalle |
|---|---|
| Sincronización incremental | Marca de agua por fecha; pasada completa periódica; **2 cabeceras en 0,9 s** frente a 1 554 en 3,4 s |
| Búsqueda local | Índice FTS5 sobre asunto, remitente y cuerpo descargado, con filtro por carpeta |
| Hilos | Agrupación por conversación (`cid`) con el asunto como título del grupo |
| Saneado con parser | AngleSharp con lista blanca y aviso de enlaces engañosos |
| Cuota de caché | Expurgo LRU de cuerpos no fijados y marca «fijar offline» |
| Adjuntos | Abrir, previsualizar con la aplicación del sistema y guardar todos |
| Impresión | Imprimir o guardar como PDF desde el visor |
| Avisos | Contador de no leídos en el título y en el árbol, aviso sonoro al sincronizar |
| Diagnóstico | Registro local sin contenido en `%LOCALAPPDATA%\RtvaMail\rtvamail.log` |
| Archivador | `src/RtvaMail.Archiver`: `sync`, `download`, `verify`, `export`, `manifest`, `status`, `smoke` |
| Pruebas | 22 unitarias del parser, saneado, índice, cuota, migración, mbox y nombres de fichero |
| Carpeta de pruebas | Parámetro `--limit` y `--max-mb` para descargas controladas |

Pendiente y por qué:

| Idea | Bloqueo |
|---|---|
| Multi-cuenta | Requiere migración de claves primarias y decisión de producto |
| Cifrado de la base (SQLCipher) | Requiere empaquetar el proveedor cifrado y gestionar la clave |
| S/MIME con validación | Requiere política de confianza y revocación; hoy solo se indica «firmado» |
| Instalador MSIX firmado | Requiere certificado de firma de código |
| Bandeja del sistema | Hoy el aviso es contador + sonido; la bandeja exige WinForms o WinRT |

---

## Anexo — Orden de implementación

| Fase | Entregable | Criterio de salida |
|---|---|---|
| 0 | Transporte HTTPS + autenticación | 200 con `authToken` y `lifetime` |
| 1 | Árbol de carpetas + base local | Se listan las 19 carpetas con sus conteos |
| 2 | `Search` paginado + tabla de mensajes (solo cabeceras) | 1 554 filas, 0 `.eml`, < 30 s |
| 3 | Descarga bajo demanda del cuerpo | Tamaño = `s`, apertura desde la lista |
| 4 | `Sync` para borrados y token; reanudación; cuarentena | Criterios 3 y 5 |
| 5 | Visor: MIME, `cid:`, saneado, CSP, contraste, 2 MB | Criterios 6 y 7 |
| 6 | Ajustes, cifrado de contraseña, sincronización automática | Uso diario sin configuración manual |
| 7 (opcional) | Descarga completa del buzón | Criterio 2 y presupuesto de espacio |
| 8 (opcional) | Backend EAS | Referencia canónica §8.1 |
