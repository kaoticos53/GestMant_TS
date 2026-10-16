# Manual de Uso de Pulso Taller (`GestMant_TS`)

**Sistema Integral de Gestión de Mantenimiento para Entornos Broadcast y Audiovisuales**

---

## 1. Introducción y Principios del Sistema

**Pulso Taller** es una plataforma diseñada específicamente para la gestión operativa, trazabilidad técnica y control de existencias en talleres de mantenimiento audiovisual y broadcast (estudios de televisión, controles centrales, unidades móviles y salas de postproducción).

### 1.1 Vocabulario Ubicuo del Taller

Para garantizar la máxima claridad y consistencia en la comunicación técnica y operativa, todo el personal y la plataforma utilizan rigurosamente el vocabulario estándar de la industria:

| Término Oficial          | Términos Prohibidos / No Utilizados       | Definición en Pulso Taller                                                                                                   |
| ------------------------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Incidencia**           | _Ticket_, _avería_, _fallo_, _problema_   | Suceso técnico que afecta a la operatividad de un equipo o infraestructura técnica.                                          |
| **Equipo**               | _Máquina_, _aparato_, _dispositivo_       | Unidad física inventariada del catálogo técnico (cámara, mezclador, servidor, matriz, monitor, etc.).                        |
| **Petición de repuesto** | _Solicitud de material_, _pedido interno_ | Requerimiento formal emitido por un técnico para obtener componentes de almacén vinculados a una incidencia.                 |
| **Parte de trabajo**     | _Informe_, _orden de servicio_            | Documento oficial certificable con validez técnica y legal que recoge las intervenciones, mediciones y repuestos utilizados. |
| **Técnico**              | _Operario_, _mecánico_, _trabajador_      | Profesional cualificado responsable del diagnóstico, reparación y puesta a punto de los equipos.                             |

---

## 2. Mapa de Roles y Permisos en el Taller

Pulso Taller cuenta con un modelo de control de acceso basado en roles (RBAC) con **18 capacidades configurables**. El sistema incluye 4 perfiles predefinidos más la capacidad de crear **roles personalizados**:

```
+--------------------------------------------------------------------------------------------------+
|                                    ESTRUCTURA DE PERFILES                                        |
+------------------------------+----------------------------------+--------------------------------+
| PÚBLICO / OPERADOR           | TÉCNICO                          | RESPONSABLE DE REPUESTOS       |
| • Reporte sin cuenta         | • Cuaderno técnico e imágenes    | • Asignación de incidencias    |
| • Seguimiento por código     | • Peticiones de repuesto         | • Aprobación de material       |
| • Alta de equipo en caliente | • Consulta y notas en manuales   | • Órdenes de compra y albaranes|
|                              | • Mensajería interna             | • Gestión de catálogo y stock  |
+------------------------------+----------------------------------+--------------------------------+
                                                                  | ADMINISTRADOR                  |
                                                                  | • Control total del sistema    |
                                                                  | • Gestión de usuarios y roles  |
                                                                  | • Matriz de permisos           |
                                                                  | • Auditoría y ajustes globales |
                                                                  +--------------------------------+
```

---

## 3. Manual por Rol

---

### Rol 1: Operador de Plató / Usuario Público (Sin Autenticación)

Este perfil está destinado a operadores de cámara, realizadores, mezcladores de vídeo, ingenieros de sonido o personal de producción que detectan un comportamiento anómalo durante la emisión o preparación de un programa.

#### 3.1 Reporte Rápido de una Incidencia

No requiere usuario ni contraseña para no entorpecer la agilidad en situaciones de directo:

1. Accede a la dirección web principal de Pulso Taller y pulsa en **«Reportar incidencia»** (o navega a `/reportar`).
2. Rellena los datos básicos:
   - **Título breve:** Descripción concisa del síntoma (ej. _«Monitor de previo en Control 2 pierde sincronismo por SDI»_).
   - **Ubicación técnica:** Plató, control, rack o sala afectada (ej. _Plató 1 · Control de Realización_).
   - **Prioridad inicial:**
     - `Urgente`: Compromete la emisión en directo o la grabación inmediata.
     - `Alta`: Afecta a un elemento principal sin respaldo activo.
     - `Normal`: Degeneración de calidad o incidencia sin bloqueo de producción.
   - **Descripción detallada:** Pasos para reproducir, cables verificados y comportamiento observado.
   - **Equipo afectado:** Puedes seleccionarlo del catálogo desplegable.
     > **Alta de equipo en caliente:** Si el equipo no figura aún en el inventario oficial, pulsa **«Dar de alta equipo»** desde el propio formulario. Podrás indicar su marca, modelo y número de serie para que quede pre-registrado sin interrumpir tu aviso.
   - **Adjuntos:** Puedes adjuntar fotografías del display de error, oscilogramas o capturas de pantalla.
