# `hermes.rtva.es` — referencia de uso del servidor de correo

**Versión:** 1.0
**Fecha:** 2026-11-20
**Ámbito:** documentación del servicio (protocolos, operaciones, semántica y errores). No describe ninguna implementación de cliente.
**Referencia canónica:** este documento lo es para todo lo relativo al servidor. Si otro documento discrepa en endpoints, operaciones, campos o cifras, manda este.
**Documento complementario:** [`docs/especificacion-cliente-sync-correo.md`](especificacion-cliente-sync-correo.md) (cómo construir un cliente que consuma este servidor).
**Servidor:** `hermes.rtva.es` — Zimbra Collaboration detrás de nginx
**Base URL:** `https://hermes.rtva.es`
**Verificación:** todas las cifras y formas de respuesta marcadas como *verificado* se obtuvieron contra el servidor real con una cuenta con buzón completo el 2026-11-20.

Este documento es independiente de cualquier lenguaje, biblioteca o plataforma. Describe únicamente qué ofrece el servidor, cómo se le habla y qué garantiza. No incluye arquitectura de cliente, modelos de datos locales ni decisiones de interfaz: eso pertenece al documento complementario.

---

## 1. Convenciones

- Todo el tráfico va por **HTTPS en el puerto 443**. No hay otro puerto publicado.
- El certificado TLS es válido para `hermes.rtva.es` y el servidor envía HSTS: la verificación de certificado debe estar activa y no se contempla desactivarla.
- Los cuerpos SOAP son **XML 1.2 (SOAP 1.2) en UTF-8**. Namespaces usados: `urn:zimbra` (contexto), `urn:zimbraAccount` (autenticación), `urn:zimbraMail` (correo).
- Los identificadores (`id` de carpeta y de mensaje) son **opacos**: no se interpretan, no se construyen y no se deducen.
- Las fechas del servidor llegan en **milisegundos epoch** salvo donde se indique.
- Los tamaños (`s`) están en **bytes** y se refieren al mensaje RFC822 completo.

---

## 2. Superficie del servicio (verificado)

| Ruta | Método | Autenticación | Estado | Uso |
|---|---|---|---|---|
| `/service/soap` | POST | `authToken` en el cuerpo (salvo `AuthRequest`) | Activo | API principal |
| `/service/content/get?id=<id>` | GET | Cookie `ZM_AUTH_TOKEN` | Activo | Descarga del RFC822 |
| `/Microsoft-Server-ActiveSync` | POST/OPTIONS | HTTP Basic | Activo (`MS-ASProtocolVersions: 2.0…16.1`) | Protocolo alternativo (EAS) |
| `/Autodiscover/Autodiscover.xml` | POST | HTTP Basic | Activo (401 sin credenciales) | Descubrimiento; innecesario con endpoint fijo |
| `/ews/exchange.asmx`, `/ews/services.wsdl` | — | — | **404** | EWS no instalado |
| TCP 993, 143, 587, 465, 25 | — | — | **timeout** | IMAP/SMTP no publicados |

Consecuencias:

1. **SOAP es la vía recomendada**: API nativa, documentada, sin licencias adicionales, y entrega el mensaje original sin reensamblar.
2. **EWS no existe en este servidor.** La extensión `zimbraews` no está desplegada; un 404 aquí no es un error de configuración del cliente.
3. **IMAP y SMTP no son accesibles desde Internet.** Su apertura es una decisión de infraestructura, no del cliente.

---

## 3. Autenticación y sesión

### 3.1 `AuthRequest`

```xml
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Header/>
  <soap:Body>
    <AuthRequest xmlns="urn:zimbraAccount">
      <account by="name">usuario@rtva.es</account>
      <password>***</password>
    </AuthRequest>
  </soap:Body>
</soap:Envelope>
```

Respuesta correcta (HTTP 200):

```xml
<AuthResponse xmlns="urn:zimbraAccount">
  <authToken>…opaco, 299 caracteres en la cuenta de referencia…</authToken>
  <lifetime>172799998</lifetime>
  <session id="…" type="soap"/>
</AuthResponse>
```

