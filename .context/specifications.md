# Especificaciones de Dominio y Contratos de API (`.context/specifications.md`)

## 1. Vocabulario Ubicuo del Dominio (`GLOSARIO.md`)

Para mantener la coherencia conceptual del negocio, se aplican estrictamente estas definiciones:

| Término Canónico         | Definición de Negocio                                                                         | Términos Prohibidos (Sinónimos Incorrectos) |
| ------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **Incidencia**           | Suceso que afecta al funcionamiento normal de un equipo que requiere intervención técnica.    | _Ticket_, _avería_, _fallo_, _problema_     |
| **Equipo**               | Máquina o instalación individual inventariada con número de serie y mantenimientos asociados. | _Máquina_, _aparato_, _dispositivo_         |
| **Repuesto**             | Pieza o componente fungible utilizado para reparar o mantener un equipo.                      | _Material_, _consumible_, _pieza suelta_    |
| **Petición de repuesto** | Solicitud formal de uno o varios repuestos para una incidencia o stock.                       | _Pedido interno_, _solicitud de material_   |
| **Orden de compra**      | Documento mercantil enviado a un proveedor para la adquisición de repuestos.                  | _Pedido de compra_, _PO_, _albarán_         |
| **Parte de trabajo**     | Registro técnico de tiempos, acciones realizadas y piezas sustituidas en una incidencia.      | _Informe de servicio_, _albarán de trabajo_ |
| **Técnico**              | Usuario cualificado que ejecuta diagnósticos, reparaciones y mantenimientos.                  | _Operario_, _mecánico_, _obrero_            |

---

## 2. Máquinas de Estado del Sistema (`MAQUINAS.md` & `src/lib/`)

### A. Flujo de Incidencias (`src/lib/incidentFlow.ts`)

El ciclo tiene **siete estados** y **doce pasos**, y ninguna transición se escribe
en otro sitio: la tabla que manda es `INCIDENT_STEPS`, tipada con todos los pasos y
todos los estados —un paso sin decidir por dónde pasa, o un estado al que nadie
llega, no compila—. El backend la consulta con `canAdvanceIncident` y la ficha
pregunta por ella qué botón ofrecer y por qué no, en vez de comparar estados a
mano. **Quién** puede dar cada paso está en `MAQUINAS.md`; este apartado cuenta
solo de dónde a dónde va el caso, que es lo que lee `tests/especificaciones.test.ts`
contra el código.

```mermaid
stateDiagram-v2
  %% machine: incident
  [*] --> reported
  reported --> assigned : assign
  reported --> assigned : selfAssign
  assigned --> assigned : assign
  assigned --> resolved : verifyOnsite
  repairing --> resolved : verifyOnsite
  assigned --> workshop : verifyWorkshop
  repairing --> workshop : verifyWorkshop
  assigned --> unresolved : verifyUnresolved
  repairing --> unresolved : verifyUnresolved
  workshop --> workshop : reassignWorkshop
  waitingParts --> waitingParts : reassignWorkshop
  repairing --> repairing : reassignWorkshop
  assigned --> waitingParts : waitParts
  workshop --> waitingParts : waitParts
  repairing --> waitingParts : waitParts
  waitingParts --> repairing : partsArrived
  waitingParts --> assigned : partsSettledOnsite
  waitingParts --> workshop : partsSettledWorkshop
  workshop --> resolved : closeResolved
  repairing --> resolved : closeResolved
  workshop --> unresolved : closeUnresolved
  repairing --> unresolved : closeUnresolved
  resolved --> [*]
  unresolved --> [*]
```

Dos cosas que el dibujo deja fuera a propósito. Un caso cerrado —`resolved` o
`unresolved`— **no se reabre** desde la máquina: volver a por él es una incidencia
nueva, que deja su propio rastro. Y «archivada» **no es un estado**: es lo que se
hace después con lo cerrado (`lib/archive`), y por eso no aparece aquí ni cuenta
como paso del ciclo.

El estado dice qué le pasa al caso, no dónde está el equipo: `waitingParts` y
`repairing` pueden ocurrir en el sitio o en el taller, y eso lo cuenta la entrada a
taller abierta (`isIncidentInWorkshop`). Por eso `verifyOnsite` y `closeResolved`
salen los dos desde `repairing`: el cierre lo elige `incidentCloseStep` según dónde
esté el equipo, y el backend rechaza el que no toca.