3. Pulsa **«Enviar incidencia»**. El sistema te entregará un **código único de seguimiento** (ej. `INC-2026-0842`).

#### 3.2 Consulta y Seguimiento de Incidencias

1. En la página de inicio, introduce el código de seguimiento o el número de serie del equipo en el buscador de la sección **«Seguimiento de incidencias»**.
2. Podrás verificar en tiempo real:
   - Estado actual (`Notificada`, `En verificación`, `Asignada a técnico`, `En taller`, `Resuelta`).
   - Técnico asignado y fecha prevista de resolución.
   - Observaciones públicas del equipo de mantenimiento.

---

### Rol 2: Técnico de Mantenimiento (`technician`)

El técnico es el profesional que diagnostica, desmonta, repara y calibra los equipos del taller audiovisual.

#### 4.1 Navegación en el Panel de Control

Al iniciar sesión con tus credenciales profesionales:

- **Menú lateral:** Acceso directo a `Incidencias`, `Peticiones de repuesto`, `Manuales`, `Mensajes` y tu `Perfil`.
- **Campana de notificaciones:** Avisos cuando se te asigna una nueva incidencia, cuando el responsable aprueba tu petición de material o cuando se recepciona un repuesto que estabas esperando.

#### 4.2 Gestión de Incidencias Asignadas

1. En la pestaña **«Incidencias»**, visualiza la cola de trabajo. Puedes filtrar por:
   - Incidencias asignadas a ti.
   - Nivel de criticidad (`Urgente`, `Alta`, `Normal`).
   - Estado del flujo.
2. Abre la ficha de la incidencia pulsando sobre ella:
   - **Iniciar trabajo:** Cambia el estado a `En progreso` cuando comiences la intervención física.
   - **Cuaderno técnico de notas:** Escribe las notas de diagnóstico en el editor de texto enriquecido. Puedes documentar:
     - Mediciones de tensión o rizado de fuentes conmutadas.
     - Puntos calientes identificados por cámara termográfica.
     - Pruebas de compatibilidad firmware o señales de referencia (Black Burst / PTP).
   - **Documentación fotográfica:** Sube fotos del proceso de desmontaje y placas de circuitos para el histórico.

#### 4.3 Petición de Repuestos para una Intervención

Cuando necesites sustituir un condensador, ventilador, circuito integrado, fuente o módulo:

1. Desde la ficha de la incidencia, o desde el menú **«Peticiones»**, pulsa **«Nueva petición de repuesto»**.
2. Selecciona el **Repuesto** necesario del catálogo:
   - El sistema te mostrará automáticamente el stock disponible en almacén y su estantería/cajón.
3. Especifica la cantidad necesaria y la **justificación diagnóstica** (ej. _«Sustitución de condensadores electrolíticos hinchados en etapa secundaria de alimentación»_).
4. Vincula el **Equipo** objeto de la reparación y la **Incidencia**.
5. Envía la petición. Quedará en estado `Pendiente de aprobación` para el responsable de repuestos.
6. En cuanto el responsable la apruebe, recibirás una notificación para recoger el material en almacén.

#### 4.4 Visor de Manuales Técnicos y Notas Propias

1. En el menú **«Manuales»**, busca por fabricante o modelo (ej. _Sony HDC-4300_, _Grass Valley Karrera_, _Blackmagic ATEM Constellation_).
2. Abre y visualiza el manual de servicio o esquemático en PDF sin salir de la plataforma.
3. **Notas del taller en manuales:** Si descubres un tip técnico (ej. _«El potenciómetro VR201 ajusta el nivel de subportadora en la placa TX»_), puedes añadir una nota pública al manual que servirá de guía para todo el turno.

#### 4.5 Mensajería Interna

- Accede al centro de mensajes para consultar dudas directas con el coordinador de turno o con el responsable de compras sin recurrir a canales externos desarticulados.

---

### Rol 3: Responsable de Repuestos y Coordinador (`manager`)