### 3.2 Uso del token

Todas las peticiones posteriores lo incluyen en el `Header`:

```xml
<soap:Header>
  <context xmlns="urn:zimbra"><authToken>…</authToken></context>
</soap:Header>
```

Reglas verificadas:

- El identificador válido para `account by="name"` es **el buzón completo** (`usuario@rtva.es`). Las formas con dominio (`DOMINIO\usuario`) o el usuario suelto devuelven `account.AUTH_FAILED` **incluso con la contraseña correcta**.
- `lifetime` viene en **milisegundos**: `172 799 998 ms ≈ 48 h`.
- El token es único por sesión; conviene reutilizarlo durante toda la sesión y renovarlo antes de caducar.
- Se debe emitir **una sola** `AuthRequest` por sesión: el servidor limita las sesiones simultáneas por cuenta.
- Cuentas con doble factor requieren contraseña de aplicación; con la contraseña normal el resultado es `account.AUTH_FAILED`.

### 3.3 `account.AUTH_FAILED` es ambiguo

El mismo código y el mismo texto se devuelven cuando la contraseña es incorrecta, cuando la cuenta no existe y cuando el identificador tiene un formato no admitido. El texto del fault repite literalmente el identificador recibido.

Por tanto, el cliente **no debe** interpretar ese código como "usuario inexistente" ni probar variantes de identificador: debe reportarlo tal cual y volver a solicitar las credenciales.

### 3.4 Contrato de solo lectura

El servidor permite escribir, pero el uso previsto de esta API es **exclusivamente de lectura**. Ninguna operación descrita aquí modifica el buzón. En particular:

- `GetMsg` debe llevar `read="0"`; omitirlo marca el mensaje como leído para el usuario.
- No se usan `MsgActionRequest`, `MoveItem`, `DeleteItem` ni equivalentes.

---

## 4. Operaciones SOAP

Todas: `POST /service/soap`, `Content-Type: text/xml; charset=utf-8`, con el `context` de §3.2 salvo `AuthRequest`.

### 4.1 `GetFolderRequest` — árbol de carpetas

```xml
<soap:Body>
  <GetFolderRequest xmlns="urn:zimbraMail"><folder/></GetFolderRequest>
</soap:Body>
```

Devuelve el árbol completo. Atributos de cada `<folder>`:

| Atributo | Significado |
|---|---|
| `id` | identificador opaco de la carpeta |
| `name` | nombre visible |
| `l` | `id` de la carpeta padre |
| `absFolderPath` | ruta absoluta (`/Inbox`, `/Sent/2024`…) |
| `view` | tipo de contenido: `message`, `appointment`, `contact`, `task`, `document`… |
| `n` | número de elementos (para `message`: mensajes) |
| `u` | no leídos |
| `s` | tamaño total en bytes |
| `link` | presente si es una carpeta montada/compartida |

Reglas de interpretación:

- `view` **puede faltar** aunque la carpeta contenga correo (ocurre en `Trash`, `Personales`, `Fuentes RSS`). Si falta, tratarla como correo salvo que el nombre corresponda a un tipo no-mensaje conocido (p. ej. RSS).
- Las carpetas de tipo `message` son las únicas que interesan para correo. El resto (`appointment`, `contact`, `task`, `document`) quedan fuera de un cliente de correo.
- Los ids no son canónicos ni estables entre instalaciones: `Archive` puede ser `4820` y `Outbox` `14980`. Hay que resolverlos siempre por nombre o ruta.

Inventario de la cuenta de referencia (19 carpetas):