Los siete estados del ciclo son estos, con el nombre que enseña la app:

#### Estados — incident

| Estado         | Nombre                 | Qué cuenta                                                                                                                            |
| -------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `reported`     | Nueva                  | Acaba de entrar, por el formulario público o por el taller: nadie la ha mirado todavía y no es de nadie.                              |
| `assigned`     | Asignada               | Tiene técnico y se trabaja en el sitio; si el equipo se deriva, pasa a `workshop`.                                                    |
| `workshop`     | En taller              | Entrada de incidencia a taller abierta: la lleva el técnico de taller.                                                                |
| `waitingParts` | En espera de repuestos | Tiene una petición de repuesto abierta y no se trabaja hasta que llegue el material. El sitio del equipo lo dice su entrada a taller. |
| `repairing`    | En reparación          | El material ya está entregado y el trabajo sigue: en el sitio o en el taller.                                                         |
| `resolved`     | Resuelta               | Cerrada con resolución: deja su parte de trabajo si el equipo estaba relacionado.                                                     |
| `unresolved`   | Sin resolución         | Cerrada sin poder resolverla.                                                                                                         |

Los doce pasos, uno por fila:

Cada fila es una transición: desde dónde se puede dar el paso, a dónde lleva y
quién lo da. Las que comparten paso se leen juntas: `waitParts` y
`reassignWorkshop` salen de tres sitios, y `verifyOnsite`, `verifyWorkshop`,
`verifyUnresolved`, `closeResolved` y `closeUnresolved` entran desde dos.

#### Tabla de pasos — incident

| desde          | paso                                                             | a              | quién                                                                           |
| -------------- | ---------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------- |
| `reported`     | `assign` Asignar a un técnico                                    | `assigned`     | El coordinador                                                                  |
| `assigned`     | `assign` Asignar a un técnico                                    | `assigned`     | El coordinador                                                                  |
| `reported`     | `selfAssign` Autoasignarme                                       | `assigned`     | Un técnico que ve la cola                                                       |
| `assigned`     | `verifyOnsite` Verificar y resolver en el sitio                  | `resolved`     | El técnico asignado o el coordinador, con el equipo en el sitio                 |
| `repairing`    | `verifyOnsite` Verificar y resolver en el sitio                  | `resolved`     | El técnico asignado o el coordinador, con el equipo en el sitio                 |
| `assigned`     | `verifyWorkshop` Verificar y derivar a taller                    | `workshop`     | El técnico asignado o el coordinador                                            |
| `repairing`    | `verifyWorkshop` Verificar y derivar a taller                    | `workshop`     | El técnico asignado o el coordinador                                            |
| `assigned`     | `verifyUnresolved` Verificar y cerrar sin resolución             | `unresolved`   | El técnico asignado o el coordinador, con el equipo en el sitio                 |
| `repairing`    | `verifyUnresolved` Verificar y cerrar sin resolución             | `unresolved`   | El técnico asignado o el coordinador, con el equipo en el sitio                 |
| `workshop`     | `reassignWorkshop` Cambiar el técnico de taller                  | `workshop`     | El coordinador o el técnico de la orden, con el equipo en el taller             |
| `waitingParts` | `reassignWorkshop` Cambiar el técnico de taller                  | `waitingParts` | El coordinador o el técnico de la orden, con el equipo en el taller             |
| `repairing`    | `reassignWorkshop` Cambiar el técnico de taller                  | `repairing`    | El coordinador o el técnico de la orden, con el equipo en el taller             |
| `assigned`     | `waitParts` Quedar a la espera de repuestos                      | `waitingParts` | Abrir una petición de repuesto                                                  |
| `workshop`     | `waitParts` Quedar a la espera de repuestos                      | `waitingParts` | Abrir una petición de repuesto                                                  |
| `repairing`    | `waitParts` Quedar a la espera de repuestos                      | `waitingParts` | Abrir otra petición, o devolver material ya entregado                           |
| `waitingParts` | `partsArrived` Repuestos entregados                              | `repairing`    | La entrega del material de la última petición viva                              |
| `waitingParts` | `partsSettledOnsite` Cerrar la espera sin material (en el sitio) | `assigned`     | Rechazar, cancelar o devolver las peticiones, con la incidencia fuera de taller |
| `waitingParts` | `partsSettledWorkshop` Cerrar la espera sin material (en taller) | `workshop`     | Rechazar, cancelar o devolver las peticiones, con la orden de taller abierta    |
| `workshop`     | `closeResolved` Cerrar como resuelta                             | `resolved`     | El técnico que lleva el caso, al terminar el trabajo                            |
| `repairing`    | `closeResolved` Cerrar como resuelta                             | `resolved`     | El técnico que lleva el caso, al terminar el trabajo                            |
| `workshop`     | `closeUnresolved` Cerrar sin resolución                          | `unresolved`   | El técnico que lleva el caso                                                    |
| `repairing`    | `closeUnresolved` Cerrar sin resolución                          | `unresolved`   | El técnico que lleva el caso                                                    |