El responsable coordina el flujo diario del taller, asegura la disponibilidad del material audiovisual, aprueba peticiones, negocia con proveedores y emite los partes de trabajo oficiales.

#### 5.1 Coordinación y Asignación de Incidencias

1. Revisa diariamente la bandeja de **«Incidencias notificadas»**.
2. **Evaluación de alcance:**
   - Si la incidencia puede resolverse in-situ, asígnala al técnico de plató en turno (`Asignada in-situ`).
   - Si requiere instrumental de precisión (estación de microsoldadura, osciloscopio, analizador de forma de onda SDI), deriva el equipo al taller central (`Derivada a taller`).
3. Reasigna técnicos si se presentan ausencias o cambios de turno.

#### 5.2 Aprobación y Entrega de Peticiones de Repuesto

1. Entra en el módulo **«Peticiones»**:
   - Revisa las peticiones en estado `Pendiente`.
2. **Criterios de decisión:**
   - **Aprobar:** Si hay stock en almacén, pulsa **«Aprobar petición»**. El sistema descontará automáticamente las existencias del catálogo en tiempo real.
   - **Rechazar:** Si el diagnóstico es dudoso o existe un componente equivalente, introduce el motivo de rechazo en el campo obligatorio para que el técnico lo consulte.
   - **Pasar a compras:** Si no hay stock físico disponible, el sistema te ofrecerá la opción de marcar la línea para **Orden de compra**, trasladando la necesidad a la cola de aprovisionamiento con proveedor.
3. **Entrega física:** Cuando el técnico acuda al almacén por las piezas, pulsa **«Marcar como entregado»** (`issued`). La petición quedará sellada y archivada.

#### 5.3 Gestión de Compras y Recepción de Albaranes

1. En el menú **«Compras»**, visualiza las peticiones de compra agrupadas automáticamente por proveedor (ej. _Farnell_, _RS Components_, _Mouser_, _Monitores Broadcast S.L._).
2. **Crear Orden de Compra:** Agrupa las piezas en una orden de compra oficial con su número de referencia presupuestaria.
3. Cambia el estado a `Pedida` cuando envíes la orden formal al proveedor.
4. **Recepción de Albarán:**
   - Al llegar el paquete del repartidor, abre la orden de compra en Pulso Taller.
   - Pulsa **«Recepcionar albarán»**.
   - Introduce el número de albarán del proveedor, la fecha de recepción y marca los artículos recibidos (admite recepciones parciales).
   - Los repuestos pasan automáticamente a incrementar el stock del catálogo y las peticiones asociadas cambian a `Recibido`.

#### 5.4 Mantenimiento del Catálogo de Repuestos y Ubicaciones

1. En la pestaña **«Repuestos»**, administra las referencias:
   - **Número de parte (P/N):** Código del fabricante (ej. _MAX9123ESE+_, _2SA1943_, _LT1963A_).
   - **Ubicación exacta:** Define pasillo, estantería y cajonera (ej. _Almacén Central · Módulo B · Cajón 14-C_).
   - **Stock mínimo y stock óptimo:** Cuando las existencias caigan por debajo del mínimo, el sistema generará una advertencia visual.
   - **Compatibilidad con equipos:** Vincula el repuesto con los equipos del inventario que lo admiten para facilitar la búsqueda a los técnicos.

#### 5.5 Inventario de Equipos y Mantenimiento Preventivo

1. En la pestaña **«Equipos»**, gestiona el parque tecnológico:
   - Registro de cámaras, ópticas, matrices de conmutación, servidores de vídeo y distribuidores.
   - Control de números de serie, versiones de firmware y ubicaciones físicas.
   - **Mantenimiento preventivo:** Programa limpiezas de prismas, calibración de balances de blanco, sustitución periódica de ventiladores y test de fuentes de alimentación.

#### 5.6 Cierre de Incidencias y Emisión de Partes de Trabajo Oficiales

1. Una vez concluida la reparación y probada la operatividad del equipo:
   - Pulsa **«Resolver incidencia»**.
   - Introduce el resumen de la resolución técnica y la causa raíz identificada.