| id | carpeta | `view` | `n` | `s` |
|---|---|---|---|---|
| `2` | Inbox | `message` | 793 | 475 132 138 B |
| `5` | Sent | `message` | 713 | 276 743 499 B |
| `3` | Trash | *(ausente)* | 7 | 1 210 196 B |
| `4820` | Archive | `message` | 41 | 6 396 714 B |
| `4` | Junk | `message` | 0 | 0 |
| `6` | Drafts | `message` | 0 | 0 |
| `14` | Chats | `message` | 0 | 0 |
| `14980` | Outbox | `message` | 0 | 0 |
| `260` | Personales | *(ausente)* | 0 | 0 |
| `8501` | Fuentes RSS | *(ausente)* | 0 | 0 |
| `1` | USER_ROOT | — | 0 | 0 |
| `16`, `2815`, `8500`, `20` | Briefcase, Presupuestos, Notes, Files shared | `document` | 0–1 | — |
| `10`, `7`, `13`, `15` | Calendar, Contacts, Emailed Contacts, Tasks | `appointment`/`contact`/`task` | — | — |

Correo total de la cuenta: **1 554 mensajes, 759 482 547 B (724 MB)**.

### 4.2 `SearchRequest` — metadatos y paginación

Es la única operación que devuelve **asunto, remitente, fecha y tamaño** sin descargar el mensaje.

```xml
<soap:Body>
  <SearchRequest xmlns="urn:zimbraMail" types="message" sortBy="dateDesc"
                 offset="0" limit="500" query="in:&quot;/Inbox&quot;"/>
</soap:Body>
```

Respuesta por mensaje (forma real):

```xml
<m id="17438" s="2625302" d="1795179963000" f="an" l="2" cid="17206">
  <e t="f" d="JAVIER LOBO CASTRO" a="jlobo@rtva.es"/>
  <su>Re: Afectación de apagado…</su>
  <fr>Buenos días. En referencia al…</fr>
</m>
```

| Campo | Significado |
|---|---|
| `id` | identificador opaco del mensaje |
| `s` | tamaño exacto del RFC822 en bytes |
| `d` | fecha en milisegundos epoch |
| `f` | flags: `a` = tiene adjuntos, `u` = no leído |
| `l` | carpeta contenedora |
| `cid` | identificador de conversación (opaco) |
| `<e t="f">` | remitente; `p` = nombre completo, `d` = nombre de pila, `a` = dirección |
| `<su>` | asunto |
| `<fr>` | fragmento del cuerpo (~100 caracteres) |

Reglas:

- **Paginación:** `offset` + `limit`; iterar mientras la página devuelva exactamente `limit` elementos. `<SearchResponse>` trae `offset`, `more` y `sortBy`, pero **no publica `total`** en este servidor: se pagina hasta que `more="0"`.
- **Filtro por fecha:** solo filtra `after:M/D/AAAA` (por ejemplo `after:11/19/2026`). Las formas `after:AAAA/MM/DD` y `after:AAAAMMDD` se aceptan **sin error pero se ignoran** y devuelven la carpeta completa. Verificado.
- **Orden:** `sortBy="dateDesc"` para listar; `sortBy="dateAsc"` al recorrer histórico completo, porque los mensajes nuevos no desplazan la paginación.
- **Consulta:** `in:"/Inbox"`, `after:2024/01/01`, `before:2024/12/31`; dentro del atributo XML las comillas van como `&quot;`.
- **Coste medido:** 1 554 cabeceras de las 9 carpetas de correo en **5,4 s** con páginas de 500 (~13 peticiones). Una página de 500 ocupa del orden de 100–300 KB por el `<fr>`.
- `GetMsg` con `raw="0"` **no** sustituye a `Search`: en este servidor devuelve `<su>` vacío. No usarlo para obtener metadatos en lote.

### 4.3 `SyncRequest` — cambios y borrados

```xml
<soap:Body>
  <SyncRequest xmlns="urn:zimbraMail" l="2" msgCutoff="0" changeLimit="1000" deleteLimit="1000"/>
</soap:Body>
```

| Atributo | Significado |
|---|---|
| `l` | id de la carpeta a sincronizar |
| `token` | token devuelto por la llamada anterior; **omitir** para un delta inicial |
| `msgCutoff` | descarta mensajes anteriores a N segundos epoch |
| `changeLimit` | máximo de ids modificados por respuesta |
| `deleteLimit` | máximo de ids borrados por respuesta |

Forma real de la respuesta:

```xml
<SyncResponse xmlns="urn:zimbraMail" s="759710383" md="1795210794" token="138933">
  <folder id="2" name="Inbox" absFolderPath="/Inbox" view="message"
          n="793" s="475132138" u="104" l="1" deletable="0">
    <meta/><acl/><retentionPolicy/>
    <m ids="17438,17436,17435,17434,…"/>
  </folder>
  <deleted><m ids="17001,17002"/></deleted>
</SyncResponse>
```

Hechos verificados:

- El `token` de continuación viaja **en `SyncResponse`** (no en un `<sync>` hijo). Repetir la llamada con ese token devuelve `changed=0` (comprobado en `Archive`: 41 ids y después 0).
- Los ids nuevos o modificados están en el atributo `ids` de un `<m>` **dentro de `<folder>`**; no son hijos directos de `SyncResponse`. Un recorrido que solo mire los hijos directos obtiene cero mensajes.
- Los borrados llegan en `<deleted><m ids="…"/></deleted>`; conviene aceptar también `ids` directamente en el elemento `deleted`.
- **El delta no contiene metadatos**: ni asunto, ni remitente, ni fecha, ni tamaño. Para pintar una lista hay que combinar con `SearchRequest`.
- Una sola página puede incluir los 793 ids de una carpeta (`more` ausente). No se debe asumir un tamaño máximo de página.
- Si aparece `more="1"`, hay que seguir iterando antes de considerar la carpeta sincronizada.
- Un token inválido (`service.INVALID_SYNC_TOKEN` o fault equivalente) obliga a reiniciar la carpeta: repetir sin `token`.

Uso típico: `Search` para el listado, `Sync` para detectar borrados y mantener el token de la carpeta.

### 4.4 `GetMsgRequest` — preparación de la descarga

```xml
<soap:Body>
  <GetMsgRequest xmlns="urn:zimbraMail">
    <m id="17438" read="0" raw="1" useContentUrl="1"/>
  </GetMsgRequest>
</soap:Body>
```

| Atributo | Efecto |
|---|---|
| `read="0"` | **obligatorio**: no altera el estado de lectura del usuario |
| `raw="1"` | devuelve el mensaje RFC822 |
| `useContentUrl="1"` | devuelve una URL de descarga en lugar del contenido incrustado |

Respuesta:

```xml
<GetMsgResponse xmlns="urn:zimbraMail">
  <m id="17438" s="2625302" …>
    <content url="/service/content/get?id=17438"/>
  </m>
</GetMsgResponse>
```

`useContentUrl="1"` **no es una optimización, es un requisito de integridad**: el contenido incrustado no es byte-exacto (ver §5.2).

### 4.5 Content servlet — descarga del mensaje

```
GET /service/content/get?id=17438 HTTP/1.1
Host: hermes.rtva.es
Cookie: ZM_AUTH_TOKEN=<authToken>
```

Comportamiento verificado:

| Aspecto | Resultado |
|---|---|
| Autenticación | **solo cookie**; sin ella, 401; con `?auth=<token>` en la URL, también 401 |
| Cuerpo | bytes RFC822 exactos |
| Tamaño | coincide **al byte** con el atributo `s` del `GetMsg`: 2 625 302 B y 25 690 819 B comprobados |
| Cabeceras | respuesta *chunked*, **sin `Content-Length`**, `Content-Type: text/plain` |
| Estabilidad | descargas repetidas producen el mismo contenido (hash idéntico) |
| Límite | el servlet entrega mensajes por encima de `zimbraMailContentMaxSize` (10 MB), que solo afecta al contenido incrustado en SOAP |

Reglas de uso:

- No validar por `Content-Length` ni por `Content-Type`: comparar los bytes recibidos con `s`.
- La URL devuelta por `GetMsg` se solicita **tal cual**: no se construye a mano ni se le añaden parámetros.
- La descarga no altera el estado del mensaje (el `read="0"` de la petición previa lo garantiza).

---

## 5. Semántica de los datos

### 5.1 Identificadores