**Regla:** un paso solo se da si `INCIDENT_STEPS` lo admite desde el estado en el
que está la incidencia, y desde un estado cerrado no sale ninguno. La tabla de
arriba es la misma que la de `MAQUINAS.md`, contada sin la columna de permisos.

---

### B. Flujo de Peticiones de Repuesto (`src/lib/requestFlow.ts`)

Nueve estados y nueve pasos. Una petición nace **pendiente** —no hay borrador que
guardar ni estado archivado: vive en la cola hasta que se cierra en uno de sus
finales—. `onHold` recuerda de dónde salió y `resume` la devuelve allí, en vez de
dejarla siempre en «pendiente»; `requestQuote` la manda a la cola del proveedor, y
la recepción de una orden de compra la saca de ahí a **material recibido**.

```mermaid
stateDiagram-v2
  %% machine: request
  [*] --> pending
  pending --> approved : approve
  materialReceived --> approved : approve
  pending --> rejected : reject
  pending --> onHold : hold
  approved --> onHold : hold
  pendingSupplierQuote --> onHold : hold
  onHold --> heldFrom : resume
  approved --> issued : issue
  issued --> returned : returnMaterial
  pending --> cancelled : cancel
  onHold --> cancelled : cancel
  pendingSupplierQuote --> cancelled : cancel
  pending --> pendingSupplierQuote : requestQuote
  onHold --> pendingSupplierQuote : requestQuote
  pending --> materialReceived : receiveMaterial
  onHold --> materialReceived : receiveMaterial
  pendingSupplierQuote --> materialReceived : receiveMaterial
  rejected --> [*]
  returned --> [*]
  cancelled --> [*]
```

#### Estados — request

| Estado                 | Nombre                | Qué cuenta                                                      |
| ---------------------- | --------------------- | --------------------------------------------------------------- |
| `pending`              | Pendiente             | Recibida en la cola de repuestos, sin decisión todavía.         |
| `approved`             | Aprobada              | Material apartado: queda entregarlo, o devolverlo.              |
| `rejected`             | Rechazada             | Denegada; queda el motivo escrito.                              |
| `onHold`               | En espera             | Suspendida por una dependencia; guarda el estado del que salió. |
| `pendingSupplierQuote` | Presupuesto pendiente | En manos del proveedor, sin respuesta todavía.                  |
| `materialReceived`     | Material recibido     | Lo comprado ha entrado en el almacén: ya se puede aprobar.      |
| `issued`               | Entregada             | El repuesto está en manos del técnico.                          |
| `returned`             | Devuelta              | Lo entregado volvió al almacén.                                 |
| `cancelled`            | Cancelada             | Se deja sin efecto; no llegó a entregarse.                      |

#### Tabla de pasos — request