2. Pulsa en **«Generar parte de trabajo en PDF»**:
   - Pulso Taller compilará un documento oficial normalizado con:
     - Datos del taller y membrete oficial.
     - Fechas y horas de notificación, asignación y resolución (cálculo automático de MTTR).
     - Datos del equipo intervenido (marca, modelo, número de serie, ubicación).
     - Histórico de intervenciones y notas del cuaderno técnico.
     - Relación de repuestos utilizados con sus números de serie y albaranes asociados.
     - Firma digital o espacio de validación del técnico responsable.
   - Descarga el archivo para su archivo corporativo o entrega al cliente.

---

### Rol 4: Administrador del Sistema (`admin`)

El Administrador tiene la responsabilidad máxima de la plataforma: gobierno de la identidad, auditoría de seguridad y configuración corporativa.

#### 6.1 Gestión de Usuarios y Roles (`UsersView.tsx`)

1. En el menú **«Usuarios»**:
   - Da de alta nuevos miembros indicando su nombre, correo profesional y rol inicial.
   - Activa o desactiva cuentas (por ejemplo, al concluir contratos de técnicos temporales para coberturas electorales o eventos deportivos).
   - Fuerza restablecimiento de contraseñas si es requerido.

#### 6.2 Matriz de Roles y Capacidades (`PermissionsView.tsx`)

1. En la sección **«Roles y permisos»**:
   - Visualiza la matriz completa de las 18 capacidades del sistema.
   - **Crear un rol personalizado:** Si el taller cuenta con perfiles específicos (ej. _«Auditor de Calidad»_, _«Coordinador de Plató»_ o _«Becario de Taller»_), pulsa **«Nuevo rol»**.
   - Define su etiqueta y activa o desactiva casillas en la matriz (ej. permitir ver manuales e inventario pero bloquear aprobación de compras).
   - **Capacidades bloqueadas:** Las capacidades críticas (`manageUsers`, `configurePermissions`, `viewAudit`) están reservadas al Administrador por diseño de seguridad y no pueden transferirse por error.

#### 6.3 Ajustes Generales del Taller (`WorkshopSettingsView.tsx`)

1. **Datos del Taller y Membrete:**
   - Nombre comercial, razón social, CIF/NIF, dirección física y teléfono del servicio técnico.
   - Logotipo oficial que se incrustará en todos los partes de trabajo PDF generados.
2. **Configuración de "Trabajo sin Traza":**
   - Establece los umbrales de alerta cuando una incidencia se resuelva sin haber anotado ninguna observación técnica ni haber vinculado repuestos.
   - Define qué roles reciben este aviso preventivo para corregir la falta de documentación antes del archivo definitivo.
3. **Informes Semanales Automatizados:**
   - Configura el día de la semana y la hora en que el motor de Pulso Taller compila el informe semanal de rendimiento del taller (volumen de incidencias resueltas, gasto en repuestos, horas de intervención y equipos recurrentes).
   - Elige qué roles recibirán este consolidado.

#### 6.4 Auditoría de Seguridad y Trazabilidad Documental

1. Accede al módulo de **Auditoría Documental**:
   - Consulta el registro inmutable de qué usuario adjuntó, modificó o descargó documentos del expediente técnico de cualquier incidencia.
   - Filtrado por rango temporal, técnico o tipo de archivo.

---

## 4. Matriz Completa de Capacidades por Rol del Sistema