- `id` de mensaje y de carpeta son opacos y estables dentro de la cuenta.
- Un mensaje conserva su `id` aunque cambie de carpeta; el campo `l` (en `Search`) o `folder_id` de la respuesta indica su ubicación actual.
- Los ids no son portables entre cuentas ni entre instalaciones.

### 5.2 Tamaño e integridad

- `s` es el tamaño exacto del RFC822 y sirve como oráculo: si los bytes descargados no coinciden, la descarga es inválida.
- El camino de contenido incrustado (`raw=1` sin `useContentUrl`) **pierde bytes**: 14 142 B incrustados frente a 14 401 B reales en el mismo mensaje (se pierden los CR). Un fichero guardado así no es el mensaje original aunque un lector MIME lo abra.
- Mensaje mayor comprobado: **25 690 819 B**, entregado íntegro.

### 5.3 Fechas y flags

- `d` en `Search` y en `SyncResponse` va en milisegundos epoch.
- `f` contiene las letras de flags del servidor: `a` adjuntos, `u` no leído.
- `n`, `u`, `s` de la carpeta son los que reporta el servidor en ese momento y pueden cambiar entre peticiones.

### 5.4 Cuerpo del mensaje

- El contenido descargado es el **RFC822 completo** (cabeceras + cuerpo + adjuntos), tal como lo recibió el servidor.
- Requiere un analizador MIME para extraer texto, HTML y adjuntos; las imágenes referenciadas por `cid:` se resuelven contra las partes MIME del propio mensaje.
- El servidor no convierte ni normaliza el mensaje: lo que entrega es lo que almacena.

---

## 6. Errores

### 6.1 Estructura del fault

Los errores de negocio llegan con **HTTP 500** y un `soap:Fault`:

```xml
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Header><context xmlns="urn:zimbra"/></soap:Header>
  <soap:Body>
    <soap:Fault>
      <soap:Code><soap:Value>soap:Sender</soap:Value></soap:Code>
      <soap:Reason><soap:Text>authentication failed for [usuario@rtva.es]</soap:Text></soap:Reason>
      <soap:Detail>
        <Error xmlns="urn:zimbra">
          <Code>account.AUTH_FAILED</Code>
          <Trace>qtp1608297024:1795209245036:c012929f56426125</Trace>
        </Error>
      </soap:Detail>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>
```

El `Trace` identifica la petición en `mailbox.log` del servidor y es lo único que hay que conservar para diagnóstico. El texto del `Reason` puede repetir datos de entrada.

### 6.2 Códigos

| Código | HTTP | Significado | Acción esperada |
|---|---|---|---|
| `service.AUTH_REQUIRED` | 500 | Falta `authToken` | Autenticar |
| `service.AUTH_EXPIRED` | 500 | Token caducado | Renovar y repetir la misma petición |
| `account.AUTH_FAILED` | 500 | Credenciales o identificador rechazados | Detener; volver a pedir credenciales |
| `service.INVALID_REQUEST` | 500 | XML o atributo mal formado | Corregir la petición |
| `service.INVALID_SYNC_TOKEN` | 500 | Token de carpeta inválido | Reiniciar la carpeta sin `token` |
| `mail.QUERY_PARSE_ERROR` | 500 | Consulta de búsqueda inválida | Revisar comillas y sintaxis |
| `mail.NO_SUCH_PART` | 500 | Parte MIME inexistente | Descartar esa parte o ese mensaje |
| HTTP 401 (servlet) | 401 | Falta cookie o es inválida | Renovar token (§3) |

### 6.3 Criterio de reintento

| Situación | Reintentar |
|---|---|
| Timeouts, cortes de conexión, 408, 425, 429, 500 transitorio, 502, 503, 504 | Sí, con espera creciente |
| `service.AUTH_EXPIRED` | Sí, tras renovar el token |
| `service.INVALID_SYNC_TOKEN` | Sí, reiniciando la carpeta |
| `account.AUTH_FAILED`, 401 del servlet, 403, 404 | No |
| `service.INVALID_REQUEST`, `mail.QUERY_PARSE_ERROR` | No: es un fallo de la petición |
| `mail.NO_SUCH_PART` | No: aislar el mensaje |