| desde                                        | paso                                | a                                            | quién                                                                                       |
| -------------------------------------------- | ----------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `pending` Pendiente                          | `approve` Aprobar                   | `approved` Aprobada                          | El responsable de repuestos                                                                 |
| `materialReceived` Material recibido         | `approve` Aprobar                   | `approved` Aprobada                          | El responsable, ya con el material en el almacén                                            |
| `pending` Pendiente                          | `reject` Rechazar                   | `rejected` Rechazada                         | El responsable de repuestos                                                                 |
| `pending` Pendiente                          | `hold` Poner en espera              | `onHold` En espera                           | El responsable de repuestos                                                                 |
| `approved` Aprobada                          | `hold` Poner en espera              | `onHold` En espera                           | El responsable de repuestos; el material sigue apartado                                     |
| `pendingSupplierQuote` Presupuesto pendiente | `hold` Poner en espera              | `onHold` En espera                           | El responsable de repuestos                                                                 |
| `onHold` En espera                           | `resume` Reanudar                   | `heldFrom` vuelve al estado del que salió    | El responsable de repuestos                                                                 |
| `approved` Aprobada                          | `issue` Entregar material           | `issued` Entregada                           | El responsable, al dar el material; puede entregarse por tandas, con una cantidad por línea |
| `issued` Entregada                           | `returnMaterial` Devolver material  | `returned` Devuelta                          | El responsable de repuestos                                                                 |
| `pending` Pendiente                          | `cancel` Cancelar petición          | `cancelled` Cancelada                        | El responsable de repuestos                                                                 |
| `onHold` En espera                           | `cancel` Cancelar petición          | `cancelled` Cancelada                        | El responsable de repuestos; una suspensión no compromete material                          |
| `pendingSupplierQuote` Presupuesto pendiente | `cancel` Cancelar petición          | `cancelled` Cancelada                        | El responsable de repuestos                                                                 |
| `pending` Pendiente                          | `requestQuote` Pedir presupuesto    | `pendingSupplierQuote` Presupuesto pendiente | El responsable de repuestos                                                                 |
| `onHold` En espera                           | `requestQuote` Pedir presupuesto    | `pendingSupplierQuote` Presupuesto pendiente | El responsable de repuestos                                                                 |
| `pending` Pendiente                          | `receiveMaterial` Material recibido | `materialReceived` Material recibido         | La recepción de la orden de compra, no un botón de la petición                              |
| `onHold` En espera                           | `receiveMaterial` Material recibido | `materialReceived` Material recibido         | La recepción de la orden de compra, no un botón de la petición                              |
| `pendingSupplierQuote` Presupuesto pendiente | `receiveMaterial` Material recibido | `materialReceived` Material recibido         | La recepción de la orden de compra, no un botón de la petición                              |

**Regla:** el paso solo se da si `REQUEST_STEPS` lo admite desde ese estado, y
nadie sale de `rejected`, `returned` ni `cancelled`. `resume` no inventa destino:
vuelve al estado que la espera guardó. La tabla de arriba es la misma que la de
`MAQUINAS.md`, contada sin la columna de permisos.

---

### C. Flujo de Órdenes de Compra (`src/lib/purchaseFlow.ts`)

Cuatro estados y dos pasos. El estado de la orden no lleva la cuenta de lo pedido
—eso sale de sus líneas, artículo a artículo—: por eso recepcionar es el único paso
que no tiene un destino fijo —completada si ha entrado todo, parcial si no—, y
anular devuelve sus peticiones de compra a la cola.

```mermaid
stateDiagram-v2
  %% machine: purchaseOrder
  [*] --> pending
  pending --> completed : receive
  pending --> partial : receive
  partial --> completed : receive
  partial --> partial : receive
  pending --> cancelled : cancel
  partial --> cancelled : cancel
  completed --> [*]
  cancelled --> [*]
```

#### Estados — purchaseOrder

| Estado      | Nombre     | Qué cuenta                                        |
| ----------- | ---------- | ------------------------------------------------- |
| `pending`   | Pendiente  | Enviada al proveedor; todavía no ha llegado nada. |
| `partial`   | Parcial    | Ha llegado parte del material.                    |
| `completed` | Completada | Ha llegado todo lo que se pidió.                  |
| `cancelled` | Anulada    | Sus peticiones de compra han vuelto a la cola.    |

#### Tabla de pasos — purchaseOrder

| desde               | paso                           | a                                                             | quién                       |
| ------------------- | ------------------------------ | ------------------------------------------------------------- | --------------------------- |
| `pending` Pendiente | `receive` Recepcionar material | `allReceived` completada o parcial, según lo que haya llegado | Quien recepciona el albarán |
| `partial` Parcial   | `receive` Recepcionar material | `allReceived` completada o parcial, según lo que haya llegado | Quien recepciona el albarán |
| `pending` Pendiente | `cancel` Anular la orden       | `cancelled` Anulada                                           | El responsable de compras   |
| `partial` Parcial   | `cancel` Anular la orden       | `cancelled` Anulada                                           | El responsable de compras   |

