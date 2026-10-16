# Manual General Integral de Operación, Mantenimiento y Administración
# Pulso Taller (`GestMant_TS`)
### Tratado Técnico Exhaustivo de Gestión del Mantenimiento Industrial y Audiovisual
**Documento Técnico Maestro · Edición Oficial Exhaustiva · Versión 1.1.0**

---

<!-- ==================== PÁGINA 1: PORTADA Y CONTROL DOCUMENTAL ==================== -->
<div style="page-break-after: always;"></div>

## Control del Documento y Metadatos de Publicación

| Atributo | Especificación Oficial |
|---|---|
| **Denominación del Documento** | Manual General Integral de Operación, Mantenimiento y Administración |
| **Código Documental** | `DOC-MAN-PULSO-2026-V1.1` |
| **Sistema / Plataforma** | Pulso Taller (`GestMant_TS`) |
| **Versión del Software** | v1.1.0 (Producción Estable) |
| **Fecha de Aprobación** | Octubre de 2026 |
| **Entorno Tecnológico** | React 19, TypeScript 5.7, Convex 1.46 (`@convex-dev/auth`), Tailwind CSS v4, Vite 7 |
| **Destinatarios** | Jefaturas de Emisión Técnica, Ingenieros de Mantenimiento, Técnicos de Taller, Responsables de Repuestos, Operadores de Control Central (MCR) y Administradores de Sistemas |
| **Entornos Operativos Cubiertos** | Centros de Producción de Televisión, Estudios de Plató (PCR), Controles Centrales (MCR), Unidades Móviles (DSNG / OB-Vans), Talleres Electrónicos Centrales y Salas de Racks de Telecomunicaciones |
| **Normativa y Gobernanza** | Vocabulario Ubicuo Industrial (`GLOSARIO.md`), Gobernanza de Código (`AGENTS.md`) |
| **Estado de Confidencialidad** | Documentación Técnica de Explotación Operativa (Uso Interno) |

### Historial de Revisiones del Manual

| Versión | Fecha | Autor / Cargo | Resumen de Modificaciones |
|---|---|---|---|
| **v0.1.0** | 11/10/2026 | Equipo de Arquitectura | Borrador inicial de especificaciones del taller y modelo de datos Convex. |
| **v0.5.0** | 12/10/2026 | Ingeniería de Software | Incorporación de la máquina de estados de peticiones y catálogo de repuestos. |
| **v0.9.0** | 14/10/2026 | Calidad y Seguridad | Integración de RBAC de 18 capacidades, auditoría inmutable y cuaderno enriquecido. |
| **v1.0.0** | 15/10/2026 | Jefatura de Mantenimiento | Primera edición oficial de producción. Aprobación de SOPs broadcast y partes en PDF. |
| **v1.1.0** | 16/10/2026 | Dirección Técnica | Edición integral ampliada: panel lateral redimensionable persistente, bitácora de cambios contextual, protocolos de continuidad en Synology NAS y 7 SOPs industriales. |

---

<!-- ==================== PÁGINA 2: ÍNDICE GENERAL DETALLADO ==================== -->
<div style="page-break-after: always;"></div>

## Índice General de Capítulos