Si la respuesta incluye `Retry-After`, ese valor prevalece sobre cualquier espera calculada.

---

## 7. Límites y comportamiento esperado del servicio

| Aspecto | Dato |
|---|---|
| Token | `lifetime` ≈ 48 h; una sesión por cuenta recomendada |
| Sesiones concurrentes | limitadas por cuenta; conviene reutilizar el token |
| Mensaje máximo entregado | verificado 25,7 MB; el límite de 10 MB solo aplica al contenido incrustado en SOAP |
| Tamaño de página en `Search` | 500 elementos es un valor seguro y medido |
| Concurrencia de peticiones | el servidor aplica limitación de peticiones por IP; mantener pocas conexiones simultáneas y espera creciente ante 429/503 |
| Compresión | SOAP admite `Accept-Encoding: gzip` |
| Formatos de respuesta | XML UTF-8; la descarga del mensaje es binaria sin `Content-Length` |
| Volumen de la cuenta de referencia | 1 554 mensajes / 724 MB |
| Coste de listar cabeceras | 1 554 mensajes de 9 carpetas en 5,4 s (~13 peticiones) |
| Coste de descargar un cuerpo | 2,5 MB en 0,45 s (medido) |

Ninguna de estas cifras es una cuota contractual: son el comportamiento observado en la cuenta de referencia y sirven para dimensionar y para detectar regresiones.

---

## 8. Otros protocolos del servidor

### 8.1 Exchange ActiveSync (EAS)

Disponible y autenticado con HTTP Basic, pero **no recomendado** para obtener el mensaje original.

| Elemento | Valor |
|---|---|
| Endpoint | `POST /Microsoft-Server-ActiveSync?Cmd=…&User=…&DeviceId=…&DeviceType=…` |
| Autenticación | `Authorization: Basic base64("DOMINIO\\usuario:contraseña")` (aquí sí se usa el formato con dominio) |
| Cuerpo | WBXML binario (`application/vnd.ms-sync.wbxml`), no XML de texto |
| Versiones anunciadas | `2.0, 2.1, 2.5, 12.0, 12.1, 14.0, 14.1, 16.0, 16.1` (negociar con `OPTIONS`) |
| Comandos anunciados | `Sync, FolderSync, GetItem, ItemOperations, Provision, Search, Ping, GetItemEstimate, MoveItems, Settings` |

Secuencia mínima: `OPTIONS` → `Provision` (fase 1 y 2, devuelve `PolicyKey`) → `FolderSync` → `Sync` con `SyncKey=0` (solo devuelve clave nueva, sin elementos) → `Sync` con esa clave.

Limitación: el contenido se reconstruye desde partes MIME; no se garantiza un RFC822 idéntico al almacenado. Para "obtener el mensaje tal cual", SOAP es superior.

### 8.2 Autodiscover

`POST /Autodiscover/Autodiscover.xml` exige Basic y está operativo, pero con el endpoint fijo no aporta nada. No es necesario para usar el servicio.

### 8.3 IMAP / SMTP

No accesibles (puertos filtrados). Si en el futuro se publicara IMAPS, el acceso sería por `SELECT` + `UID FETCH` con `UIDVALIDITY`, y `BODY.PEEK[]` para no marcar como leído.

---

## 9. Ejemplos de extremo a extremo

Sesión completa en cuatro peticiones (HTTP en crudo, sin dependencia de ninguna herramienta):

**1. Autenticar**

```
POST /service/soap HTTP/1.1
Host: hermes.rtva.es
Content-Type: text/xml; charset=utf-8

<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Header/>
  <soap:Body>
    <AuthRequest xmlns="urn:zimbraAccount">
      <account by="name">usuario@rtva.es</account>
      <password>***</password>
    </AuthRequest>
  </soap:Body>
</soap:Envelope>
```

→ `200`, `<authToken>` y `<lifetime>`.

**2. Listar carpetas**