**Regla:** `canAdvancePurchaseOrder` decide si el paso cabe desde el estado, y
`purchaseOrderStatusAfterReceiving` decide entre completada y parcial mirando las
líneas, no el estado. De `completed` y de `cancelled` no sale ningún paso. La tabla
de arriba es la misma que la de `MAQUINAS.md`.

---

## 3. Contratos de API Principales (Convex Backend)

Los endpoints de backend están definidos en `src/convex/` y expuestos vía el objeto fuertemente tipado `api`:

### Incidencias (`src/convex/incidents.ts`)

- `api.incidents.list({ status?, equipmentId? })`: Devuelve las incidencias filtradas por estado o equipo.
- `api.incidents.getById({ id })`: Obtiene los detalles de la incidencia junto con sus partes de trabajo y repuestos asociados.
- `api.incidents.create({ title, description, equipmentId, priority })`: Registra una nueva incidencia en estado `reported`.
- `api.incidents.updateStatus({ id, newStatus, reason? })`: Valida vía `canTransitionIncident` y actualiza el estado.

### Equipos (`src/convex/equipment.ts`)

- `api.equipment.list({ search?, location?, status? })`: Consulta el catálogo de equipos con filtros de búsqueda y paginación.
- `api.equipment.create(data: EquipmentFormData)`: Inserta un nuevo equipo con manuales, fotos y componentes.
- `api.equipment.update({ id, ...data })`: Modifica los datos del equipo o actualiza su contador de horas/ciclos.
- `api.equipment.registerMaintenance({ id, maintenanceType, date, notes })`: Registra una rutina preventiva.

### Peticiones de Repuesto (`src/convex/requests.ts`)

- `api.requests.list({ status?, incidentId? })`: Consulta peticiones con detalles del solicitante y artículos.
- `api.requests.create({ incidentId, items, urgency })`: Crea una nueva petición en estado `draft` o `pending`.
- `api.requests.updateStatus({ id, newStatus })`: Transición validada con `canTransitionRequest`.

---

## 4. Correo Saliente (`src/lib/mail.ts`, `src/convex/mailSettings.ts`)

Todo el correo del taller —el aviso a quien notificó una incidencia, el aviso
interno del taller (alta, asignación y cierre) y el resumen semanal— sale por el
mismo camino:
`deliverMail` (`src/convex/_mail/deliver.ts`), que lee los ajustes guardados y
entrega la petición al servicio elegido. La pasarela de la plataforma va por su
SDK; los demás servicios, por una petición HTTP compuesta en `src/lib/mail.ts`.

Servicios del catálogo (`MAIL_PROVIDERS` en `src/lib/mail.ts`), con su variable
de entorno de reserva:

- **`vly`** — pasarela de la plataforma. Clave del deployment
  (`VLY_INTEGRATION_KEY`). Sin campos propios.
- **`resend`** — clave (`RESEND_API_KEY`). Sin campos propios.
- **`sendgrid`** — clave (`SENDGRID_API_KEY`). Sin campos propios.
- **`mailgun`** — clave (`MAILGUN_API_KEY`) y dominio verificado obligatorio.
- **`brevo`** — clave (`BREVO_API_KEY`). Sin campos propios.
- **`relay`** — dirección de un relevo HTTP propia; testigo opcional
  (`MAIL_RELAY_TOKEN`). No usa clave de servicio.
- **`gmail`** — la cuenta de Google del taller: cuenta (`smtpUser`), contraseña de
  aplicación (`GMAIL_APP_PASSWORD`) y dirección del relevo. Servidor puesto
  (`smtp.gmail.com:465`, TLS directo).
- **`ethereal`** — buzón de pruebas de Ethereal: cuenta, contraseña y dirección
  del relevo. Servidor puesto (`smtp.ethereal.email:587`, STARTTLS) y **sin**
  variable de entorno: sus credenciales solo pueden estar guardadas.

**Reglas:**

- La fila es única (`mailSettings`, `key = "default"`); sin fila valen los
  valores de partida (`DEFAULT_MAIL_SETTINGS`: pasarela encendida).
- La clave se guarda en la fila y **nunca** vuelve al navegador: la consulta
  devuelve `hasKey`, `keySource` (`guardada` | `entorno` | `ninguna`), `keyHint`
  (últimos cuatro) y `envVar`.
