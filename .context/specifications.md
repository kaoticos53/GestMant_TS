# Especificaciones de Dominio y Contratos de API (`.context/specifications.md`)

## 1. Vocabulario Ubicuo del Dominio (`GLOSARIO.md`)

Para mantener la coherencia conceptual del negocio, se aplican estrictamente estas definiciones:

| Término Canónico | Definición de Negocio | Términos Prohibidos (Sinónimos Incorrectos) |
|---|---|---|
| **Incidencia** | Suceso que afecta al funcionamiento normal de un equipo que requiere intervención técnica. | *Ticket*, *avería*, *fallo*, *problema* |
| **Equipo** | Máquina o instalación individual inventariada con número de serie y mantenimientos asociados. | *Máquina*, *aparato*, *dispositivo* |
| **Repuesto** | Pieza o componente fungible utilizado para reparar o mantener un equipo. | *Material*, *consumible*, *pieza suelta* |
| **Petición de repuesto** | Solicitud formal de uno o varios repuestos para una incidencia o stock. | *Pedido interno*, *solicitud de material* |
| **Orden de compra** | Documento mercantil enviado a un proveedor para la adquisición de repuestos. | *Pedido de compra*, *PO*, *albarán* |
| **Parte de trabajo** | Registro técnico de tiempos, acciones realizadas y piezas sustituidas en una incidencia. | *Informe de servicio*, *albarán de trabajo* |
| **Técnico** | Usuario cualificado que ejecuta diagnósticos, reparaciones y mantenimientos. | *Operario*, *mecánico*, *obrero* |

---

## 2. Máquinas de Estado del Sistema (`MAQUINAS.md` & `src/lib/`)

### A. Flujo de Incidencias (`src/lib/incidentFlow.ts`)
```
                     +---------------------------------------+
                     |                REPORTED               |
                     +-------------------+-------------------+
                                         |
                       +-----------------+-----------------+
                       v                                   v
             [ASSIGNED_ONSITE]                    [ASSIGNED_WORKSHOP]
             (Asignada en planta)                 (Asignada en taller)
                       |                                   |
                       +-----------------+-----------------+
                                         |
                                         v
                                  [IN_PROGRESS]
                                  (En reparación)
                                         |
                       +-----------------+-----------------+
                       v                                   v
                  [RESOLVED]                          [UNRESOLVED]
                  (Resuelta)                        (No reparable)
                       |                                   |
                       +-----------------+-----------------+
                                         |
                                         v
                                     [ARCHIVED]
```
- **Regla:** Ninguna incidencia puede pasar a `resolved` o `archived` sin tener registrado al menos un parte de trabajo con técnico asignado.

---

### B. Flujo de Peticiones de Repuesto (`src/lib/requestFlow.ts`)
```
  [DRAFT] ──> [PENDING] ──> [APPROVED] ──> [ORDERED] ──> [RECEIVED] ──> [ISSUED] ──> [ARCHIVED]
                 │              │
                 └──> [REJECTED]┘
```
1. `DRAFT`: Borrador creado por el técnico.
2. `PENDING`: Enviada a supervisión/almacén.
3. `APPROVED`: Autorizada para compra o dispensación.
4. `REJECTED`: Rechazada con motivo justificado.
5. `ORDERED`: Vinculada a una orden de compra enviada al proveedor.
6. `RECEIVED`: Material llegado a las instalaciones y comprobado.
7. `ISSUED`: Repuesto entregado físicamente al técnico o montado en el equipo.
8. `ARCHIVED`: Flujo cerrado y registrado en histórico.

---

### C. Flujo de Órdenes de Compra (`src/lib/purchaseFlow.ts`)
```
  [PENDING] (Creada) ──> [ORDERED] (Enviada a proveedor) ──> [RECEIVED] (Recepción completa)
```

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