```
POST /service/soap HTTP/1.1
Host: hermes.rtva.es
Content-Type: text/xml; charset=utf-8

<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Header><context xmlns="urn:zimbra"><authToken>TOKEN</authToken></context></soap:Header>
  <soap:Body><GetFolderRequest xmlns="urn:zimbraMail"><folder/></GetFolderRequest></soap:Body>
</soap:Envelope>
```

→ árbol de 19 carpetas; Inbox `2` con `n=793`.

**3. Pedir la primera página de cabeceras de Inbox**

```
POST /service/soap HTTP/1.1
Host: hermes.rtva.es
Content-Type: text/xml; charset=utf-8

<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Header><context xmlns="urn:zimbra"><authToken>TOKEN</authToken></context></soap:Header>
  <soap:Body>
    <SearchRequest xmlns="urn:zimbraMail" types="message" sortBy="dateDesc"
                   offset="0" limit="500" query="in:&quot;/Inbox&quot;"/>
  </soap:Body>
</soap:Envelope>
```

→ `<SearchResponse total="793">` con 500 `<m>`; repetir con `offset=500` para el resto.

**4. Descargar un mensaje**

```
POST /service/soap HTTP/1.1
Host: hermes.rtva.es
Content-Type: text/xml; charset=utf-8

<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Header><context xmlns="urn:zimbra"><authToken>TOKEN</authToken></context></soap:Header>
  <soap:Body>
    <GetMsgRequest xmlns="urn:zimbraMail">
      <m id="17438" read="0" raw="1" useContentUrl="1"/>
    </GetMsgRequest>
  </soap:Body>
</soap:Envelope>
```

→ `<content url="/service/content/get?id=17438"/>`

```
GET /service/content/get?id=17438 HTTP/1.1
Host: hermes.rtva.es
Cookie: ZM_AUTH_TOKEN=TOKEN
```

→ 2 625 302 B de RFC822 (igual a `s`).

---

## 10. Comprobaciones de conformidad

Sirven para validar que se habla correctamente con el servidor, con independencia de la implementación.

| ID | Comprobación | Resultado correcto |
|---|---|---|
| C1 | `AuthRequest` con el buzón completo | 200, `authToken` y `lifetime` ≈ 48 h |
| C2 | `AuthRequest` con `DOMINIO\usuario` | 500 `account.AUTH_FAILED` |
| C3 | `GetFolder` | 19 carpetas; Inbox `2` con 793 mensajes |
| C4 | `Search` paginado de las 9 carpetas de correo | 1 554 mensajes, ~5,4 s, sin descargar cuerpos |
| C5 | `Search` en una carpeta | `total` coherente con `n` de la carpeta |
| C6 | `Sync` de `Archive` con token | 41 ids y después `changed=0` |
| C7 | `GetMsg` + servlet sobre un mensaje | bytes descargados = `s` |
| C8 | Descarga sin cookie / con `?auth=` | 401 en ambos casos |
| C9 | `raw=1` sin `useContentUrl` | tamaño distinto de `s`: camino no válido |
| C10 | Leer un mensaje y comprobar en el webmail | el mensaje sigue sin leer |
| C11 | Token caducado o manipulado | `service.AUTH_EXPIRED` / `service.AUTH_REQUIRED`, renovación correcta |
| C12 | Token de carpeta inválido | reinicio de la carpeta sin perder datos |

---

## 11. Resumen de referencia rápida

| Necesito | Operación |
|---|---|
| Token de sesión | `AuthRequest` → `<authToken>`, válido ≈ 48 h |
| Carpetas y conteos | `GetFolderRequest` |
| Lista de mensajes con asunto, remitente, fecha, tamaño y adjuntos | `SearchRequest` paginado (500 por página) |
| Cambios y borrados de una carpeta | `SyncRequest` con el token de la carpeta |
| Descargar el mensaje original | `GetMsg(read=0, raw=1, useContentUrl=1)` + `GET` de la URL con cookie `ZM_AUTH_TOKEN` |
| Verificar integridad | comparar bytes con `s` |
| Diagnosticar un fallo | `<Code>` y `<Trace>` del `soap:Fault` |