- Al cambiar de servicio, la clave del anterior se descarta: una clave de Resend
  no sirve para SendGrid.
- La validación de los ajustes vive en `validateMailSettings` (`src/lib/mail.ts`)
  y es la misma que usa la pantalla antes de habilitar «Guardar correo».
- La **copia oculta** (`bcc`) es una sola dirección fija del taller: todos los
  envíos se copian a ella y los destinatarios no la ven. Vacía, no se copia a
  nadie; con dos direcciones o una errata se rechaza al guardar, no cuando el
  servicio contesta. Viaja en el sobre de cada servicio con su nombre de campo
  (`bcc` en Resend, Brevo, Mailgun y el relevo; dentro de la personalización en
  SendGrid; en el SDK de la pasarela).
- Un correo que no sale no lanza: devuelve el motivo, que se apunta en la ficha
  (`emailError`), en el histórico del resumen (`weeklyReports.error`) y en el
  histórico de envíos.
- **Los que no tienen API propia salen por el relevo** (`usesMailRelay`: el
  relevo propio, Gmail y Ethereal), porque el backend no abre conexiones TCP. El
  sobre que compone `buildMailRequest` lleva entonces un bloque `smtp` —host,
  puerto, cifrado, cuenta y contraseña— y el puente entrega por ahí esa vez; el
  relevo no lo necesita configurado y no lo guarda. Sin `smtp` en el sobre vale
  el servidor del entorno del puente, que es el caso del relevo propio.
- Qué servidor y qué cuenta se eligen en `MAIL_PROVIDER_META` (`smtp`,
  `userLabel`, `secretLabel`), no en la pantalla: el catálogo es el mismo para la
  validación, la petición y la ayuda del formulario.
- **La comprobación previa** (`verifySmtp` en el relevo, `buildMailCheckRequest`
  en `src/lib/mail.ts`) conecta, saluda, cifra y se autentica con las mismas
  credenciales que la entrega, y corta con `QUIT`: no manda `MAIL FROM`, ni
  `RCPT TO`, ni `DATA`, así que no sale correo y no se toca ninguna cuota. Solo la
  entiende el relevo (los servicios con API se prueban mandando un correo), y no
  se apunta en `mailLog`, que es el registro de lo que salió. El relevo la hace
  sola al arrancar y deja el resultado en su registro; si falla **no** deja de
  escuchar: el servidor de correo puede tardar más en levantar que el puente.
- **La pantalla comprueba el camino sola.** Al abrir _Ajustes del taller_ —y otra
  vez al guardar, que es cuando cambia el camino— la tarjeta del servidor de
  correo llama a `check` con lo guardado. Solo lo hace con el correo encendido y
  un servicio que sale por el relevo: con API propia no hay nada que comprobar
  sin enviar, y se dice en vez de fingirlo. El estado se enseña en dos líneas: el
  **último envío real**, leído del histórico, y la respuesta del relevo ahora
  mismo; si el último envío no salió, el bloque se pinta en rojo con el motivo
  apuntado. El resultado de la comprobación no se guarda en ningún sitio: no ha
  salido ningún correo, y el botón «Comprobar ahora» solo la repite.
- **La cuenta SMTP solo se guarda en los servicios que la usan**
  (`MailSettings.smtpUser`); al cambiar de servicio se vacía, como el dominio de
  Mailgun. Y con el relevo en `http://` la contraseña viaja en claro, así que
  `mailCredentialsWarning` lo avisa en la pantalla (no lo impide: un puente dentro
  de la red del taller es una configuración legítima).
- El **aviso interno** de una incidencia (`notifyStaff`, origen `equipo`) sale a
  los correos en activo de los roles marcados en `mailSettings.incidentRoles`
  (`incidentRecipients`). Sin roles marcados no se manda nada. Cubre los tres
  momentos que el taller necesita saber: el **alta**, la **asignación** —por el
  coordinador o autoasignada— y el **cierre**, sea resuelto o sin resolución.
  Lleva la referencia interna, el equipo, dónde está, quién la lleva y el enlace
  al panel; la descripción recortada solo en el alta, que es cuando hace falta
  leerla. **No** lleva el código de seguimiento, que es del invitado.