1. **[Capítulo 1: Marco Filosófico, Operativo y Vocabulario Ubicuo](#capítulo-1-marco-filosófico-operativo-y-vocabulario-ubicuo)**
   - 1.1 Misión en Entornos de Televisión, Plató y Emisión Continua 24/7
   - 1.2 Vocabulario Ubicuo del Taller y Glosario de Términos Prohibidos
   - 1.3 Principios Inviolables de Trazabilidad Técnica
2. **[Capítulo 2: Arquitectura del Sistema, Pila Tecnológica y Separación de Capas](#capítulo-2-arquitectura-del-sistema-pila-tecnológica-y-separación-de-capas)**
   - 2.1 Diagrama de Arquitectura C4 y Flujo de Datos
   - 2.2 Aislamiento Estricto de Dominio (`src/lib/`) y Protección contra Acoplamientos
   - 2.3 Reactividad en Tiempo Real con Convex Engine y WebSockets
3. **[Capítulo 3: Identidad, Seguridad y Control de Acceso Basado en Roles (RBAC)](#capítulo-3-identidad-seguridad-y-control-de-acceso-basado-en-roles-rbac)**
   - 3.1 Modelo de Autenticación Segura y Gestión de Sesiones
   - 3.2 Los 4 Roles Predefinidos del Sistema
   - 3.3 Matriz Exhaustiva de las 18 Capacidades Granulares del Taller
   - 3.4 Motor de Roles Personalizados y Principio de Menor Privilegio
   - 3.5 Trazabilidad Inmutable con `securityAuditLog`
4. **[Capítulo 4: Gestión Integral del Ciclo de Vida de Incidencias](#capítulo-4-gestión-integral-del-ciclo-de-vida-de-incidencias)**
   - 4.1 Máquina de Estados Finita de Incidencias y Reglas de Transición
   - 4.2 Portal Público de Notificación Inmediata (`/reportar`) sin Credenciales
   - 4.3 Procedimiento de Alta de Equipos en Caliente durante el Reporte
   - 4.4 Triaje Técnico, Criterios de Criticidad y Enrutamiento Operativo
   - 4.5 El Cuaderno Técnico de Intervención: Editor Enriquecido, Adjuntos y Control de Versiones
   - 4.6 Resolución, Clasificación de Causas Raíz y Generación del Parte de Trabajo en PDF
5. **[Capítulo 5: Inventario Serializado de Equipos y Mantenimiento Preventivo](#capítulo-5-inventario-serializado-de-equipos-y-mantenimiento-preventivo)**
   - 5.1 Ficha Maestra del Equipo y Normalización de Identificadores
   - 5.2 Catálogo de Modelos de Equipos y Fabricantes Homologados
   - 5.3 Hoja de Vida y Trazabilidad Histórica de Averías
   - 5.4 Planes Periódicos de Mantenimiento Preventivo y Cálculo de Vencimientos
   - 5.5 Generación de la Ficha Técnica Integral del Equipo en PDF
6. **[Capítulo 6: Almacén de Repuestos, Normalización de P/N y Control de Existencias](#capítulo-6-almacén-de-repuestos-normalización-de-pn-y-control-de-existencias)**
   - 6.1 Catálogo de Repuestos y Reglas de Codificación P/N
   - 6.2 Topología Física del Almacén: Estanterías, Módulos y Cajoneras
   - 6.3 Algoritmos de Control de Stock: Stock Mínimo, Óptimo y Puntos de Pedido
   - 6.4 Matriz de Compatibilidad Repuesto-Equipo
   - 6.5 Ajustes de Inventario y Auditorías Físicas Periódicas
7. **[Capítulo 7: Circuito Completo de Peticiones de Repuesto y Compras](#capítulo-7-circuito-completo-de-peticiones-de-repuesto-y-compras)**
   - 7.1 Máquina de Estados de Peticiones de Repuesto
   - 7.2 Emisión y Justificación de Peticiones por el Técnico
   - 7.3 Flujo de Aprobación, Deducción Inmediata y Rechazo Motivado
   - 7.4 Consolidación de Órdenes de Compra por Proveedor
   - 7.5 Recepción de Albaranes, Cotejo de Calidad y Reingreso a Almacén
   - 7.6 Entrega Física de Material y Cierre Contable de la Petición
8. **[Capítulo 8: Centro de Documentación Técnica, Manuales y Esquemáticos](#capítulo-8-centro-de-documentación-técnica-manuales-y-esquemáticos)**
   - 8.1 Repositorio Centralizado de Manuales de Servicio y Esquemáticos
   - 8.2 Vinculación Cruzada entre Manuales y Modelos de Equipos
   - 8.3 Base de Conocimiento y Notas Técnicas de Taller
9. **[Capítulo 9: Comunicaciones Internas, Mensajería y Búsqueda Global](#capítulo-9-comunicaciones-internas-mensajería-y-búsqueda-global)**
   - 9.1 Mensajería Directa y Grupal del Taller
   - 9.2 Motor de Notificaciones Operativas en Tiempo Real
   - 9.3 Búsqueda Global Omnicanal Asistida
10. **[Capítulo 10: Administración Avanzada, Auditoría y Calidad del Taller](#capítulo-10-administración-avanzada-auditoría-y-calidad-del-taller)**
    - 10.1 Membrete Corporativo, Razón Social y Personalización Gráfica
    - 10.2 Monitor de "Trabajo sin Traza" y Prevención de Desviaciones
    - 10.3 Motor de Informes Semanales Automatizados
    - 10.4 Mantenimiento del Almacenamiento, Detección de Huérfanos y Papelera
11. **[Capítulo 11: Infraestructura, Continuidad Operativa y Despliegue en Synology NAS](#capítulo-11-infraestructura-continuidad-operativa-y-despliegue-en-synology-nas)**
    - 11.1 Arquitectura del Servidor Local y Despliegue en Docker Container
    - 11.2 Estrategia de Copias de Seguridad 3-2-1 y Snapshots
    - 11.3 Plan de Recuperación ante Desastres (Disaster Recovery RTO/RPO)
12. **[Capítulo 12: Manual Detallado de Pantallas, Formularios y Campos del Sistema](#capítulo-12-manual-detallado-de-pantallas-formularios-y-campos-del-sistema)**
13. **[Capítulo 13: Matriz de Resolución de Problemas Técnicos (Troubleshooting)](#capítulo-13-matriz-de-resolución-de-problemas-técnicos-troubleshooting)**
14. **[Capítulo 14: Procedimientos Operativos Estandarizados (SOPs) Broadcast](#capítulo-14-procedimientos-operativos-estandarizados-sops-broadcast)**
15. **[Capítulo 15: Glosario Técnico de Acrónimos Broadcast, Electrónica y Redes](#capítulo-15-glosario-técnico-de-acrónimos-broadcast-electrónica-y-redes)**

---

<!-- ==================== PÁGINA 3: CAPÍTULO 1 ==================== -->
<div style="page-break-after: always;"></div>

## Capítulo 1: Marco Filosófico, Operativo y Vocabulario Ubicuo

### 1.1 Misión en Entornos de Televisión, Plató y Emisión Continua 24/7
En la industria de la radiodifusión televisiva, las plataformas de distribución OTT en vivo y las productoras de contenidos de alta gama, el tiempo de emisión no admite interrupciones. Cada segundo de pantalla en negro o señal degradada conlleva penalizaciones contractuales inmediatas, pérdida de anunciantes y un impacto severo sobre la reputación pública del medio.

Tradicionalmente, los departamentos técnicos de mantenimiento han operado mediante métodos fragmentados: notas en papel manuscritas en la mesa del control central, llamadas telefónicas urgentes durante la emisión de informativos, grupos de mensajería informal y hojas de cálculo desactualizadas para contabilizar los repuestos electrónicos. Esta falta de sistematización genera tres problemas críticos:
1. **Pérdida de Información Técnica:** Cuando un técnico repara una fuente de alimentación conmutada sustituyendo un condensador electrolítico degradado pero no documenta el síntoma ni la referencia de la pieza, el siguiente turno carece de antecedentes cuando un segundo equipo idéntico manifiesta el mismo comportamiento errático.
2. **Rotura Imprevista de Existencias:** Un equipo de plató vital queda fuera de servicio porque la única tarjeta de repuesto disponible en almacén ya había sido instalada semanas atrás sin que nadie emitiera la correspondiente orden de compra de reposición.
3. **Inexistencia de Auditoría y Trazabilidad:** Ante una auditoría técnica o una reclamación de garantía a un fabricante internacional, la empresa no dispone de un registro cronológico formal que demuestre las condiciones de trabajo, las revisiones preventivas efectuadas y los números de serie implicados.

**Pulso Taller (`GestMant_TS`)** fue diseñado desde sus cimientos para resolver esta problemática estructural. Proporciona una plataforma digital en tiempo real que combina la inmediatez de reporte requerida en un directo con el rigor metodológico, contable y documental propio de un laboratorio de ingeniería electrónica.

### 1.2 Vocabulario Ubicuo del Taller y Glosario de Términos Prohibidos
El lenguaje condiciona la precisión de las operaciones. En un entorno de alta tensión operativa como un centro emisor, la ambigüedad semántica induce a errores graves (por ejemplo, confundir un módulo de repuesto con un equipo completo o considerar cerrada una actuación que solo fue contenida provisionalmente).

Por mandato de la dirección técnica y en estricto cumplimiento del archivo normativo `GLOSARIO.md`, en Pulso Taller rigen las siguientes definiciones de **Vocabulario Ubicuo**. El uso de cualquiera de los términos prohibidos está vetado tanto en la interfaz del sistema como en los partes oficiales y manuales de procedimiento:

| Concepto Oficial Obligatorio | Términos Vetetados y Prohibidos | Definición Semántica Precisa |
|---|---|---|
| **Incidencia** | *Ticket*, *avería*, *fallo*, *problema*, *solicitud de asistencia* | Expediente formal abierto ante una anomalía funcional, eléctrica o mecánica detectada en un equipo del centro emisor. Registra todo su ciclo vital desde el reporte hasta su verificación final. |
| **Equipo** | *Máquina*, *aparato*, *dispositivo*, *caja*, *hierro* | Unidad física individual catalogada en el inventario con número de serie único y código de inventario (cámara de plató, mezclador de vídeo, CCU, matriz SDI, monitor de forma de onda, switch IP PTP). |
| **Petición de repuesto** | *Solicitud de material*, *pedido de piezas*, *vale de almacén* | Requerimiento formal emitido por un técnico para obtener una o varias unidades de un componente o repuesto de almacén destinado a solucionar una incidencia o mantenimiento. |
| **Parte de trabajo** | *Informe de servicio*, *albarán de trabajo*, *ticket cerrado* | Documento técnico oficial certificado (disponible en PDF con membrete corporativo) que atestigua las actuaciones realizadas, tiempos de intervención, diagnóstico de causa raíz y piezas instaladas. |
| **Técnico** | *Operario*, *mecánico*, *chico de soporte*, *reparador* | Profesional acreditado de ingeniería o mantenimiento electrónico con credenciales para diagnosticar, intervenir equipos, cumplimentar cuadernos técnicos y emitir peticiones de piezas. |
| **Almacén** | *Depósito*, *pañol*, *trastero*, *stock* | Espacio físico controlado donde se custodian los repuestos, clasificados unívocamente por estantería, módulo y cajonera bajo supervisión del Responsable de Repuestos. |

### 1.3 Principios Inviolables de Trazabilidad Técnica
Toda actuación en el taller se rige por tres invariantes operativas innegociables:
- **Invariante 1: Cero "Trabajo sin Traza".** Ningún equipo puede ser intervenido físicamente sin una incidencia formal asociada. Cualquier sustitución de placa, calibración óptica o ajuste de firmware debe quedar asentada en el Cuaderno Técnico del expediente.
- **Invariante 2: Inmutabilidad Histórica.** Una vez que una incidencia es resuelta y cerrada, el historial de notas técnicas, los partes de trabajo emitidos y los registros de auditoría no pueden ser alterados ni eliminados.
- **Invariante 3: Doble Control de Existencias.** Ningún repuesto puede salir del almacén físico sin una petición de repuesto previamente aprobada y deducida en el sistema.

---

<!-- ==================== PÁGINA 4: CAPÍTULO 2 ==================== -->
<div style="page-break-after: always;"></div>

## Capítulo 2: Arquitectura del Sistema, Pila Tecnológica y Separación de Capas

### 2.1 Diagrama de Arquitectura C4 y Flujo de Datos
Pulso Taller está construido sobre un modelo de arquitectura limpia desacoplada, optimizada para ofrecer baja latencia, sincronización reactiva instantánea entre múltiples clientes concurrentes y robustez frente a desconexiones de red en platós o controles remotos:

```
+-----------------------------------------------------------------------------------+
|                            CLIENTE DE NAVEGACIÓN WEB                              |
|   +---------------------------------------------------------------------------+   |
|   |  Capa de Presentación React 19 + TypeScript 5.7                           |   |
|   |  - Rutas: Landing, /reportar, /login, /dashboard/*                        |   |
|   |  - Componentes: Radix UI Primitives, Tailwind CSS v4, Lucide Icons        |   |
|   |  - Editor: Tiptap Rich Text Engine con subida de imágenes y versionado   |   |
|   +-------------------------------------+-------------------------------------+   |
|                                         |                                         |
|                                         v (Llamadas de Dominio Puras)             |
|   +---------------------------------------------------------------------------+   |
|   |  Capa de Dominio Puro (src/lib/) - AISLADA DE REACT Y CONVEX             |   |
|   |  - incidentFlow.ts, requestFlow.ts, purchaseFlow.ts                       |   |
|   |  - Máquinas de estado finitas, cálculo de SLA, formateadores de moneda    |   |
|   |  - Generador de Partes de Trabajo en PDF (jsPDF / AutoTable nativo)       |   |
|   +-------------------------------------+-------------------------------------+   |
+-----------------------------------------|-----------------------------------------+
                                          |
                      WebSockets Reactivos / TLS Seguro
                                          |
+-----------------------------------------v-----------------------------------------+
|                         BACKEND DISTRIBUIDO (CONVEX 1.46)                         |
|   +---------------------------------------------------------------------------+   |
|   |  Motor de Consultas y Mutaciones Transaccionales                          |   |
|   |  - queries.ts / mutations.ts (Verificación estricta de identidad y RBAC)  |   |
|   |  - Esquema Relacional Tipado (schema.ts): incidents, equipment, parts...  |   |
|   |  - Trazabilidad de Auditoría Inmutable (securityAuditLog)                 |   |
|   +-------------------------------------+-------------------------------------+   |
|                                         |                                         |
|                                         v                                         |
|   +---------------------------------------------------------------------------+   |
|   |  Almacenamiento de Ficheros y Base de Datos Integrada                     |   |
|   |  - Convex Storage para manuales de servicio PDF y capturas de cuaderno    |   |
|   |  - Despliegue Local / Dockerizado en Servidor NAS Synology Central        |   |
|   +---------------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------------+
```

### 2.2 Aislamiento Estricto de Dominio (`src/lib/`) y Protección contra Acoplamientos
Una de las decisiones arquitectónicas fundamentales de Pulso Taller es el desacoplamiento total entre las reglas del negocio y el framework de interfaz o backend. 

Bajo la regla de gobernanza `AGENTS.md`, **la carpeta `src/lib/` es una zona agnóstica de infraestructura**:
- **Prohibición Total:** Está terminantemente prohibido importar librerías visuales (`react`, `react-dom`) o clientes de base de datos (`convex`, `convex/*`) dentro de `src/lib/`.
- **Verificación Automatizada:** El archivo de test `tests/arquitectura.test.ts` analiza en cada build el árbol de importaciones mediante análisis de sintaxis AST. Si cualquier desarrollador o agente introduce una dependencia indebida, la compilación se detiene inmediatamente.
- **Beneficio Operativo:** Las reglas que determinan si una incidencia puede pasar de `in_progress` a `resolved` o si una petición puede deducir material residen en funciones deterministas puras (`canTransitionIncident`, `canTransitionRequest`). Esto permite ejecutar suites completas de pruebas unitarias en milisegundos sin necesidad de levantar bases de datos de prueba ni simular interfaces de usuario.

### 2.3 Reactividad en Tiempo Real con Convex Engine y WebSockets
A diferencia de los sistemas de mantenimiento basados en peticiones HTTP REST tradicionales con sondeos periódicos (*polling*), Pulso Taller utiliza suscripciones reactivas continuas sobre WebSockets:
- Cuando un operador notifica una incidencia desde `/reportar`, el cambio de estado se propaga a la pantalla del coordinador del taller en menos de 100 milisegundos sin necesidad de refrescar la página (`F5`).
- Cuando el Responsable de Repuestos autoriza una entrega de material, el contador de stock de la ficha de repuesto se actualiza simultáneamente en los terminales de todos los técnicos conectados.
- Si dos técnicos consultan la misma incidencia, las notas introducidas en el Cuaderno Técnico se visualizan de manera coordinada, evitando la duplicidad de intervenciones sobre el mismo equipo averiado.

---

<!-- ==================== PÁGINA 5: CAPÍTULO 3 ==================== -->
<div style="page-break-after: always;"></div>

## Capítulo 3: Identidad, Seguridad y Control de Acceso Basado en Roles (RBAC)

### 3.1 Modelo de Autenticación Segura y Gestión de Sesiones
El acceso a las funciones operativas y administrativas de Pulso Taller requiere autenticación mediante el módulo `@convex-dev/auth`. El sistema implementa las siguientes medidas de protección:
- **Tokens de Sesión Criptográficos:** Las sesiones se administran mediante cookies de solo lectura seguras (`HttpOnly`, `SameSite=Lax`, `Secure`), inmunes a ataques de secuestro por inyección de scripts cruzados (XSS).
- **Control de Expiración:** Las sesiones inactivas caducan automáticamente tras 12 horas de inactividad, exigiendo reautenticación para evitar accesos no autorizados en terminales compartidos de los controles de realización.
- **Protección contra Fuerza Bruta:** Se aplican retardos progresivos y bloqueo temporal de solicitudes tras múltiples intentos fallidos de acceso.

### 3.2 Los 4 Roles Predefinidos del Sistema
La plataforma cuenta con cuatro roles nativos jerárquicos diseñados para reflejar las responsabilidades habituales de una plantilla técnica de televisión:

1. **Administrador (`admin`):**
   - Máxima autoridad del sistema. Control absoluto sobre usuarios, roles, membrete corporativo, auditoría y borrado seguro.
   - Es el único rol capacitado para acceder a la configuración avanzada y gestionar la infraestructura.
2. **Responsable de Repuestos (`parts_manager`):**
   - Gestor del almacén central, aprovisionamiento y compras.
   - Aprueba o deniega peticiones de material, emite órdenes de compra a proveedores, recepciona albaranes físicos y supervisa el inventario valorado.
3. **Técnico (`technician`):**
   - Ingeniero o técnico de mantenimiento electrónico.
   - Recepciona incidencias asignadas, cumplimenta el Cuaderno Técnico enriquecido, emite peticiones de repuesto para sus reparaciones, consulta manuales de servicio y genera partes de trabajo oficiales.
4. **Usuario / Operador de Plató (`user`):**
   - Personal operativo de plató, realizadores, cámaras y operadores de sonido.
   - Tiene visibilidad sobre el estado de sus reportes, puede añadir comentarios informativos y consultar el histórico básico sin capacidad de modificar diagnósticos técnicos ni manipular almacén.

---

<!-- ==================== PÁGINA 6: CAPÍTULO 3 (CONTINUACIÓN) ==================== -->
<div style="page-break-after: always;"></div>

### 3.3 Matriz Exhaustiva de las 18 Capacidades Granulares del Taller
Para evitar el otorgamiento de privilegios globales indiscriminados, Pulso Taller divide las operaciones en **18 capacidades técnicas granulares**. Cada mutación del servidor comprueba individualmente si el usuario autenticado posee la capacidad requerida:

| Identificador de Capacidad | Descripción Operativa | Nivel de Riesgo | Asignación por Defecto |
|---|---|---|---|
| `incidents:create` | Abrir nuevas incidencias en el sistema desde el entorno autenticado. | Bajo | Todos los roles |
| `incidents:edit` | Modificar título, descripción, ubicación o equipo de una incidencia abierta. | Medio | Técnico, Responsable, Admin |
| `incidents:assign` | Asignar la titularidad de una incidencia a un técnico específico o derivarla a taller. | Medio | Técnico, Responsable, Admin |
| `incidents:change_status` | Transicionar el estado de la incidencia (ej. iniciar trabajo, resolver, cancelar). | Alto | Técnico, Responsable, Admin |
| `incidents:delete` | Eliminar definitivamente el expediente de una incidencia (requiere justificación). | Crítico | Solo Administrador |
| `parts:request` | Emitir una petición formal de material de repuesto vinculada a una incidencia. | Medio | Técnico, Responsable, Admin |
| `parts:approve` | Aprobar o denegar peticiones de repuesto y autorizar la salida de material. | Alto | Responsable de Repuestos, Admin |
| `parts:manage_stock` | Dar de alta repuestos, editar precios, modificar ubicaciones y hacer ajustes de stock. | Alto | Responsable de Repuestos, Admin |
| `orders:manage` | Crear órdenes de compra oficiales, agrupar líneas por proveedor y recepcionar albaranes. | Alto | Responsable de Repuestos, Admin |
| `equipment:create` | Dar de alta nuevos equipos en el inventario maestro con número de serie y garantía. | Medio | Técnico, Responsable, Admin |
| `equipment:edit` | Modificar datos técnicos de un equipo, firmware, ubicación o periodicidad preventiva. | Medio | Técnico, Responsable, Admin |
| `equipment:delete` | Dar de baja un equipo del inventario oficial de la empresa. | Crítico | Solo Administrador |
| `preventive:manage` | Crear planes periódicos de mantenimiento, checklists de revisión y registrar ejecuciones. | Medio | Técnico, Responsable, Admin |
| `manuals:upload` | Subir manuales de servicio técnico, esquemas electrónicos y guías en PDF. | Medio | Técnico, Responsable, Admin |
| `manuals:delete` | Eliminar manuales de servicio de la biblioteca central de documentación. | Alto | Solo Administrador |
| `reports:export` | Descargar partes de trabajo certificados en PDF, informes semanales y auditorías. | Bajo | Todos los roles autenticados |
| `users:manage` | Dar de alta técnicos, asignar roles, activar o revocar accesos y cambiar contraseñas. | Crítico | Solo Administrador |
| `settings:manage` | Modificar membrete corporativo, datos fiscales, límites de almacenamiento y auditoría. | Crítico | Solo Administrador |

### 3.4 Motor de Roles Personalizados y Principio de Menor Privilegio
En instalaciones complejas (por ejemplo, canales autonómicos o grandes centros de producción con subcontratas de mantenimiento externo), es habitual requerir perfiles intermedios. Pulso Taller incorpora un motor dinámico de roles que permite:
- **Creación de Roles a Medida:** Definir un rol como *"Técnico de Mantenimiento Preventivo Externo"*, asignándole únicamente `incidents:create`, `equipment:edit` y `preventive:manage`, impidiendo que pueda pedir repuestos de alto valor o cerrar incidencias críticas de plató.
- **Clonación de Plantillas:** Duplicar el rol `technician` y añadirle temporalmente `parts:approve` durante periodos de guardia de fin de semana en los que no hay Responsable de Repuestos en el centro.

### 3.5 Trazabilidad Inmutable con `securityAuditLog`
Cualquier acción sensible ejecutada en la plataforma queda registrada en la tabla de auditoría `securityAuditLog`. Cada entrada almacena de forma inmutable:
1. Marca temporal exacta en milisegundos con zona horaria UTC.
2. Identificador de usuario (`userId`) y correo electrónico corporativo del ejecutor.
3. Tipo de evento (`AUTH_LOGIN`, `ROLE_MODIFIED`, `INCIDENT_CLOSED`, `STOCK_ADJUSTED`, `DATA_EXPORTED`).
4. Dirección IP de origen y cabecera de agente de usuario (*User-Agent*).
5. Carga de datos modificada (*payload diff*), detallando el valor previo y el valor posterior.
*Por regla de seguridad innegociable (`AGENTS.md`), la tabla `securityAuditLog` jamás se vacía, ni siquiera durante los procesos de reseteo o purga de taller.*

---

<!-- ==================== PÁGINA 7: CAPÍTULO 4 ==================== -->
<div style="page-break-after: always;"></div>

## Capítulo 4: Gestión Integral del Ciclo de Vida de Incidencias

### 4.1 Máquina de Estados Finita de Incidencias y Reglas de Transición
Toda incidencia registrada en Pulso Taller está gobernada por la máquina de estados formal implementada en `src/lib/incidentFlow.ts`. Está terminantemente prohibido alterar el estado de una incidencia saltándose las transiciones validadas:

```
                  +--------------------+
                  |    ABIERTA (open)  | <--- Notificación pública o interna
                  +---------+----------+
                            |
        +-------------------+-------------------+
        | (Triaje In-situ)                      | (Derivación a Laboratorio)
        v                                       v
+-------+---------------+               +-------+---------------+
|  ASIGNADA IN-SITU     |               |   ASIGNADA TALLER     |
| (assigned_onsite)     |               |  (assigned_workshop)  |
+-------+---------------+               +-------+---------------+
        |                                       |
        +-------------------+-------------------+
                            | (Técnico pulsa "Iniciar trabajo")
                            v
                  +---------+----------+
                  |    EN PROGRESO     | <--- Intervención, Cuaderno Técnico,
                  |   (in_progress)    |      Peticiones de Repuesto
                  +---------+----------+
                            |
        +-------------------+-------------------+
        | (Reparación verificada)               | (Improcedente / Duplicada)
        v                                       v
+-------+---------------+               +-------+---------------+
|    RESUELTA           |               |   CANCELADA           |
|   (resolved)          |               |  (cancelled)          |
+-------+---------------+               +-----------------------+
        |
        | (Supervisión y cierre formal)
        v
+-------+---------------+
|    CERRADA            | ---> Emisión obligatoria del Parte de Trabajo en PDF
|    (closed)           |
+-----------------------+
```

#### Reglas de Transición Inviolables:
- No se puede transicionar a `resolved` si la incidencia tiene peticiones de repuesto pendientes de entrega o albaranes no recepcionados.
- El paso a `resolved` exige obligatoriamente cumplimentar el campo de **Diagnóstico Técnico de Causa Raíz** y el tiempo real de mano de obra invertido.
- La reapertura de una incidencia cerrada no es posible: si la avería reaparece, el sistema obliga a abrir una nueva incidencia vinculada al mismo equipo para no distorsionar las métricas estadísticas de fiabilidad (MTTR/MTBF).

---

<!-- ==================== PÁGINA 8: CAPÍTULO 4 (CONTINUACIÓN) ==================== -->
<div style="page-break-after: always;"></div>

### 4.2 Portal Público de Notificación Inmediata (`/reportar`) sin Credenciales
Durante una transmisión en directo, un operador de cámara o realizador no puede perder minutos recordando contraseñas o navegando menús complejos. Por ello, Pulso Taller dispone de una puerta de enlace rápida accesible en la raíz pública `/reportar`:
- **Interfaz Simplificada y Táctil:** Optimizada para teléfonos móviles y pantallas táctiles instaladas en los controles técnicos.
- **Tiempo Medio de Reporte:** Menor a 30 segundos.
- **Campos Guiados:** Selección de la ubicación física en un desplegable claro, título descriptivo del síntoma, prioridad percibida y equipo afectado.
- **Confirmación con Código de Seguimiento:** Al enviar el reporte, el usuario recibe un código alfanumérico único (ej. `INC-2026-0042`) que le permite verificar en cualquier momento el estado de la intervención sin necesidad de tener cuenta de usuario activa.
- **Protección Antispam:** La puerta de enlace pública cuenta con limitador de tasa de peticiones (*rate limiting*) por dirección IP para evitar envíos masivos maliciosos.

### 4.3 Procedimiento de Alta de Equipos en Caliente durante el Reporte
Uno de los principales motivos por los que los operadores eluden reportar averías formales es no encontrar el equipo en el listado desplegable. Pulso Taller soluciona este cuello de botella con el **Alta en Caliente**:
- Si el equipo averiado no figura en el desplegable de equipos existentes, el operador pulsa el botón adyacente **«Dar de alta equipo ahora»**.
- Se despliega un diálogo emergente modal donde se solicita únicamente:
  1. *Modelo de Equipo* (seleccionable de la biblioteca homologada).
  2. *Número de Serie (S/N)* o referencia provisional serigrafiada.
- El sistema crea la ficha del equipo en estado preliminar y la vincula instantáneamente a la nueva incidencia, notificando al equipo de taller para que proceda a completar la ficha técnica definitiva durante la intervención.

### 4.4 Triaje Técnico, Criterios de Criticidad y Enrutamiento Operativo
Cuando una incidencia entra al sistema en estado `open`, el coordinador de guardia realiza el triaje operativo basándose en la matriz de impacto broadcast:

| Nivel de Prioridad | Criterio de Impacto Técnico | Tiempo de Respuesta Exigido (SLA) | Destino de Asignación |
|---|---|---|---|
| **Urgente** | Señal de emisión en el aire caída o en riesgo inminente de corte sin redundancia. | < 5 minutos | `assigned_onsite` (Técnico de plató) |
| **Alta** | Pérdida de un canal de backup o equipo redundante n+1 de infraestructura crítica. | < 30 minutos | `assigned_onsite` o `assigned_workshop` |
| **Normal** | Degradación estética o funcional secundaria en puesto de trabajo o sala de edición. | < 4 horas | `assigned_workshop` (Taller central) |
| **Baja** | Mantenimiento cosmético, sustitución de tapas, etiquetado o reconfiguraciones menores. | < 24 horas | `assigned_workshop` (Cola ordinaria) |

---

<!-- ==================== PÁGINA 9: CAPÍTULO 4 (CONTINUACIÓN) ==================== -->
<div style="page-break-after: always;"></div>

### 4.5 El Cuaderno Técnico de Intervención: Editor Enriquecido, Adjuntos y Control de Versiones
El corazón operativo de la reparación es el **Cuaderno Técnico** ubicado en la ficha de detalle de la incidencia (`IncidentDetailSheet`). No es un simple campo de texto plano, sino una herramienta de documentación de ingeniería avanzada impulsada por el motor TipTap:
- **Formato Estructurado:** Permite títulos de sección, listas ordenadas de comprobaciones, tablas de mediciones de voltaje y bloques de código para registrar comandos de configuración de red o firmware.
- **Inserción Directa de Imágenes:** Los técnicos pueden pegar capturas desde el portapapeles (`Ctrl+V`) o arrastrar oscilogramas, fotografías macro de circuitos impresos con pistas quemadas o capturas de analizadores de señal SDI.
- **Historial Completo de Revisiones y Diff:** Cada vez que un técnico pulsa el botón **«Guardar notas»**, el sistema almacena una instantánea inmutable en la tabla `incidentNotebookHistory`. Mediante un desplegable cronológico, cualquier compañero puede consultar qué escribió cada turno y restaurar cualquier versión anterior con un solo clic.

```
+-----------------------------------------------------------------------------------+
| CUADERNO TÉCNICO DE INTERVENCIÓN - INC-0089                                       |
| [ Deshacer ] [ Negrita ] [ Cursiva ] [ Lista ] [ Tabla ] [ Adjuntar Oscilograma ] |
+-----------------------------------------------------------------------------------+
| ## 1. Diagnóstico Inicial en Banco de Trabajo                                     |
| El monitor de forma de onda Leader LV5380 no arranca. El LED frontal parpadea en |
| color ámbar con cadencia de 2 destellos por segundo.                              |
|                                                                                   |
| ## 2. Mediciones de Tensión en Primario SMPS:                                     |
| +-------------------------+--------------------+-------------------+              |
| | Punto de Test           | Tensión Nominal    | Medida Real       |              |
| +-------------------------+--------------------+-------------------+              |
| | TP-101 (Bus DC)         | +385 VDC           | +310 VDC (Anómalo)|              |
| | TP-104 (Auxiliar PWM)   | +14.5 VDC          | +8.2 VDC (Bajo)   |              |
| +-------------------------+--------------------+-------------------+              |
|                                                                                   |
| ## 3. Causa Raíz Detectada:                                                       |
| Condensador electrolítico C104 (47uF / 50V) presenta un ESR de 14.8 Ohmios.      |
| [ Fotografía macro del condensador hinchado en circuito impreso ]                 |
+-----------------------------------------------------------------------------------+
| [ Guardar notas ]   Historial de revisiones: [ v3 - 16/10 18:30 (R. Gómez) v ]   |
+-----------------------------------------------------------------------------------+
```

### 4.6 Resolución, Clasificación de Causas Raíz y Generación del Parte de Trabajo en PDF
Cuando el equipo averiado supera las pruebas de banco y funciona conforme a las normas de emisión, el técnico procede al cierre formal:
1. **Selección de la Causa Raíz Oficial:** Se clasifica entre: *Fallo por Envejecimiento de Componente*, *Sobretensión Eléctrica*, *Fallo Mecánico / Desgaste*, *Error de Configuración / Humano*, *Defecto de Firmware de Fabricante* o *Condiciones Ambientales / Temperatura Excesiva*.
2. **Registro de Tiempos:** Se especifica el tiempo de diagnóstico y el tiempo de reparación efectiva en minutos.
3. **Generación Inmediata del Parte de Trabajo Oficial:** Al pulsar **«Resolver incidencia»**, el sistema genera automáticamente el **Parte de Trabajo** oficial en PDF certificado. Este documento incorpora:
   - Membrete y CIF de la empresa audiovisual.
   - Datos del equipo (Modelo, S/N, Ubicación de origen).
   - Cronología de tiempos (Apertura, Asignación, Inicio de trabajo, Resolución).
   - Relación detallada de repuestos consumidos con sus referencias P/N.
   - Transcripción completa del Cuaderno Técnico y firma digital del técnico actuante.

---

<!-- ==================== PÁGINA 10: CAPÍTULO 5 ==================== -->
<div style="page-break-after: always;"></div>

## Capítulo 5: Inventario Serializado de Equipos y Mantenimiento Preventivo

### 5.1 Ficha Maestra del Equipo y Normalización de Identificadores
Cada elemento físico inventariado en Pulso Taller se gestiona mediante una ficha maestra única (`equipment`). El sistema garantiza que no existan duplicidades ni confusiones entre unidades idénticas del mismo modelo:
- **Código de Inventario Único:** Identificador alfanumérico estructurado (`EQ-XXX-0000`). Se rotula en el equipo físico mediante etiquetas de vinilo de alta resistencia con código de barras y código QR.
- **Número de Serie del Fabricante (S/N):** Serial grabado en la placa del chasis por el fabricante original (Sony, Grass Valley, Evertz, Riedel, Blackmagic, etc.). Es obligatorio y único en el sistema.
- **Versión de Firmware Instalada:** Permite auditar qué equipos de una misma familia están desactualizados ante boletines de seguridad o incompatibilidades de protocolo SMPTE ST 2110.
- **Ubicación Fisiotópica Habitual:** Sala técnica, plató, unidad móvil o estante de reserva de almacén donde reside habitualmente el equipo.
- **Control de Cobertura y Garantía:** Fecha exacta de caducidad de la garantía de fábrica y referencia del contrato de mantenimiento con el integrador o fabricante.

### 5.2 Catálogo de Modelos de Equipos y Fabricantes Homologados
Para evitar discrepancias tipográficas (como registrar *"Sony HDC2500"*, *"SONY hdc-2500"* o *"Sony HDC 2500"*), Pulso Taller implementa un catálogo centralizado de modelos (`equipmentModels.ts`):
- Los técnicos seleccionan el modelo de una lista normalizada.
- Al elegir el modelo, el fabricante, la categoría técnica (Cámaras, Matrices, Audio, Procesado, Vídeo, Óptica) y los manuales de servicio asociados se vinculan automáticamente.
- Solo los administradores y coordinadores de taller tienen autorización para incorporar nuevos modelos al catálogo oficial.

```
+-----------------------------------------------------------------------------------+
| FICHA MAESTRA DE EQUIPO: EQ-CAM-0014                                              |
| Fabricante: SONY                   Modelo: HDC-4300 4K/HD Studio Camera System     |
| Número de Serie: S/N-902184        Firmware: v5.21-b04                            |
| Ubicación: Plató Principal (P-01)  Garantía Oficial: Válida hasta 12/2027         |
+-----------------------------------------------------------------------------------+
| Pestañas: [ Información General ] [ Historial de Incidencias ] [ Preventivos ]   |
+-----------------------------------------------------------------------------------+
| Historial de Intervenciones Correctivas:                                          |
| - 12/09/2026: INC-0045 - Fallo intermitente en salida 12G-SDI (Sustituido BNC).  |
| - 04/05/2026: INC-0012 - Limpieza de prisma óptico por mota de polvo en canal G. |
|                                                                                   |
| Próximo Mantenimiento Preventivo:                                                 |
| - Fecha Programada: 15/11/2026 (Dentro de 30 días)                                |
| - Tareas: Calibración de balance óptico, comprobación LEMO SMPTE y limpieza fan.  |
+-----------------------------------------------------------------------------------+
```

---

<!-- ==================== PÁGINA 11: CAPÍTULO 5 (CONTINUACIÓN) ==================== -->
<div style="page-break-after: always;"></div>

### 5.3 Hoja de Vida y Trazabilidad Histórica de Averías
Al abrir la ficha de cualquier equipo, el ingeniero de mantenimiento dispone de su **Hoja de Vida Completa**:
- Listado cronológico de todas las incidencias sufridas por el equipo desde su fecha de adquisición.
- Relación de todos los repuestos electrónicos y mecánicos que le han sido instalados a lo largo de su vida útil.
- Gráfica de evolución del tiempo transcurrido entre averías para predecir si el equipo ha entrado en la fase de desgaste exponencial (*curva de la bañera* industrial) y aconsejar su sustitución o renovación tecnológica.

### 5.4 Planes Periódicos de Mantenimiento Preventivo y Cálculo de Vencimientos
El mantenimiento correctivo (reparar cuando se rompe) es costoso e inaceptable en emisión. Pulso Taller incorpora un potente gestor de **Mantenimiento Preventivo Planificado**:
- **Periodicidad Parametrizable:** Cada equipo puede tener asignado un ciclo de revisión periódica en días:
  - *Mensual (30 días):* Limpieza de filtros de refrigeración en servidores de emisión y proyectores.
  - *Trimestral (90 días):* Calibración de cadenas de cámara, alineamiento de monitores de referencia y comprobación de fuentes redundantes.
  - *Semestral (180 días):* Revisión de baterías en Sistemas de Alimentación Ininterrumpida (SAI/UPS) y lubricación de cabezas de trípode robotizadas.
  - *Anual (365 días):* Certificación de aislamiento eléctrico, comprobación de latiguillos de fibra óptica con reflectómetro óptico (OTDR) y actualización de firmware consolidado.
- **Cálculo Automático de Próxima Revisión:** Al registrar la ejecución de un mantenimiento preventivo con su checklist correspondiente, el sistema calcula de forma determinista la fecha del próximo vencimiento y emite avisos visuales en el panel de control cuando restan menos de 15 días para la fecha límite.

### 5.5 Exportación de la Ficha Técnica Integral del Equipo en PDF
En cualquier instante, el usuario puede pulsar el botón **«Exportar Ficha Técnica en PDF»**. El sistema compila en un documento PDF de alta calidad:
1. Placa de características técnicas, números de serie y fotografía del equipo.
2. Estado de mantenimiento preventivo y fecha de la última certificación.
3. Historial consolidado de averías y coste acumulado en piezas de repuesto.
4. Código QR para pegado físico en el equipo, permitiendo escanearlo con cualquier terminal móvil para abrir directamente su expediente en el taller.

---

<!-- ==================== PÁGINA 12: CAPÍTULO 6 ==================== -->
<div style="page-break-after: always;"></div>

## Capítulo 6: Almacén de Repuestos, Normalización de P/N y Control de Existencias

### 6.1 Catálogo de Repuestos y Reglas de Codificación P/N
El almacén de Pulso Taller gestiona miles de referencias de alta precisión. Para evitar la entrada de componentes erróneos, cada repuesto se cataloga bajo una ficha normalizada:
- **Denominación Técnica Oficial:** Nombre descriptivo claro sin marcas comerciales genéricas (ejemplo correcto: *"Módulo Transceptor SFP+ Óptico 10Gbps Monomodo 1310nm 10km LC"*).
- **Número de Parte del Fabricante (P/N - Part Number):** Código unívoco del fabricante del componente (ejemplo: `FTLX1471D3BCL` de Finisar o `1-856-421-11` de Sony). El sistema valida que no existan P/N duplicados.
- **Familia Técnica:** Categorización jerárquica: *Semiconductores*, *Conectores y Adaptadores*, *Fuentes de Alimentación*, *Ventiladores y Refrigeración*, *Módulos Ópticos / SFP*, *Componentes Pasivos (Condensadores/Resistencias)*, *Baterías* y *Mecánica / Carcasas*.

### 6.2 Topología Física del Almacén: Estanterías, Módulos y Cajoneras
Pulso Taller modela la realidad física del almacén del taller para que cualquier técnico encuentre una pieza en segundos sin depender de la memoria de sus compañeros:
- **Formato de Ubicación Tripartito:** `EST-MOD-CAJ` (Ejemplo: `E2-M04-C12`).
  - `E2`: Estantería número 2 (Pasillo Central de Electrónica).
  - `M04`: Módulo vertical o balda número 4.
  - `C12`: Cajón o gaveta antiestática número 12.
- **Etiquetado Visual:** La interfaz del sistema muestra la ubicación resaltada con iconos gráficos de posición física para una rápida localización espacial.

```
+-----------------------------------------------------------------------------------+
| TOPOLOGÍA DE UBICACIÓN FÍSICA EN ALMACÉN CENTRAL                                  |
|                                                                                   |
|  [ PASILLO A: SEMICONDUCTORES ]          [ PASILLO B: CONECTORES Y CABLES ]       |
|  +---------------------------+           +---------------------------+            |
|  | Estantería E1: SMD / ICs  |           | Estantería E3: SDI / BNC  |            |
|  +---------------------------+           +---------------------------+            |
|  | Estantería E2: Fuentes    | <--- E2   | Estantería E4: Fibra Óptica|           |
|  | - Módulo 01: SMPS Sony    |           +---------------------------+            |
|  | - Módulo 02: SMPS Grass V.|                                                    |
|  | - Módulo 03: Transformad. |                                                    |
|  | - Módulo 04: Condensad.   | <--- M04                                           |
|  |   [C11] [C12: ESR Bajo]   | <--- C12 (Ubicación: E2-M04-C12)                   |
|  +---------------------------+                                                    |
+-----------------------------------------------------------------------------------+
```

---

<!-- ==================== PÁGINA 13: CAPÍTULO 6 (CONTINUACIÓN) ==================== -->
<div style="page-break-after: always;"></div>

### 6.3 Algoritmos de Control de Stock: Stock Mínimo, Óptimo y Puntos de Pedido
Para garantizar que nunca se produzca una rotura de stock en piezas críticas de plató, el sistema implementa un motor automático de alerta de inventario:
- **Stock Actual ($S_a$):** Existencias físicas netas disponibles en las cajoneras del almacén.
- **Stock Mínimo o Umbral de Seguridad ($S_{min}$):** Cantidad por debajo de la cual el taller entra en riesgo operativo si sobreviene una avería múltiple.
- **Stock Óptimo ($S_{opt}$):** Nivel deseado de existencias que equilibra la cobertura de emergencias con el coste financiero de inmovilizado material.
- **Detección Automática de Rotura:** Cuando una deducción por reparación hace que $S_a \le S_{min}$, el sistema:
  1. Marca la ficha del repuesto con una insignia roja destacada de **«Bajo Stock»**.
  2. Añade automáticamente la referencia a la cola de sugerencias del módulo de Compras para el Responsable de Repuestos.
  3. Calcula la cantidad sugerida de pedido: $Q = S_{opt} - S_a$.

### 6.4 Matriz de Compatibilidad Repuesto-Equipo
Un repuesto genérico puede ser válido para múltiples modelos de equipos diferentes. Por ejemplo, un ventilador axial de 40x40x10mm a 12VDC puede ser compatible con mezcladores de vídeo, matrices de enrutamiento y distribuidores de señal de distintos fabricantes.
- Pulso Taller permite vincular cada repuesto con múltiples modelos de equipos de su catálogo.
- Cuando un técnico abre una incidencia sobre una cámara o matriz concreta, el selector de peticiones de repuesto **filtra prioritariamente las piezas compatibles homologadas**, impidiendo que se soliciten componentes eléctricamente incompatibles.

### 6.5 Ajustes de Inventario y Auditorías Físicas Periódicas
Al menos una vez por semestre, el Responsable de Repuestos ejecuta la auditoría física de existencias:
- La aplicación ofrece la vista de **«Recuento de Inventario»**.
- Los ajustes de stock por mermas, componentes defectuosos de fábrica o discrepancias de conteo exigen registrar obligatoriamente el motivo del ajuste.
- La modificación de stock queda registrada de manera inmutable en el log de auditoría con la identidad del responsable.

---

<!-- ==================== PÁGINA 14: CAPÍTULO 7 ==================== -->
<div style="page-break-after: always;"></div>

## Capítulo 7: Circuito Completo de Peticiones de Repuesto y Compras

### 7.1 Máquina de Estados de Peticiones de Repuesto
Toda solicitud de material está regida por la máquina de estados definida en `src/lib/requestFlow.ts`. El flujo asegura que ninguna pieza salga de almacén sin autorización contable:

```
            +--------------------+
            |  BORRADOR (draft)  | <--- Creación por el Técnico
            +---------+----------+
                      |
                      | (Técnico envía a validación)
                      v
            +--------------------+
            | PENDIENTE APROBAR  |
            | (pending_approval) |
            +---------+----------+
                      |
        +-------------+-------------+
        | (Hay stock disponible)    | (No hay stock en almacén)
        v                           v
+-------+---------------+   +-------+---------------+
|   APROBADA            |   |   PEDIDA A COMPRAS    | <--- Agrupación en Orden de Compra
|  (approved)           |   |   (ordered)           |
+-------+---------------+   +-------+---------------+
        |                           |
        | (Almacén entrega)         | (Llega albarán de proveedor)
        v                           v
+-------+---------------+   +-------+---------------+
|   ENTREGADA           |   |   RECEPCIONADA        |
|  (delivered)          |   |   (received)          |
+-----------------------+   +-------+---------------+
                                    |
                                    | (Pasa a entrega física)
                                    v
                            +-------+---------------+
                            |   ENTREGADA           |
                            |  (delivered)          |
                            +-----------------------+
```

### 7.2 Emisión y Justificación de Peticiones por el Técnico
Cuando un técnico diagnostica que una incidencia requiere la sustitución de una pieza:
1. Accede a la ficha de la incidencia y pulsa **«Pedir repuesto»**.
2. Selecciona la pieza del catálogo (filtrada por compatibilidad con el equipo intervenido).
3. Especifica las unidades requeridas y cumplimenta obligatoriamente la **Justificación Técnica** (por ejemplo: *"Sustitución de condensador de primario perforado con fugas de electrolito comprobadas con medidor ESR"*).
4. La petición queda en estado `pending_approval` y aparece instantáneamente en el panel del Responsable de Repuestos.

---

<!-- ==================== PÁGINA 15: CAPÍTULO 7 (CONTINUACIÓN) ==================== -->
<div style="page-break-after: always;"></div>

### 7.3 Flujo de Aprobación, Deducción Inmediata y Rechazo Motivado
El Responsable de Repuestos examina la solicitud en su bandeja de entrada:
- **Opción A: Aprobación con Stock Disponible.** Si hay existencias físicas en el almacén, pulsa **«Aprobar petición»**. En esa misma transacción atómica en Convex:
  1. El estado de la petición pasa a `approved`.
  2. Las existencias del repuesto se descuentan contablemente del stock disponible para evitar que otro técnico las asigne a otra intervención.
  3. Se genera la orden de recogida física en el almacén.
- **Opción B: Rechazo Motivado.** Si la justificación es insuficiente o se dispone de un procedimiento alternativo homologado, pulsa **«Rechazar petición»**, introduciendo obligatoriamente un texto justificativo que el técnico visualizará de inmediato en su terminal.

### 7.4 Consolidación de Órdenes de Compra por Proveedor
Cuando se requieren piezas que no se encuentran en stock ($S_a = 0$):
- El sistema agrupa automáticamente todas las peticiones en estado `ordered` por distribuidor oficial o proveedor de componentes (ej. Farnell, RS Components, Mouser, Sony Broadcast Direct).
- El Responsable de Repuestos genera una **Orden de Compra (`PurchaseOrder`)** consolidada con numeración oficial correlativa (ej. `OC-2026-0019`).
- La orden consolida precios unitarios, costes de transporte, impuestos aplicables y fecha estimada de entrega comunicada por el proveedor.

### 7.5 Recepción de Albaranes, Cotejo de Calidad y Reingreso a Almacén
Cuando la agencia de transporte entrega la paquetería en el taller central:
1. El Responsable de Repuestos abre la orden de compra correspondiente en el módulo **«Compras»**.
2. Pulsa el botón **«Recepcionar albarán»** e introduce el número oficial de albarán del transportista o proveedor.
3. Se cotejan las referencias línea a línea: si el proveedor envía una entrega parcial, el sistema permite recepcionar únicamente las unidades llegadas, manteniendo la orden en estado pendiente para el resto.
4. **Incremento Atómico de Stock:** Al validar la recepción, las existencias del catálogo se incrementan instantáneamente en la base de datos y las peticiones asociadas cambian a `received`, notificando al técnico solicitante de que sus piezas ya están disponibles en el almacén.

### 7.6 Entrega Física de Material y Cierre Contable de la Petición
El técnico acude al almacén central a retirar el material. El responsable entrega las piezas y pulsa **«Entregar material»**. La petición alcanza el estado definitivo `delivered`, cerrando el expediente contable y consolidando el coste de la pieza dentro del coste total de la incidencia asociada.

---

<!-- ==================== PÁGINA 16: CAPÍTULO 8 Y 9 ==================== -->
<div style="page-break-after: always;"></div>

## Capítulo 8: Centro de Documentación Técnica, Manuales y Esquemáticos

### 8.1 Repositorio Centralizado de Manuales de Servicio y Esquemáticos
Los equipos broadcast de gama profesional cuentan con manuales de servicio de cientos de páginas que contienen planos de circuitos impresos multicapa (*schematics*), diagramas en bloque de transporte de señal y secuencias de ajuste de microcontroladores.
- Pulso Taller incorpora una biblioteca documental centralizada (`manuals`).
- Soporta ficheros en formato PDF de alta resolución, hojas de características técnicas (*datasheets*) y boletines de modificación de fábrica (*Service Bulletins*).
- Los documentos se almacenan de forma segura en el almacenamiento de objetos de la plataforma, accesibles con un solo clic desde cualquier puesto del taller.

### 8.2 Vinculación Cruzada entre Manuales y Modelos de Equipos
Cada manual de servicio se vincula a uno o más modelos de equipos de la base de datos:
- Cuando un técnico está diagnosticando una incidencia en la ficha de un mezclador o cámara, la interfaz le ofrece una pestaña lateral de **«Documentación Técnica Directa»**.
- El técnico puede abrir el esquema del circuito sin tener que abandonar la pantalla de la incidencia ni buscar manualmente en servidores de archivos externos.

### 8.3 Base de Conocimiento y Notas Técnicas de Taller
Muchos fallos endémicos de la electrónica industrial responden a patrones repetitivos (por ejemplo, soldaduras agrietadas por vibración en conectores BNC o secado de pasta térmica en chips DSP).
- Los técnicos pueden redactar **Notas Técnicas de Taller** independientes vinculadas a familias de equipos.
- Estas notas actúan como una memoria corporativa colectiva que acelera el aprendizaje de los nuevos técnicos incorporados al centro.

---

## Capítulo 9: Comunicaciones Internas, Mensajería y Búsqueda Global

### 9.1 Mensajería Directa y Grupal del Taller
Para erradicar la dispersión de información provocada por aplicaciones de mensajería comercial externa, Pulso Taller integra un canal nativo de mensajería:
- Mensajes directos entre técnicos, coordinadores y responsables de compras.
- Los mensajes pueden vincular directamente expedientes de incidencias o equipos con tarjetas interactivas embebidas en el chat.

### 9.2 Motor de Notificaciones Operativas en Tiempo Real
El sistema dispone de un centro de alertas con avisos visuales y acústicos configurables para:
- Asignación de una nueva incidencia al técnico.
- Aprobación o llegada a almacén de un repuesto solicitado.
- Alertas de proximidad de vencimiento de mantenimiento preventivo.
- Avisos de caída de existencias por debajo del stock mínimo.

### 9.3 Búsqueda Global Omnicanal Asistida
En la cabecera superior de la aplicación reside la barra de **Búsqueda Global Asistida (`Ctrl + K`)**:
- Indexa en tiempo real incidencias por código o texto, equipos por número de serie o modelo, repuestos por número de parte (P/N) y manuales técnicos.
- Permite la navegación rápida por teclado sin levantar las manos del terminal.

---

<!-- ==================== PÁGINA 17: CAPÍTULO 10 ==================== -->
<div style="page-break-after: always;"></div>

## Capítulo 10: Administración Avanzada, Auditoría y Calidad del Taller

### 10.1 Membrete Corporativo, Razón Social y Personalización Gráfica
En el módulo **«Ajustes del Taller»**, los administradores configuran los datos de cabecera oficiales que se imprimirán en todos los Partes de Trabajo en PDF y órdenes de compra oficiales:
- Razón Social de la empresa o corporación audiovisual.
- Número de Identificación Fiscal (NIF / CIF) y domicilio social.
- Logotipo oficial de alta resolución (formato vectorial SVG o PNG transparente).
- Texto legal de certificación y cláusula de cumplimiento de protección de datos (RGPD).

### 10.2 Monitor de "Trabajo sin Traza" y Prevención de Desviaciones
Un indicador crítico de la calidad del taller es evitar intervenciones indocumentadas. Pulso Taller incorpora un panel de control específico para la jefatura técnica:
- Detecta equipos que han cambiado de ubicación o han recibido repuestos sin que conste una incidencia registrada con Cuaderno Técnico cumplimentado.
- Identifica incidencias que permanecen abiertas en estado `in_progress` durante más de 72 horas sin que se hayan añadido notas de evolución.

### 10.3 Motor de Informes Semanales Automatizados
El sistema genera resúmenes periódicos consolidados que se envían por correo electrónico o se descargan en PDF para la dirección técnica:
- Ratio de incidencias resueltas frente a nuevas entradas.
- Tiempos medios de resolución clasificados por plató o control.
- Listado de equipos más problemáticos (*Top 5 Equipos con Menor Fiabilidad*).
- Gasto económico total en repuestos imputado por centros de coste.

### 10.4 Mantenimiento del Almacenamiento, Detección de Huérfanos y Papelera
A lo largo de los meses, la subida de fotografías de averías y manuales técnicos puede consumir un volumen considerable de almacenamiento:
- La herramienta de mantenimiento de almacenamiento localiza archivos huérfanos (imágenes subidas a notas técnicas que fueron posteriormente borradas sin guardar).
- El sistema de papelera de reciclaje retiene los elementos eliminados durante 30 días antes de su purga definitiva, permitiendo la recuperación ante borrados accidentales de los usuarios.

---

<!-- ==================== PÁGINA 18: CAPÍTULO 11 ==================== -->
<div style="page-break-after: always;"></div>

## Capítulo 11: Infraestructura, Continuidad Operativa y Despliegue en Synology NAS

### 11.1 Arquitectura del Servidor Local y Despliegue en Docker Container
En la mayoría de centros emisores de televisión, por estrictos requerimientos de seguridad perimetral y aislamiento frente a Internet de las redes broadcast (redes de vídeo SMPTE ST 2110 y control Dante), el sistema debe ejecutarse en servidores locales on-premise.
- **Despliegue Recomendado:** Servidor de almacenamiento NAS Synology empresarial (serie DiskStation o RackStation) con Container Manager (Docker):
  - Contenedor para el runtime del backend Convex y base de datos relacional.
  - Contenedor para el servidor web NGINX que sirve la aplicación compilada de frontend Vite/React con compresión Brotli/Gzip.
- **Consumo de Recursos Optimizado:** El stack completo opera con menos de 1.5 GB de memoria RAM y una utilización de CPU inferior al 5% en reposo, garantizando una respuesta instantánea sin sobrecargar el hardware del centro.

### 11.2 Estrategia de Copias de Seguridad 3-2-1 y Snapshots
La pérdida de la base de datos de mantenimiento significaría perder años de historial técnico y control de existencias. Se establece obligatoriamente la estrategia **3-2-1**:
1. **3 Copias de los Datos:** La copia en producción activa, un snapshot local diario y una copia externa deslocalizada.
2. **2 Soportes Distintos:** Volúmenes de almacenamiento Btrfs con tolerancia a fallos RAID 6 en el NAS y cinta LTO o nube fría cifrada.
3. **1 Copia Fuera de la Instalación:** Sincronización nocturna cifrada hacia el segundo centro de producción o sede secundaria de la cadena.
- **Snapshot Replication Automático:** Se configuran instantáneas Btrfs cada 4 horas en el NAS principal. En caso de corrupción lógica o borrado accidental, el estado completo de la base de datos se restablece en menos de 3 minutos.

### 11.3 Plan de Recuperación ante Desastres (Disaster Recovery RTO/RPO)
Los parámetros oficiales de recuperación operativa del sistema Pulso Taller son:
- **RTO (Recovery Time Objective):** Menor a 60 minutos para restaurar el servicio completo en caso de avería total de hardware en el servidor NAS principal.
- **RPO (Recovery Point Objective):** Menor a 15 minutos de pérdida máxima tolerable de transacciones de datos ante un fallo catastrófico imprevisto.

---

<!-- ==================== PÁGINA 19: CAPÍTULO 12 ==================== -->
<div style="page-break-after: always;"></div>

## Capítulo 12: Manual Detallado de Pantallas, Formularios y Campos del Sistema

### 1. Formulario de Notificación Rápida de Incidencias (`/reportar`)
- **Campo `Título de la Incidencia` (Obligatorio, 5-120 caracteres):** Síntoma visible y preciso. No usar vaguedades como "Avería". Ejemplo: *"Pérdida intermitente de señal de sincronismo Genlock en servidor EVS XT-VIA de Control Central"*.
- **Desplegable `Ubicación` (Obligatorio):** Espacio físico donde se ubica el problema (ej. *Plató 1*, *MCR*, *Control de Sonido*, *Unidad Móvil 1*).
- **Selector de `Prioridad` (Obligatorio):** Botones con código de color: *Baja* (Azul), *Normal* (Gris), *Alta* (Naranja) y *Urgente* (Rojo).
- **Buscador / Selector de `Equipo` (Opcional):** Permite filtrar por modelo o número de serie. Si no se localiza, se activa el botón adyacente **«Dar de alta equipo ahora»**.
- **Campo `Descripción Detallada` (Texto Enriquecido):** Circunstancias en las que se manifiesta el fallo, mensajes mostrados en pantalla o pruebas preliminares realizadas.
- **Zona de Carga de `Archivos Adjuntos`:** Acepta fotografías o vídeos cortos en formatos JPG, PNG, WebP o documentos PDF de hasta 20 MB por archivo.

### 2. Panel Lateral de Navegación del Taller (`DashboardSidebar`)
- **Redimensionamiento Ergonómico Persistente:** Dispone de un tirador táctil (*drag handle*) que permite ajustar la anchura del panel izquierdo entre 220px y 520px de ancho para visualizar cómodamente títulos largos de expedientes. La anchura seleccionada se guarda automáticamente en la memoria del navegador (`localStorage`) y en el perfil de usuario del backend.
- **Acceso Directo a la Bitácora de Cambios:** En la base del menú lateral figura la versión activa (ej. `v1.1.0`) con icono de historial. Al pulsar sobre ella se abre el diálogo de **Changelog** a pantalla ancha (60% de pantalla) con buscador y filtros por categorías.

### 3. Ficha de Detalle de Incidencia (`IncidentDetailSheet`)
- **Cabecera de Estado:** Código de referencia permanente (ej. `INC-0089`), indicador de estado en tiempo real y fecha de creación.
- **Barra de Acciones Rápidas:** Botones dinámicos según el estado de la incidencia (*Iniciar trabajo*, *Pedir repuesto*, *Resolver incidencia*, *Descargar Parte en PDF*).
- **Editor del Cuaderno Técnico:** Espacio de trabajo del técnico con formato enriquecido, guardado de versiones y botón de adjuntar capturas.

### 4. Diálogo de Ficha de Equipo (`EquipmentFormDialog`)
- **Campo `Código de Inventario`:** Generado automáticamente con prefijo normalizado (`EQ-XXX-0000`).
- **Selector `Modelo de Equipo`:** Vinculado al catálogo maestro de fabricantes.
- **Campo `Número de Serie (S/N)`:** Serial alfanumérico grabado en el chasis del equipo.
- **Campos de Mantenimiento Preventivo:** Selector de intervalo en días y selector de fecha para la primera intervención planificada.

---

<!-- ==================== PÁGINA 20: CAPÍTULO 13 ==================== -->
<div style="page-break-after: always;"></div>

## Capítulo 13: Matriz de Resolución de Problemas Técnicos (Troubleshooting)

Cuando se manifiesten anomalías en el funcionamiento de la plataforma, el personal de administración técnica aplicará la siguiente matriz de diagnóstico:

| Síntoma Observado | Causa Raíz Probable | Procedimiento de Resolución Técnica |
|---|---|---|
| La pantalla muestra *"Conexión perdida con el servidor de taller"* o el icono de estado parpadea en rojo. | Caída del proceso Convex en el servidor local o pérdida de enlace de red local en el centro. | 1. Verificar la conectividad de red con el comando `ping <IP_DEL_NAS>`.<br>2. Acceder al gestor Docker del NAS y comprobar que el contenedor `convex-backend` se encuentra en estado *Running*.<br>3. Reiniciar el servicio mediante `docker restart gestmant-convex`. |
| Un técnico no puede resolver una incidencia; el botón *"Resolver incidencia"* aparece deshabilitado. | Existen peticiones de repuesto asociadas a la incidencia que aún no han sido entregadas o canceladas. | 1. Abrir la pestaña **«Peticiones de repuesto»** dentro de la incidencia.<br>2. Verificar si hay peticiones en estado `draft`, `pending_approval` o `ordered`.<br>3. El Responsable de Repuestos debe entregar el material físicamente o el técnico debe cancelar las peticiones no utilizadas. |
| El navegador no guarda la anchura personalizada del panel lateral y vuelve a la anchura por defecto al recargar. | El navegador tiene bloqueado el almacenamiento local (`localStorage`) o la sesión de usuario no tiene sincronizada la mutación de perfil. | 1. Comprobar en las opciones de privacidad del navegador que no está activado el bloqueo estricto de almacenamiento local para la IP del taller.<br>2. Comprobar en el log de consola si la mutación `api.members.saveSidebarLayout` devuelve algún error de red. |
| Al intentar subir una fotografía del oscilograma al Cuaderno Técnico, el sistema muestra *"Error de carga de fichero"*. | El fichero supera el límite de 20 MB o el almacenamiento del servidor NAS ha alcanzado el 100% de ocupación. | 1. Verificar el espacio libre en el volumen de disco del NAS mediante el panel DSM de Synology.<br>2. Reducir la resolución de la fotografía o convertirla a formato JPG/WebP optimizado antes de insertarla en el editor. |
| El selector de repuestos no muestra la pieza deseada al crear una petición desde una incidencia. | El repuesto existe en el catálogo pero no tiene asignada compatibilidad con el modelo de equipo de la incidencia. | 1. Acceder al módulo **«Repuestos»** con rol de Responsable de Repuestos.<br>2. Editar la ficha del repuesto y añadir el modelo del equipo intervenido a la lista de compatibilidades homologadas. |

---

<!-- ==================== PÁGINA 21: CAPÍTULO 14 ==================== -->
<div style="page-break-after: always;"></div>

## Capítulo 14: Procedimientos Operativos Estandarizados (SOPs) Broadcast

### SOP-01: Actuación de Emergencia ante Caída de Señal Crítica en Directo
- **Objetivo:** Restablecer la continuidad de la señal de emisión en menos de 60 segundos y abrir expediente formal de trazabilidad.
- **Fase 1: Conmutación de Salvaguarda (Operador de Control).**
  1. Conmutar de inmediato la salida de programa hacia la vía de emergencia o servidor de respaldo redundante mediante el panel de conmutación de emergencia (Bypass Switch).
  2. Notificar por intercomunicador interno al técnico de guardia de plató.
- **Fase 2: Notificación Rápida en Pulso Taller.**
  1. Abrir `/reportar` desde la tablet del control y registrar incidencia con prioridad **«Urgente»** indicando el equipo caído.
- **Fase 3: Intervención Técnica (Técnico de Plató).**
  1. Acudir físicamente a la sala de racks y verificar si la anomalía es de alimentación eléctrica (LEDs apagados) o de sincronismo/fibra.
  2. Sustituir en caliente el módulo transceptor SFP o la fuente de alimentación redundante.
  3. No intervenir a nivel de soldadura en el rack de emisión: retirar el chasis afectado hacia el banco del taller central.
- **Fase 4: Documentación en Cuaderno Técnico.**
  1. Detallar las maniobras realizadas y registrar los repuestos consumidos antes de dar por cerrado el turno.

### SOP-02: Calibración y Mantenimiento Trimestral de Cadenas de Cámara HD/4K
- **Periodicidad:** Cada 90 días naturales.
- **Instrumentación Requerida:** Osciloscopio digital Tektronix / Leader, vectorscopio SDI, carta de escala de grises gamma calibrada, fuente de luz de laboratorio 3200K / 5600K con CRI > 98, bastoncillos ópticos y microscopio de fibra SMPTE.
- **Fase 1: Inspección Óptica y Mecánica.**
  1. Desmontar la óptica zoom y comprobar la pureza del filtro óptico dicroico del bloque de sensores CMOS mediante lupa con iluminación LED.
  2. Limpiar con bastoncillo seco especial los conectores de fibra híbrida SMPTE 304M (LEMO / Neutrik OpticalCON) tanto en la cabeza de cámara como en la CCU de control.
  3. Desmontar la rejilla de ventilación y limpiar con aire ionizado seco el polvo acumulado en el disipador del procesador de vídeo.
- **Fase 2: Ajustes Eléctricos y Colorimetría.**
  1. Conectar la cámara a la CCU con tirada de cable SMPTE de prueba de 100 metros.
  2. Medir en la CCU la tensión de alimentación continua bajo carga (+180V a +240V DC).
  3. Ejecutar el ciclo de calibración de negros (*Auto Black Balance - ABB*).
  4. Enfocar la carta de grises iluminada y ajustar el balance de blancos (*Auto White Balance - AWB*) verificando en el vectorscopio que los vectores de color convergen exactamente en el punto de crominancia cero central.
- **Fase 3: Registro en Pulso Taller.**
  1. Acceder a la ficha del equipo en el módulo **«Equipos»**, pestaña **«Mantenimiento Preventivo»**.
  2. Marcar las casillas del checklist de comprobación y adjuntar captura del vectorscopio antes de certificar la revisión.

---

<!-- ==================== PÁGINA 22: CAPÍTULO 14 (CONTINUACIÓN) ==================== -->
<div style="page-break-after: always;"></div>

### SOP-03: Diagnóstico y Reparación de Fuentes de Alimentación Conmutadas (SMPS)
- **Riesgo Laboral Severo:** Peligro de descarga eléctrica por alta tensión en condensadores de filtro de primario (+385 VDC). Descargar siempre los condensadores con resistencia de potencia antes de intervenir.
- **Fase 1: Inspección Visual y Olfativa en Banco de Aislamiento.**
  1. Desconectar la fuente de cualquier toma eléctrica y conectarla a través de un transformador de aislamiento de relación 1:1.
  2. Descargar los condensadores de primario mediante una resistencia de 1 kΩ / 10W (nunca cortocircuitar con destornillador).
  3. Inspeccionar visualmente si existen condensadores electrolíticos abombados en la parte superior de aluminio o con fugas de electrólito parduzco en la base del circuito impreso.
  4. Comprobar fusibles cerámicos y varistores de protección contra transitorios (MOV).
- **Fase 2: Mediciones con Medidor de ESR in-circuit.**
  1. Medir la Resistencia Serie Equivalente (ESR) de cada condensador electrolítico tanto de la etapa primaria como de los raíles secundarios (+12V, +5V, +3.3V).
  2. Todo condensador que presente un valor superior a 0.5 Ω en secundario o 1.2 Ω en primario debe ser desoldado y sustituido de inmediato, independientemente de que su valor de capacidad aparente en microfaradios parezca correcto.
- **Fase 3: Sustitución de Componentes y Pruebas con Carga Fantasma.**
  1. Emplear únicamente condensadores de repuesto de bajo ESR (*Low ESR*) y rango de temperatura garantizado de 105 °C.
  2. Aplicar carga activa simulada mediante banco de resistencias de potencia.
  3. Comprobar con osciloscopio que el rizado de continua (*ripple pico a pico*) en la línea de +12V no supera los 50 mVpp bajo carga máxima nominal.
- **Fase 4: Imputación de Repuestos y Emisión de Parte.**
  1. Crear la petición de repuesto en Pulso Taller para los condensadores y transistores sustituidos.
  2. Incorporar el oscilograma del rizado final al Cuaderno Técnico de la incidencia antes de proceder al cierre.

### SOP-04: Recepción, Control ESD y Almacenamiento de Semiconductores y Módulos SFP+
- **Fase 1: Recepción de Mercancía.**
  1. Examinar el estado del embalaje exterior. Consignar reservas formales en el albarán del transportista si la caja manifiesta aplastamientos o perforaciones.
  2. Cotejar el albarán con la Orden de Compra registrada en Pulso Taller.
- **Fase 2: Zona Protegida contra Descargas Electrostáticas (EPA).**
  1. Trasladar los componentes sensibles (ICs, módulos ópticos SFP+, tarjetas PCIe) a la mesa de trabajo antiestática.
  2. El técnico debe colocarse la muñequera conductora conectada a la toma de tierra del laboratorio antes de abrir las bolsas de protección blindada (*ESD Shielding Bags*).
- **Fase 3: Verificación del P/N Carácter por Carácter.**
  1. Con lupa de aumentos, verificar que la serigrafía del componente coincide exactamente con el P/N homologado pedido (evitar sustituciones de sufijos de velocidad o rango de temperatura por parte de los distribuidores).
- **Fase 4: Registro y Ubicación Física.**
  1. Pulsar **«Recepcionar albarán»** en Pulso Taller.
  2. Ubicar las piezas en su cajón oficial debidamente etiquetado.

---

<!-- ==================== PÁGINA 23: CAPÍTULO 14 (CONTINUACIÓN) ==================== -->
<div style="page-break-after: always;"></div>

### SOP-05: Protocolo de Relevo y Entrega de Turno Técnico
- **Periodicidad:** Obligatorio en los 15 minutos previos a la finalización de cada turno (Mañana, Tarde, Noche).
- **Participantes:** Técnico saliente, técnico entrante y coordinador de mantenimiento.
- **Procedimiento Operativo:**
  1. Abrir la cola de **«Incidencias»** en Pulso Taller y filtrar por incidencias en estado `assigned_onsite`, `assigned_workshop` e `in_progress`.
  2. El técnico saliente expone el estado de las intervenciones a medias, pruebas ejecutadas en banco y piezas solicitadas pendientes de llegada.
  3. Se verifica que ninguna intervención del turno saliente ha quedado sin sus correspondientes notas asentadas en el Cuaderno Técnico (erradicación de trabajo sin traza).
  4. Los técnicos entrantes aceptan la reasignación formal de los casos abiertos para asumir la responsabilidad de su seguimiento durante el nuevo turno.

### SOP-06: Mantenimiento Preventivo de Servidores de Playout y Matrices SDI/IP
- **Periodicidad:** Semestral (cada 180 días).
- **Fase 1: Salud de Almacenamiento y Discos RAID.**
  1. Comprobar el estado de salud SMART de los discos SSD/SAS de los servidores de playout en el controlador hardware RAID.
  2. Verificar que no existen bloques reasignados ni avisos predictivos de fallo de cabezal.
- **Fase 2: Refrigeración y Limpieza de Chasis.**
  1. Sin desconectar el servidor redundante, conmutar la emisión al canal espejo.
  2. Extraer los filtros de polvo frontales del chasis rack y lavarlos con agua a presión; secar completamente con aire comprimido antes de reinstalar.
  3. Verificar el régimen de revoluciones por minuto (RPM) de todos los ventiladores modulares internos redundantes.
- **Fase 3: Registro en Pulso Taller.**
  1. Asentar la revisión en la ficha del servidor de playout en Pulso Taller y programar la siguiente inspección a 180 días.

### SOP-07: Verificación y Limpieza de Conectores Ópticos LEMO / Neutrik SMPTE
- **Fase 1: Inspección Microscópica.**
  1. Conectar la sonda del microscopio digital de fibra óptica (con aumentos de 400x) al conector híbrido de la cámara.
  2. Visualizar la superficie del núcleo de cuarzo monomodo (9 micrómetros de diámetro).
  3. Si se observan restos de aceite, polvo ambiental o rayas mecánicas, proceder a la limpieza.
- **Fase 2: Limpieza en Seco y Húmedo.**
  1. Aplicar limpiador de fibra tipo casete (*IBC Brand Cleaner*) mediante avance de cinta seca sin pelusa.
  2. Si la suciedad persiste, aplicar una gota microscópica de disolvente óptico de evaporación ultrarrápida y repetir el pase de cinta.
- **Fase 3: Medición de Atenuación Óptica.**
  1. Medir con fuente láser calibrada de 1310 nm y medidor de potencia óptica. La atenuación total de inserción no debe superar 0.5 dB por conector.

---

<!-- ==================== PÁGINA 24: CAPÍTULO 15 ==================== -->
<div style="page-break-after: always;"></div>

## Capítulo 15: Glosario Técnico de Acrónimos Broadcast, Electrónica y Redes

| Acrónimo | Término Completo en Inglés | Definición Técnica en el Contexto de Pulso Taller |
|---|---|---|
| **BNC** | *Bayonet Neill-Concelman* | Conector coaxial estándar de 75 Ohmios con cierre de bayoneta utilizado para el transporte de señales de vídeo SDI y sincronismo analógico. |
| **CCU** | *Camera Control Unit* | Unidad de control de cámara instalada en rack que suministra alimentación remota, control de diafragma/colorimetría y retorno de vídeo a la cabeza de plató. |
| **Dante** | *Digital Audio Network Through Ethernet* | Tecnología propietaria de transporte de audio digital multicanal sin compresión sobre redes IP estándar Gigabit Ethernet. |
| **DSNG** | *Digital Satellite News Gathering* | Unidad móvil de transmisión satelital o celular utilizada para conexiones informativas en directo desde exteriores. |
| **ESR** | *Equivalent Series Resistance* | Resistencia Serie Equivalente de un condensador electrolítico. Parámetro crítico que mide el envejecimiento interno del componente antes de que falle catastróficamente. |
| **EVS** | *EVS Broadcast Equipment* | Servidores de vídeo digital en bucle utilizados habitualmente en realizaciones deportivas para repeticiones a cámara lenta y playout de directos. |
| **Genlock** | *Generator Locking* | Señal central de referencia de sincronismo (Black Burst o Tri-level Sync) que garantiza que todas las fuentes de vídeo del centro emisor cambien de cuadro en el mismo microsegundo. |
| **MCR** | *Master Control Room* | Control Central de Emisiones. Sala técnica neurálgica donde confluyen las señales de todos los platós, unidades móviles y enlaces antes de su emisión final hacia la red de transmisión TDT/Streaming. |
| **MOV** | *Metal Oxide Varistor* | Varistor de óxido metálico. Componente pasivo montado en las fuentes conmutadas para absorber picos y sobretensiones transitorias de la red eléctrica. |
| **MTBF** | *Mean Time Between Failures* | Tiempo Medio Entre Fallos. Métrica estadística calculada para estimar la fiabilidad esperada de un equipo de emisión. |
| **MTTR** | *Mean Time To Repair* | Tiempo Medio de Reparación. Tiempo promedio transcurrido desde que una incidencia se reporta hasta que el técnico completa y verifica su solución funcional. |
| **PCR** | *Production Control Room* | Control de Realización de Plató. Espacio donde el equipo de dirección, realización, sonido y vídeo mezclan los contenidos de un programa en directo. |
| **P/N** | *Part Number* | Referencia o número de parte oficial asignado por el fabricante a un repuesto o componente electrónico para su identificación unívoca. |
| **PTP** | *Precision Time Protocol (IEEE 1588v2)* | Protocolo de sincronización horaria de precisión nanométrica empleado en redes de audio y vídeo sobre IP (SMPTE ST 2110). |
| **RBAC** | *Role-Based Access Control* | Control de acceso basado en roles y capacidades individuales que rige las autorizaciones de los usuarios en Pulso Taller. |
| **RPO** | *Recovery Point Objective* | Punto Objetivo de Recuperación. Pérdida máxima de datos admisible ante un incidente grave, fijada en menos de 15 minutos en el taller. |
| **RTO** | *Recovery Time Objective* | Tiempo Objetivo de Recuperación. Periodo máximo admisible para restablecer el servicio del sistema de taller, fijado en menos de 60 minutos. |
| **SDI** | *Serial Digital Interface* | Familia de estándares digitales para transmisión de vídeo profesional en serie: SD-SDI (270 Mbps), HD-SDI (1.485 Gbps), 3G-SDI (2.97 Gbps) y 12G-SDI (11.88 Gbps para 4K UHD). |
| **SFP+** | *Small Form-factor Pluggable Plus* | Módulo transceptor compacto e intercambiable en caliente para enlaces de fibra óptica de hasta 10 Gbps. |
| **SMPS** | *Switched-Mode Power Supply* | Fuente de alimentación conmutada de alto rendimiento presente en la práctica totalidad de los equipos audiovisuales modernos. |
| **SMPTE** | *Society of Motion Picture and Television Engineers* | Organismo internacional que estandariza las normas técnicas mundiales del sector cinematográfico y televisivo (ej. SMPTE ST 2110, SMPTE ST 2022). |
| **SOP** | *Standard Operating Procedure* | Procedimiento Operativo Estandarizado. Instrucción de trabajo oficial de cumplimiento obligatorio para el personal técnico. |

---

<!-- ==================== PÁGINA 25: CONTRAPORTADA Y CONCLUSIÓN ==================== -->
<div style="page-break-after: always;"></div>

## Certificación y Cierre Documental

Este **Manual General Integral de Operación, Mantenimiento y Administración de Pulso Taller (`GestMant_TS`)** constituye la norma técnica maestra de obligado cumplimiento para todo el personal técnico, operativo y administrativo del centro.

Cualquier propuesta de modificación, ampliación de Procedimientos Operativos Estandarizados (SOP) o incorporación de nuevas capacidades deberá ser tramitada a través del Comité Técnico de Gobernanza y registrada formalmente en el archivo `CHANGELOG.md` del repositorio de código.

---

```
                                  APROBACIÓN TÉCNICA OFICIAL
             
         Jefatura de Operaciones Broadcast           Dirección de Ingeniería y Mantenimiento
         
         ___________________________________         ___________________________________
         Fdo. Responsable de Operaciones             Fdo. Ingeniero Jefe de Mantenimiento
```

*Pulso Taller (`GestMant_TS`) · Versión de Producción 1.1.0 · Octubre de 2026*  
*Fin del Tratado Técnico Oficial.*