| Módulo             | Capacidad Técnica      | Descripción Operativa                      | `guest` | `technician` | `manager` |     `admin`      |
| ------------------ | ---------------------- | ------------------------------------------ | :-----: | :----------: | :-------: | :--------------: |
| **Incidencias**    | `viewIncidents`        | Ver la cola y listado de incidencias       |   ❌    |      ✅      |    ✅     |        ✅        |
| **Incidencias**    | `manageIncidents`      | Asignar a técnicos, derivar y cerrar       |   ❌    |      ❌      |    ✅     |        ✅        |
| **Peticiones**     | `viewRequests`         | Ver listado y estados de peticiones        |   ❌    |      ✅      |    ✅     |        ✅        |
| **Peticiones**     | `createRequests`       | Crear peticiones de material para taller   |   ❌    |      ✅      |    ✅     |        ✅        |
| **Peticiones**     | `lookupCatalog`        | Consultar stock al rellenar peticiones     |   ❌    |      ✅      |    ✅     |        ✅        |
| **Peticiones**     | `decideRequests`       | Aprobar, rechazar y entregar repuestos     |   ❌    |      ❌      |    ✅     |        ✅        |
| **Compras**        | `viewPurchasing`       | Ver módulos de órdenes y recepciones       |   ❌    |      ❌      |    ✅     |        ✅        |
| **Compras**        | `managePurchasing`     | Crear órdenes de compra y recepcionar      |   ❌    |      ❌      |    ✅     |        ✅        |
| **Repuestos**      | `viewInventory`        | Ver catálogo completo y almacén            |   ❌    |      ❌      |    ✅     |        ✅        |
| **Repuestos**      | `manageInventory`      | Crear, editar y ajustar stock              |   ❌    |      ❌      |    ✅     |        ✅        |
| **Equipos**        | `viewEquipment`        | Ver inventario de equipos audiovisuales    |   ❌    |      ❌      |    ✅     |        ✅        |
| **Equipos**        | `manageEquipment`      | Altas, bajas, seriales e intervenciones    |   ❌    |      ❌      |    ✅     |        ✅        |
| **Equipos**        | `lookupEquipment`      | Elegir equipo al reportar o verificar      |   ❌    |      ❌      |    ❌*    |        ✅        |
| **Manuales**       | `viewManuals`          | Ver y descargar manuales técnicos          |   ❌    |      ✅      |    ✅     |        ✅        |
| **Manuales**       | `manageManuals`        | Subir y clasificar nuevos manuales PDF     |   ❌    |      ❌      |    ✅     |        ✅        |
| **Comunicación**   | `sendMessages`         | Enviar mensajes internos en el taller      |   ❌    |      ✅      |    ✅     |        ✅        |
| **Administración** | `manageUsers`          | Alta, baja y cambio de rol de usuarios     |   ❌    |      ❌      |    ❌     | ✅ _(Bloqueado)_ |
| **Administración** | `configurePermissions` | Editar la matriz de roles y permisos       |   ❌    |      ❌      |    ❌     | ✅ _(Bloqueado)_ |
| **Administración** | `viewAudit`            | Consultar auditoría y traza de expedientes |   ❌    |      ❌      |    ❌     | ✅ _(Bloqueado)_ |

_\*Nota: En roles con `viewEquipment` activo, `lookupEquipment` se asume concedido automáticamente._

---

## 5. Flujos Operativos Paso a Paso

### 5.1 Ciclo Completo de una Incidencia (De Plató a Resolución)

```
[1. Operador] Notifica incidencia en /reportar
      │
      ▼
[2. Responsable] Revisa cola, evalúa prioridad y asigna técnico (in-situ o taller)
      │
      ▼
[3. Técnico] Recibe aviso, cambia estado a "En progreso", diagnostica y documenta en cuaderno
      │
      ├─► ¿Necesita piezas? ──► Crea "Petición de repuesto" ──► Responsable aprueba ──► Técnico retira pieza
      │
      ▼
[4. Técnico] Sustituye componentes, calibra el equipo y valida funcionamiento
      │
      ▼
[5. Responsable] Valida la reparación, cierra como "Resuelta" y emite el Parte de Trabajo en PDF
```

### 5.2 Ciclo de Aprovisionamiento de Repuestos

```
[Petición sin Stock / Stock Mínimo Alcanzado]
      │
      ▼
[Responsable] Agrupa necesidades en una "Orden de Compra" por Proveedor
      │
      ▼
[Proveedor] Envía material con su albarán de entrega
      │
      ▼
[Responsable] Ejecuta "Recepcionar Albarán" en Pulso Taller
      │
      ├─► El stock del catálogo se actualiza automáticamente
      └─► Los técnicos con peticiones pendientes reciben notificación inmediata
```

---

## 6. Buenas Prácticas y Consejos para el Taller

1. **Documentar siempre antes de cerrar:** Nunca cierres una incidencia sin haber registrado una nota técnica en el cuaderno describiendo qué provocó la avería y qué solución se aplicó.
2. **Utilizar fotografías de apoyo:** Una fotografía de una pista quemada o un conector desoldado ahorra horas de diagnóstico en averías futuras del mismo modelo de equipo.
3. **Respetar las ubicaciones físicas:** Al colocar material nuevo, cerciórate de que coincide exactamente con la estantería y cajón indicados en el catálogo de repuestos.
4. **Verificación de firmas en Partes de Trabajo:** Descarga y custodia los archivos PDF generados al cierre de turnos para auditorías de calidad ISO o prevención de riesgos.

---

_Manual oficial mantenido por el equipo de ingeniería de Pulso Taller. Última revisión técnica: Octubre 2026._