- Qué estados se reparten lo decide `staffMailNotice` (`src/lib/incidentMail.ts`):
  `reported` → alta, `assigned` → asignación, `resolved`/`unresolved` → cierre;
  los pasos intermedios (en taller, pendiente de material) no mandan correo. El
  último aviso dado queda en `incidents.staffNotifiedStatus`, así que reasignar o
  volver a cerrar lo mismo no repite el correo: se reparte una vez por momento, y
  el propio envío comprueba la marca antes de componer, por si dos toques de la
  ficha lo programaron a la vez.
- El **resumen semanal** mantiene sus destinatarios en `reportSettings.roleKeys`
  (los elige el diálogo «Resumen semanal» y la tarjeta de avisos por rol, que
  escriben el mismo ajuste).
- El **histórico de envíos** vive en `mailLog`: cuándo, desde dónde
  (`incidencia` | `equipo` | `resumen` | `prueba`), servicio, destinatarios, copia oculta,
  asunto y resultado, con el motivo cuando falla. Guarda el sobre y **nunca el
  cuerpo**; se poda solo, quedándose con los últimos `MAIL_LOG_LIMIT` (200), y no
  entra en el vaciado del taller: es trazabilidad de lo que ya salió a la red.
- El histórico se escribe desde `deliverMailLogged`, el único camino que manda
  correo: los cuatro orígenes entran por ahí, así que un intento fallido también
  queda apuntado.
- El backend no abre conexiones TCP: un SMTP propio se usa a través de un relevo
  HTTP. El repositorio incluye uno en `scripts/mail-relay.mjs` (con su guía en
  `RELEVO.md`): recibe el sobre de `buildMailRequest(provider: "relay")` y lo
  entrega por SMTP, con testigo opcional `Bearer`. Los códigos de acceso siguen
  saliendo por la pasarela de la plataforma.

**Contratos:**

- `api.mailSettings.settings({})`: ajustes vigentes enmascarados (solo administrador).
- `api.mailSettings.save({ provider, enabled, fromName, fromEmail, replyTo, bcc, domain, relayUrl, smtpUser?, apiKey?, clearApiKey?, relayToken?, clearRelayToken? })`: guarda y devuelve la vista enmascarada.
- `api.mailSettings.roleOptions({})`: roles a los que se puede apuntar el aviso interno, con su etiqueta de hoy (solo administrador).
- `api.mailSettings.setIncidentRoles({ roleKeys })`: elige qué roles reciben el aviso interno; normaliza contra la tabla de roles (solo administrador).
- `api.mailSettings.sendTest({ to })`: manda un correo de prueba por el servicio configurado y apunta el resultado (`lastTestAt`, `lastTestOk`, `lastTestError`).
- `api.mailSettings.check({})`: comprobación previa (solo administrador). Le pide al relevo que se conecte y se autentique con lo guardado y devuelve `{ ok, provider, detail?, error? }`; con un servicio que no sale por el relevo contesta que su comprobación es el correo de prueba. La llama sola la tarjeta al abrirse y al guardar; el botón solo la repite.
- Relevo — `POST /comprobar` (o `<camino>/comprobar`, p. ej. `/enviar/comprobar`): la misma puerta de siempre con el testigo, cuerpo opcional `{ smtp }`. Devuelve `{ ok, check: { host, port, tls, auth, greeting } }` (200), 400 con un `smtp` a medias, 502 si el servidor no acepta la conexión o las credenciales, 501 si el relevo no tiene `verify` montado y 405 con otro método que POST.
- `internal.mailSettings.incidentRecipients({})`: correos de los roles marcados para el aviso interno (activos, sin invitados, sin repetidos).
- `internal.incidentMail.notifyStaff({ incidentId, notice })`: compone y manda el aviso interno del momento (`reported` | `assigned` | `resolved` | `unresolved`), se salta el que ya está apuntado en la ficha y lo anota en el histórico con origen `equipo`.
- `api.mailLog.history({ limit? })`: últimos envíos, del más reciente al más viejo (solo administrador).
- `internal.mailSettings.delivery({})`: configuración con secretos resueltos —incluidos `smtpUser` y la contraseña del servicio— para `deliverMail`.
- `internal.mailLog.record({ what, origin, provider, to, bcc, subject, ok, error?, relatedId? })`: apunta un envío y poda el histórico.
