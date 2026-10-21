import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// Roles del taller: administrador, responsable de repuestos y técnico.
export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  TECHNICIAN: "technician",
  GUEST: "guest",
} as const;

/** Clave del rol de un usuario: una clave del sistema (`ROLES`) o una
 * personalizada creada por el administrador (tabla `roles`). La existencia de
 * la clave se valida en el backend de `members`/`permissions`. */
export const roleValidator = v.string();

// --- Gestión de repuestos del taller (v1) ---

export const PRIORITIES = {
  URGENT: "urgent",
  NORMAL: "normal",
  LOW: "low",
} as const;

export const priorityValidator = v.union(
  v.literal(PRIORITIES.URGENT),
  v.literal(PRIORITIES.NORMAL),
  v.literal(PRIORITIES.LOW),
);
export type Priority = Infer<typeof priorityValidator>;

export const REQUEST_STATUSES = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  ISSUED: "issued",
  ON_HOLD: "onHold",
  RETURNED: "returned",
  CANCELLED: "cancelled",
  PENDING_SUPPLIER_QUOTE: "pendingSupplierQuote",
  // Material recibido: lo que faltaba se pidió al proveedor y ya ha entrado en
  // el almacén, así que la petición puede resolverse con lo que hay (mira
  // `purchasing`). Es el único estado que no decide el responsable: lo pone la
  // recepción de la orden de compra.
  MATERIAL_RECEIVED: "materialReceived",
} as const;

/** Estados del ciclo de vida de una incidencia (cada paso deja un registro). */
export const INCIDENT_STATUSES = {
  REPORTED: "reported", // notificada, pendiente de asignar
  ASSIGNED: "assigned", // asignada a un técnico
  WORKSHOP: "workshop", // derivada: entrada de incidencia a taller
  // La incidencia tiene una petición de repuestos abierta: no se trabaja en ella
  // hasta que llegue el material. Si el equipo está en taller lo dice su entrada
  // a taller abierta (`workshopAssigneeId`), no un estado aparte.
  WAITING_PARTS: "waitingParts",
  // Con el material ya en manos del técnico: es el estado desde el que se
  // termina el trabajo, en el sitio o en el taller.
  REPAIRING: "repairing",
  // Derivada a empresa o servicio técnico externo
  EXTERNAL_REPAIR: "externalRepair",
  RESOLVED: "resolved", // cerrada resuelta
  UNRESOLVED: "unresolved", // cerrada sin resolución
} as const;

export const incidentStatusValidator = v.union(
  v.literal(INCIDENT_STATUSES.REPORTED),
  v.literal(INCIDENT_STATUSES.ASSIGNED),
  v.literal(INCIDENT_STATUSES.WORKSHOP),
  v.literal(INCIDENT_STATUSES.WAITING_PARTS),
  v.literal(INCIDENT_STATUSES.REPAIRING),
  v.literal(INCIDENT_STATUSES.EXTERNAL_REPAIR),
  v.literal(INCIDENT_STATUSES.RESOLVED),
  v.literal(INCIDENT_STATUSES.UNRESOLVED),
);
export type IncidentStatus = Infer<typeof incidentStatusValidator>;

/**
 * Cambios que deja anotados el rastro de auditoría de los documentos de una
 * incidencia: alta, edición (nombre o nota), reemplazo del archivo y retirada.
 * Es un registro aparte del expediente a propósito: un adjunto retirado ya no
 * está en la incidencia, pero quién lo quitó y cuándo sigue estando —y de un
 * archivo reemplazado tampoco queda otra cosa que su movimiento—.
 */
export const DOCUMENT_ACTIONS = {
  ATTACHED: "attached",
  EDITED: "edited",
  REPLACED: "replaced",
  REMOVED: "removed",
} as const;

export const documentActionValidator = v.union(
  v.literal(DOCUMENT_ACTIONS.ATTACHED),
  v.literal(DOCUMENT_ACTIONS.EDITED),
  v.literal(DOCUMENT_ACTIONS.REPLACED),
  v.literal(DOCUMENT_ACTIONS.REMOVED),
);
export type DocumentAction = Infer<typeof documentActionValidator>;

export const requestStatusValidator = v.union(
  v.literal(REQUEST_STATUSES.PENDING),
  v.literal(REQUEST_STATUSES.APPROVED),
  v.literal(REQUEST_STATUSES.REJECTED),
  v.literal(REQUEST_STATUSES.ISSUED),
  v.literal(REQUEST_STATUSES.ON_HOLD),
  v.literal(REQUEST_STATUSES.RETURNED),
  v.literal(REQUEST_STATUSES.CANCELLED),
  v.literal(REQUEST_STATUSES.PENDING_SUPPLIER_QUOTE),
  v.literal(REQUEST_STATUSES.MATERIAL_RECEIVED),
);
export type RequestStatus = Infer<typeof requestStatusValidator>;

/** Una línea de repuesto dentro de una petición. El código y nombre se copian
 * al momento de crear la petición para que el histórico no cambie si el
 * catálogo se edita después. */
export const requestLineValidator = v.object({
  sparePartId: v.id("spareParts"),
  code: v.string(),
  name: v.string(),
  quantity: v.number(),
  // Lo entregado de esta línea: el material de una petición puede salir de una
  // en una, y lo que ya está en manos del técnico se apunta aquí, no en el
  // estado de la petición. Opcional porque las peticiones entregadas antes de
  // esto no lo tienen: su estado dice que salió todo y se leen enteras
  // (`lib/requestFlow`).
  deliveredQuantity: v.optional(v.number()),
  // Cuándo salió la última unidad de esta línea, para poder contar la entrega
  // parcial sin abrir el histórico de la petición.
  deliveredAt: v.optional(v.number()),
});
export type RequestLine = Infer<typeof requestLineValidator>;

/** Motivos estandarizados para decisiones o cambios de estado de una petición.
 * No son obligatorios en todas las vías, pero ayudan a que el "por qué" sea
 * explicable sin depender de notas libres. */
export const REJECTION_REASONS = {
  OUT_OF_SCOPE: "outOfScope",
  NO_BUDGET: "noBudget",
  DUPLICATED: "duplicated",
  INCOMPATIBLE_MODEL: "incompatibleModel",
  PART_OBSOLETE: "partObsolete",
  STOCK_PENDING: "stockPending",
  INCIDENT_CLOSED: "incidentClosed",
  REQUEST_CANCELLED: "requestCancelled",
  MATERIAL_RETURNED: "materialReturned",
  // La entrega también deja constancia: quién sacó el material y qué salió en
  // esa tanda. Completa cuando salió lo último que faltaba, parcial cuando la
  // petición sigue esperando al resto.
  MATERIAL_DELIVERED: "materialDelivered",
  MATERIAL_PARTIALLY_DELIVERED: "materialPartiallyDelivered",
  PENDING_EXTERNAL_QUOTE: "pendingExternalQuote",
  OTHER: "other",
} as const; /** Seguimiento de decisión: por qué se rechazó, se suspendió o devolvió.
 * El campo se añade en `decidedAt` o en el primer paso que lo justifica.
 * Queda vacío si la transición tiene otra razón implícita o se explica en `decisionNote`.
 */
export const requestDecisionValidator = v.object({
  // Qué pasó y por qué. Puede venir de la UI o de un flujo interno.
  reason: v.optional(v.string()),
  note: v.optional(v.string()),
});
export type RequestDecision = Infer<typeof requestDecisionValidator>;

/** Valores permitidos para `requestDecision.reason` cuando se quiere un motivo
 * estandarizado. Se usa en validaciones de mutación y en reportes, pero no es
 * obligatorio en el esquema: la columna se puede poblar con texto libre mientras
 * la aplicación estandariza sus motivos internos. */
// --- Compras: lo que el almacén no puede cubrir y hay que pedir fuera ---

/**
 * Ciclo de vida de una petición de compra: una línea de una petición de
 * repuesto que no había en el almacén (o era nueva), apartada por el responsable
 * de repuestos para comprarla. Mientras está `pending` espera agrupada por
 * proveedor; cuando el proveedor la recibe no se toca hasta que llega el
 * material.
 *
 *   pending    sin tratar: todavía no está en ninguna orden de compra
 *   ordered    dentro de una orden, a la espera del proveedor
 *   received   el material ha entrado en el almacén
 *   cancelled  retirada por el responsable (ya no se compra)
 */
export const PURCHASE_REQUEST_STATUSES = {
  PENDING: "pending",
  ORDERED: "ordered",
  RECEIVED: "received",
  CANCELLED: "cancelled",
} as const;

export const purchaseRequestStatusValidator = v.union(
  v.literal(PURCHASE_REQUEST_STATUSES.PENDING),
  v.literal(PURCHASE_REQUEST_STATUSES.ORDERED),
  v.literal(PURCHASE_REQUEST_STATUSES.RECEIVED),
  v.literal(PURCHASE_REQUEST_STATUSES.CANCELLED),
);
export type PurchaseRequestStatus = Infer<
  typeof purchaseRequestStatusValidator
>;

/**
 * Estados de una orden de compra, que es lo que se manda al proveedor. La orden
 * se cierra sola con las recepciones: nunca se marca «completada» a mano.
 *
 *   pending    enviada al proveedor, sin ninguna entrada todavía
 *   partial    ha llegado parte del material
 *   completed  ha llegado todo
 *   cancelled  anulada: sus peticiones de compra vuelven a la cola
 */
export const PURCHASE_ORDER_STATUSES = {
  PENDING: "pending",
  PARTIAL: "partial",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export const purchaseOrderStatusValidator = v.union(
  v.literal(PURCHASE_ORDER_STATUSES.PENDING),
  v.literal(PURCHASE_ORDER_STATUSES.PARTIAL),
  v.literal(PURCHASE_ORDER_STATUSES.COMPLETED),
  v.literal(PURCHASE_ORDER_STATUSES.CANCELLED),
);
export type PurchaseOrderStatus = Infer<typeof purchaseOrderStatusValidator>;

/**
 * Una línea de una orden de compra. Lleva copiado lo que hacía falta saber
 * aunque el catálogo cambie después (el código, el nombre y la unidad) y, con
 * la petición de compra, **la petición de repuesto que la originó** —su número y
 * su fecha de solicitud—, que es lo que lleva el documento que se manda al
 * proveedor y lo que permite volver de una orden a la petición de la que salió.
 */
export const purchaseOrderLineValidator = v.object({
  purchaseRequestId: v.id("purchaseRequests"),
  requestId: v.id("partRequests"),
  requestReference: v.string(), // "PET-0007"
  requestDate: v.number(), // fecha de solicitud de esa petición
  sparePartId: v.id("spareParts"),
  code: v.string(),
  name: v.string(),
  unit: v.string(),
  quantity: v.number(),
  receivedQuantity: v.number(), // cuánto ha entrado ya de esta línea
  note: v.optional(v.string()), // nota del responsable sobre este artículo
});
export type PurchaseOrderLine = Infer<typeof purchaseOrderLineValidator>;

/** El albarán de entrega que acompaña a una recepción: sin él no hay entrada. */
export const deliveryNoteValidator = v.object({
  storageId: v.id("_storage"),
  name: v.string(),
  kind: v.union(v.literal("image"), v.literal("document")),
});
export type DeliveryNote = Infer<typeof deliveryNoteValidator>;

/** Lo que ha entrado de un repuesto en una recepción. */
export const receptionLineValidator = v.object({
  sparePartId: v.id("spareParts"),
  code: v.string(),
  name: v.string(),
  quantity: v.number(),
});
export type ReceptionLine = Infer<typeof receptionLineValidator>;

export const DECISION_REASON_VALUES = [
  REJECTION_REASONS.OUT_OF_SCOPE,
  REJECTION_REASONS.NO_BUDGET,
  REJECTION_REASONS.DUPLICATED,
  REJECTION_REASONS.INCOMPATIBLE_MODEL,
  REJECTION_REASONS.PART_OBSOLETE,
  REJECTION_REASONS.STOCK_PENDING,
  REJECTION_REASONS.INCIDENT_CLOSED,
  REJECTION_REASONS.REQUEST_CANCELLED,
  REJECTION_REASONS.MATERIAL_RETURNED,
  REJECTION_REASONS.MATERIAL_DELIVERED,
  REJECTION_REASONS.MATERIAL_PARTIALLY_DELIVERED,
  REJECTION_REASONS.PENDING_EXTERNAL_QUOTE,
  REJECTION_REASONS.OTHER,
] as const;
export type DecisionReason = (typeof DECISION_REASON_VALUES)[number];

const schema = defineSchema({
  // default auth tables using convex auth.
  ...authTables, // do not remove or modify

  // the users table is the default users table that is brought in by the authTables
  users: defineTable({
    name: v.optional(v.string()), // name of the user. do not remove
    image: v.optional(v.string()), // image of the user. do not remove
    email: v.optional(v.string()), // email of the user. do not remove
    emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
    isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

    role: v.optional(roleValidator), // role of the user. do not remove

    // Perfil del miembro del taller (gestión de usuarios)
    position: v.optional(v.string()), // puesto, ej. "Realización"
    location: v.optional(v.string()), // ubicación, ej. "Plató 2"
    phone: v.optional(v.string()), // teléfono de contacto
    active: v.optional(v.boolean()), // false = dado de baja (sin acceso)

    // Preferencias de la interfaz: así el menú lateral se abre igual en
    // cualquier navegador en el que entre la misma persona.
    sidebarWidth: v.optional(v.number()), // ancho del menú lateral en escritorio
    sidebarCollapsed: v.optional(v.boolean()), // true = menú plegado
    // Aviso de trabajo sin constancia dado por visto: qué incidencias se
    // avisaron y con qué margen. Vive en el perfil —y no en el navegador—
    // para que el aviso no vuelva a salir al entrar desde otro dispositivo.
    workAlertDismissal: v.optional(
      v.object({
        marginDays: v.number(),
        references: v.array(v.string()),
      }),
    ),
  })
    .index("email", ["email"]) // index for the email. do not remove or modify
    .index("by_role", ["role"]),

  // Catálogo de repuestos del taller (código interno, stock, ubicación...)
  spareParts: defineTable({
    code: v.string(), // código interno, ej. "ALI-24015"
    name: v.string(),
    description: v.optional(v.string()),
    category: v.string(), // Electrónica, Conectores, Mecánica, Consumibles...
    unit: v.string(), // "ud", "m", "par"
    stock: v.number(),
    minStock: v.number(), // umbral de alerta de stock bajo
    location: v.optional(v.string()), // estantería, ej. "B-03"
    supplier: v.optional(v.string()),
    partNumber: v.optional(v.string()), // referencia del fabricante/proveedor
    unitPrice: v.optional(v.number()),
    purchaseUrl: v.optional(v.string()), // ficha del proveedor
    // Equipos con los que es compatible (para filtrar por modelo)
    compatibleWith: v.optional(v.array(v.id("equipment"))),
    // Modelos de equipo con los que es compatible (catálogo de modelos)
    compatibleModels: v.optional(v.array(v.id("equipmentModels"))),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_category", ["category"])
    .index("by_name", ["name"]),

  // Catálogo de modelos de equipos (plantillas técnicas del fabricante)
  equipmentModels: defineTable({
    brand: v.optional(v.string()), // marca comercial, ej. "Sony"
    model: v.string(), // nombre/código comercial del modelo, ej. "HDC-3500"
    name: v.string(), // designación genérica, ej. "Cámara de estudio"
    category: v.optional(v.string()), // categoría del equipo
    defaultMaintenanceIntervalDays: v.optional(v.number()), // intervalo preventivo estándar
    defaultSupplier: v.optional(v.string()), // proveedor habitual
    description: v.optional(v.string()), // especificaciones generales o notas técnicas
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_model", ["model"])
    .index("by_brand", ["brand"]),

  // Inventario de equipos del taller (para elegir modelo en las peticiones)
  equipment: defineTable({
    modelId: v.optional(v.id("equipmentModels")), // enlace al catálogo de modelos
    code: v.optional(v.string()), // inventario interno, ej. "EQ-001"
    brand: v.optional(v.string()),
    name: v.string(), // designación, ej. "Cámara de estudio"
    model: v.string(), // modelo, ej. "HDC-3500"
    location: v.optional(v.string()),
    description: v.optional(v.string()),
    // Ficha de compra y ciclo de vida del equipo
    serialNumber: v.optional(v.string()), // número de serie
    supplier: v.optional(v.string()), // proveedor
    purchaseDate: v.optional(v.number()), // fecha de alta (timestamp)
    decommissionDate: v.optional(v.number()), // fecha de baja (timestamp)
    warrantyEndDate: v.optional(v.number()), // fin de garantía (timestamp)
    // Plan de mantenimiento preventivo: días entre revisiones (sin plan = vacío)
    maintenanceIntervalDays: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_model", ["model"])
    .index("by_modelId", ["modelId"]),

  // Incidencias/averías notificadas por cualquier usuario del taller
  incidents: defineTable({
    reference: v.string(), // "INC-0001"
    // El código corto con el que se sigue el caso desde fuera del taller, el
    // que se le da a quien notificó: aleatorio y sin relación con la
    // referencia, que es un correlativo interno y no puede salir de aquí (ver
    // `lib/publicCode`). Opcional porque las incidencias anteriores a esta
    // columna no lo tienen: se les reparte uno la primera vez que hace falta
    // (`ensurePublicCode`).
    publicCode: v.optional(v.string()), // "A7K2QX9M"
    // Datos de quien notifica (no tiene por qué estar registrado)
    reporterName: v.string(), // nombre y apellidos
    reporterRole: v.optional(v.string()), // puesto
    // Correo de quien notifica, si lo deja: es a donde se le avisa cuando el
    // caso cambia de estado. Opcional a propósito —avisar sin cuenta no debe
    // exigir dar datos de contacto— y solo para eso (`lib/incidentMail`).
    reporterEmail: v.optional(v.string()),
    location: v.optional(v.string()), // ubicación
    // Equipo afectado tal y como lo describe el notificador
    equipmentKind: v.optional(v.string()), // tipo de equipo
    model: v.optional(v.string()),
    serialNumber: v.optional(v.string()),
    description: v.string(), // descripción de la avería/incidencia
    reportedAt: v.number(), // fecha de notificación
    severity: v.optional(
      v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("critical"),
      ),
    ),
    status: incidentStatusValidator,
    // Si durante la verificación se asocia a un equipo del inventario
    equipmentId: v.optional(v.id("equipment")),
    // Técnico asignado (coordinador lo asigna o el técnico se autoasigna)
    assigneeId: v.optional(v.id("users")),
    assigneeName: v.optional(v.string()),
    // Entrada a taller: responsable de la orden (mismo u otro técnico)
    workshopAssigneeId: v.optional(v.id("users")),
    workshopAssigneeName: v.optional(v.string()),
    // Reparación externa: datos de salida a empresa/SAT externa y de retorno
    externalRepair: v.optional(
      v.object({
        // Envío
        sentAt: v.number(),
        companyName: v.string(), // Empresa externa / SAT
        contactName: v.optional(v.string()), // Persona o departamento de contacto
        contactPhone: v.optional(v.string()), // Teléfono o contacto del SAT
        defectNotes: v.string(), // Descripción técnica de la avería comunicada
        dispatchNotes: v.optional(v.string()), // Agencia, nº de seguimiento, albarán
        sentById: v.id("users"), // Quién autorizó o ejecutó el envío
        sentByName: v.string(),
        // Instantánea del equipo al momento de enviarse
        equipmentSnapshot: v.object({
          name: v.string(),
          model: v.string(),
          brand: v.optional(v.string()),
          serialNumber: v.optional(v.string()),
          code: v.optional(v.string()), // Ej: EQ-0012
          includedAccessories: v.optional(v.string()), // Cables, cargador, tapas, etc.
        }),
        // Retorno / Recepción
        receivedAt: v.optional(v.number()),
        receivedById: v.optional(v.id("users")),
        receivedByName: v.optional(v.string()),
        repairNotes: v.optional(v.string()), // Diagnóstico y trabajos realizados por la empresa externa
        workshopNotes: v.optional(v.string()), // Notas de comprobación del taller tras recibirlo
        cost: v.optional(v.number()), // Coste de la reparación (€)
        deliveryNoteNumber: v.optional(v.string()), // Nº de albarán o factura externa
        deliveryNoteStorageId: v.optional(v.id("_storage")), // Archivo del albarán externo adjunto
      }),
    ),
    // Datos aportados por el técnico al cerrar
    notes: v.optional(v.string()),
    resolvedNote: v.optional(v.string()),
    closedAt: v.optional(v.number()),
    // Documentos y notas que se van añadiendo durante el ciclo de vida
    // (por quien gestiona la incidencia).
    documents: v.optional(
      v.array(
        v.object({
          _id: v.id("incidentDocuments"),
          name: v.string(),
          // El archivo subido al almacenamiento del servidor. Opcional por los
          // documentos anteriores a subir archivos: esos solo tienen nombre.
          storageId: v.optional(v.id("_storage")),
          note: v.optional(v.string()),
          // Quién lo adjuntó (documento del expediente: lo mueve quien
          // coordina). Opcional porque los adjuntos anteriores a este campo
          // no lo tienen; los nuevos siempre lo llevan.
          author: v.optional(v.string()),
          createdAt: v.number(),
        }),
      ),
    ),
    lifecycleNotes: v.optional(
      v.array(
        v.object({
          note: v.string(),
          author: v.string(),
          // Quién la escribió: solo esa persona puede corregirla o borrarla,
          // y solo mientras dure el plazo. Opcional porque las notas
          // anteriores a este campo no lo tienen: esas ya son histórico y no
          // las toca nadie (tampoco su autor, que no se puede deducir del
          // nombre).
          authorId: v.optional(v.id("users")),
          // Identificador estable de la nota dentro del hilo, para poder
          // corregirla sin depender de su posición en la lista.
          id: v.optional(v.string()),
          // Fecha del hilo: puede ser anterior al momento de escribirla
          // (p. ej. al reconstruir el historial a mano).
          at: v.number(),
          // Cuándo se escribió de verdad, según el reloj del servidor: el
          // plazo se cuenta desde aquí, porque `at` sí lo elige quien la
          // escribe.
          createdAt: v.optional(v.number()),
          // Última corrección de su autor.
          editedAt: v.optional(v.number()),
          // Lo que decía la nota antes de cada corrección, con el momento en
          // que se sustituyó ese texto: la primera entrada es la nota tal y
          // como se escribió. Corregir una nota la enmienda, no la
          // reescribe: el texto anterior se conserva para poder reconstruirla
          // (queda en el expediente y se ve en la ficha).
          versions: v.optional(
            v.array(
              v.object({
                note: v.string(),
                at: v.number(),
              }),
            ),
          ),
          // Retirada: la nota sigue en el cuaderno, pero oculta. Retirarla no
          // la borra —se puede recuperar desde la ficha—, y por eso quedan
          // anotados quién la retiró y cuándo.
          deletedAt: v.optional(v.number()),
          deletedBy: v.optional(v.string()),
          // Última vez que la nota se devolvió a una versión anterior desde
          // su historial: quién lo hizo, cuándo y a qué versión se volvió
          // (su posición en `versions`, que identifica la versión sin
          // depender de su fecha). La restauración es una corrección más
          // —queda también en `versions`—, pero se anota aparte para poder
          // contarla como tal en la ficha y en el informe.
          restoredAt: v.optional(v.number()),
          restoredBy: v.optional(v.string()),
          restoredVersion: v.optional(v.number()),
        }),
      ),
    ),
    // Ficha de historial creada al cerrar (si hay equipo relacionado)
    maintenanceId: v.optional(v.id("maintenanceRecords")),
    // Cada paso del flujo deja su traza en la ficha
    history: v.array(
      v.object({
        status: incidentStatusValidator,
        at: v.number(),
        fromStatus: v.optional(incidentStatusValidator),
        by: v.optional(v.string()),
        note: v.optional(v.string()),
      }),
    ),
    // Archivo: las cerradas antiguas salen del día a día pero siguen
    // consultables. Sin el campo, la incidencia está en la cola activa.
    archivedAt: v.optional(v.number()),
    archivedBy: v.optional(v.string()),
    // Papelera: una incidencia equivocada o duplicada se retira y espera unos
    // días antes de borrarse de verdad (`lib/trash`). Mientras esté aquí no
    // sale en la cola, ni en el archivo, ni en el resumen, y su referencia ya
    // no sigue el caso: se ve —y se recupera— desde la papelera del módulo
    // Archivo. Lo que se retire a partir de ahora cumple el plazo vigente; lo
    // ya retirado, el que tenía cuando entró.
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.string()),
    // Por qué se retiró (duplicada, aviso equivocado…): es lo que se lee en la
    // papelera para saber si merece la pena volver a por ella.
    deletedReason: v.optional(v.string()),
    // Cuándo se borra de verdad, si nadie la recupera.
    purgeAt: v.optional(v.number()),
    // Último estado que se le avisó por correo a quien notificó, con cuándo y,
    // si el envío no salió, por qué. Guardar el estado es lo que evita repetir
    // el mismo aviso cada vez que la ficha se toca sin cambiar de estado.
    emailedStatus: v.optional(v.string()),
    emailedAt: v.optional(v.number()),
    emailError: v.optional(v.string()),
    // Último aviso interno —el que reciben los roles marcados en los ajustes del
    // correo— que se dio de esta incidencia: el alta, la asignación o el cierre.
    // Va aparte del aviso a quien notificó porque son dos correos distintos y a
    // públicos distintos; guardarlo evita repetir el mismo aviso del taller.
    staffNotifiedStatus: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"])
    .index("by_archivedAt", ["archivedAt"])
    // Los dos índices de la papelera: uno para listarla (solo tiene filas lo
    // retirado) y otro para la pasada que borra lo caducado.
    .index("by_deletedAt", ["deletedAt"])
    .index("by_purgeAt", ["purgeAt"])
    // Por referencia: el número con el que el taller cita un caso entre sí
    // («la INC-0004»). Quien notificó no lo usa: sigue el suyo por el código.
    .index("by_reference", ["reference"])
    // Por código: es la única puerta de quien no es del taller, y por eso el
    // índice no vale para enumerar nada —los códigos no van en orden—.
    .index("by_publicCode", ["publicCode"]),

  // Notificaciones in-app a los interesados de cada incidencia
  notifications: defineTable({
    userId: v.id("users"),
    text: v.string(),
    read: v.boolean(),
    incidentId: v.optional(v.id("incidents")),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_read", ["userId", "read"]),

  // Mensajería directa entre usuarios del taller (1 a 1)
  messages: defineTable({
    senderId: v.id("users"),
    senderName: v.string(), // nombre visible en el momento de enviar
    recipientId: v.id("users"),
    recipientName: v.string(), // para mostrar el hilo aunque cambie el nombre
    text: v.string(),
    read: v.boolean(), // leído por el destinatario
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_recipient", ["recipientId", "createdAt"])
    .index("by_sender", ["senderId", "createdAt"]),

  // Historial de averías y mantenimiento preventivo de cada equipo
  maintenanceRecords: defineTable({
    equipmentId: v.id("equipment"),
    kind: v.union(v.literal("repair"), v.literal("preventive")),
    title: v.string(), // resumen de la intervención
    description: v.optional(v.string()),
    performedAt: v.number(), // fecha de la intervención (timestamp)
    technician: v.optional(v.string()), // quién la realizó
    // Repuesto/material: peticiones usadas en la intervención
    requestId: v.optional(v.id("partRequests")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_equipment", ["equipmentId"])
    .index("by_performedAt", ["performedAt"]),

  // Manuales y documentación del taller: la ficha que se consulta y de la que
  // se descarga el archivo. La clasificación es de taller —tipo, marca y
  // modelo— y el vínculo con el inventario es opcional en los dos sentidos:
  // hay manuales de un modelo sin equipo asignado y equipos sin manuales.
  //
  // Cada ficha es de una de las dos formas: un archivo subido al almacén
  // (`kind` = "file", con `storageId`) o una nota que escribe un técnico
  // (`kind` = "note", sin archivo), y un manual con archivo puede llevar
  // además su nota. El archivo vive en el almacén del servidor: mientras la
  // ficha lo cite, la limpieza nocturna no lo toca (`storageCleanup`), y al
  // borrar el manual se borra con él.
  manuals: defineTable({
    title: v.string(), // título con el que se busca y se cita
    kind: v.union(v.literal("file"), v.literal("note")),
    type: v.string(), // clasificación: uno de los tipos del catálogo
    brand: v.optional(v.string()), // marca (se hereda del equipo si lo tiene)
    model: v.optional(v.string()), // modelo (se hereda del equipo si lo tiene)
    // Modelo del catálogo de modelos al que pertenece el manual (plantilla general).
    modelId: v.optional(v.id("equipmentModels")),
    // Equipo del inventario al que pertenece el manual, si es de uno concreto
    // del taller. Sin él, el manual es del modelo y sirve para cualquier
    // equipo de esa marca y modelo.
    equipmentId: v.optional(v.id("equipment")),
    // El archivo subido (PDF) y lo que el almacén sabe de él. Solo lo llevan
    // los manuales de tipo archivo.
    storageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()), // nombre visible del archivo
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
    // La nota del manual, escrita con el editor (documento de `richDoc`).
    notes: v.optional(v.string()),
    // Quién lo subió o lo escribió: es lo que permite al técnico corregir su
    // propia nota sin ser responsable del módulo.
    author: v.optional(v.string()),
    authorId: v.optional(v.id("users")),
    // Historial de cambios de la ficha: quién la creó, quién la corrigió y,
    // cuando se sustituye el archivo, la versión que queda fuera. Reemplazar
    // el PDF no lo borra del almacén: el archivo anterior se guarda aquí y se
    // puede seguir descargando desde la ficha. Mientras la ficha lo cite, la
    // limpieza nocturna no lo barre (`storageCleanup`); al borrar el manual se
    // va con él.
    history: v.optional(
      v.array(
        v.object({
          at: v.number(),
          action: v.union(
            v.literal("created"),
            v.literal("edited"),
            v.literal("fileReplaced"),
          ),
          by: v.string(),
          byId: v.optional(v.id("users")),
          // Campos que cambiaron, por su clave (`MANUAL_CHANGE_FIELDS`).
          fields: v.optional(v.array(v.string())),
          // El archivo que quedó fuera al sustituirlo: una versión anterior.
          file: v.optional(
            v.object({
              storageId: v.id("_storage"),
              fileName: v.string(),
              contentType: v.optional(v.string()),
              size: v.number(),
            }),
          ),
        }),
      ),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_equipment", ["equipmentId"])
    .index("by_modelId", ["modelId"])
    // Marca y modelo siempre se consultan juntos: son la clasificación de
    // taller con la que se busca «los manuales de este modelo».
    .index("by_brand_model", ["brand", "model"])
    .index("by_createdAt", ["createdAt"]),

  // Peticiones de repuestos de los técnicos hacia el responsable
  partRequests: defineTable({
    reference: v.string(), // "PET-0001"
    requesterName: v.string(),
    // Usuario autenticado que la crea (para «mis peticiones» del perfil)
    requesterId: v.optional(v.id("users")),
    requesterTeam: v.optional(v.string()),
    equipment: v.optional(v.string()), // equipo afectado (contexto)
    priority: priorityValidator,
    status: requestStatusValidator,
    // Equipo elegido del inventario (el texto libre sigue en `equipment`)
    equipmentId: v.optional(v.id("equipment")),
    lines: v.array(requestLineValidator),
    // Descripción libre de lo que se pide (peticiones sin referencia aún)
    description: v.optional(v.string()),
    // Si nació de una incidencia a taller, el vínculo con ella
    incidentId: v.optional(v.id("incidents")),
    // Fotos y documentos que adjunta el solicitante
    attachments: v.optional(
      v.array(
        v.object({
          storageId: v.id("_storage"),
          name: v.string(),
          kind: v.union(v.literal("image"), v.literal("document")),
        }),
      ),
    ),
    notes: v.optional(v.string()),
    // El motivo de cada decisión se escribe con el editor, así que guarda el
    // documento con su formato (y, como siempre, también vale el texto de una
    // nota de antes). Donde se lee de un vistazo —la cola, el archivo, el
    // CSV— se aplana a texto con `richDocToPlainText`.
    decisionNote: v.optional(v.string()), // motivo de la aprobación o el rechazo
    // Decisión explicable: qué motivo estructurado tiene esta petición (si lo hay).
    // Sirve para reportes y para que el archivo refleje el "por qué".
    decision: v.optional(requestDecisionValidator),
    decidedBy: v.optional(v.string()),
    decidedAt: v.optional(v.number()),
    issuedAt: v.optional(v.number()),
    issueNote: v.optional(v.string()), // motivo de la entrega
    returnedAt: v.optional(v.number()),
    returnNote: v.optional(v.string()),
    holdSinceAt: v.optional(v.number()),
    holdNote: v.optional(v.string()),
    // De qué estado salió la suspensión: al reanudar se vuelve ahí, porque
    // suspender es un paréntesis y no un paso atrás (`lib/requestFlow`). Sin
    // esto, una petición aprobada —con el material ya descontado— volvía a
    // «pendiente» y se podía aprobar otra vez, descontándolo dos veces. No lo
    // traen las peticiones suspendidas antes de que se apuntara: esas vuelven a
    // «pendiente», que es lo que hacía el taller entonces.
    heldFrom: v.optional(requestStatusValidator),
    cancelledAt: v.optional(v.number()),
    cancelNote: v.optional(v.string()),
    quoteRequestedAt: v.optional(v.number()),
    // Archivo: las peticiones ya decididas y antiguas salen del día a día
    // pero siguen consultables en el módulo de archivo.
    archivedAt: v.optional(v.number()),
    archivedBy: v.optional(v.string()),
    // Papelera: una petición equivocada o duplicada se retira y espera unos
    // días antes de borrarse de verdad (`lib/trash`), con el mismo plazo que
    // lo retirado del almacén y de las incidencias. Mientras esté aquí no
    // sale en la cola, ni en el archivo, ni en el resumen, y se ve —y se
    // recupera— desde la papelera del módulo Archivo. Lo que se retire a
    // partir de ahora cumple el plazo vigente; lo ya retirado, el que tenía
    // cuando entró.
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.string()),
    // Por qué se retiró (duplicada, pedida por error…): es lo que se lee en la
    // papelera para saber si merece la pena volver a por ella.
    deletedReason: v.optional(v.string()),
    // Cuándo se borra de verdad, si nadie la recupera.
    purgeAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"])
    .index("by_archivedAt", ["archivedAt"])
    // Los dos índices de la papelera: uno para listarla (solo tiene filas lo
    // retirado) y otro para la pasada que borra lo caducado.
    .index("by_deletedAt", ["deletedAt"])
    .index("by_purgeAt", ["purgeAt"])
    .index("by_incident", ["incidentId"])
    .index("by_requester", ["requesterId"])
    // La referencia ordenada como se escribe, que es como se numera la serie:
    // la más alta ya repartida está al final (`lib/references`).
    .index("by_reference", ["reference"]),

  // Auditoría de decisiones sobre peticiones: cada vía explicable (rechazo,
  // suspensión, devolución, cancelación, presupuesto externo, entrega) deja
  // una fila con quién lo hizo, cuándo y, si procede, el motivo estructurado.
  // Esto no sustituye a `decisionNote`: se usa para trazabilidad y reportes.
  requestDecisions: defineTable({
    requestId: v.id("partRequests"),
    by: v.string(),
    note: v.optional(v.string()),
    decision: v.optional(requestDecisionValidator),
    at: v.number(),
  }).index("by_request", ["requestId"]),

  // Peticiones de compra: una línea de una petición de repuesto que no había
  // en el almacén y hay que pedir fuera. Las aparta el responsable de
  // repuestos, una a una, y esperan agrupadas por proveedor hasta que entran
  // en una orden. Guardan el número y la fecha de la petición que las originó
  // para poder volver a ella sin cruzar dos tablas.
  purchaseRequests: defineTable({
    reference: v.string(), // "PC-0001"
    requestId: v.id("partRequests"), // la petición de repuesto que la origina
    requestReference: v.string(), // "PET-0007", copiado
    requestDate: v.number(), // fecha de solicitud de esa petición
    requesterName: v.string(), // quién pidió el repuesto (copiado)
    sparePartId: v.id("spareParts"),
    code: v.string(),
    name: v.string(),
    unit: v.string(),
    quantity: v.number(), // lo que hay que comprar
    supplier: v.string(), // por proveedor se agrupan las que están sin tratar
    status: purchaseRequestStatusValidator,
    // Motivo por el que se compra, tal y como lo ve el responsable: no había
    // stock, el repuesto es nuevo (no estaba en el catálogo), etc.
    reason: v.union(
      v.literal("noStock"),
      v.literal("newPart"),
      v.literal("other"),
    ),
    notes: v.optional(v.string()),
    orderId: v.optional(v.id("purchaseOrders")),
    requestedAt: v.number(), // cuándo la apartó el responsable
    requestedBy: v.string(),
    orderedAt: v.optional(v.number()),
    receivedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    cancelNote: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_request", ["requestId"])
    .index("by_order", ["orderId"])
    .index("by_supplier", ["supplier"])
    .index("by_createdAt", ["createdAt"])
    // La referencia, para repartir el número siguiente sin leer la tabla
    // entera (`lib/references`).
    .index("by_reference", ["reference"]),

  // Órdenes de compra: lo que el responsable manda de una vez a un proveedor
  // con las peticiones de compra que esperaban por él. Lleva su número y su
  // fecha (la de la orden) y, en cada línea, la petición de repuesto de la que
  // sale; el estado lo cierran las recepciones, no una decisión a mano.
  purchaseOrders: defineTable({
    reference: v.string(), // "OC-0001"
    supplier: v.string(),
    status: purchaseOrderStatusValidator,
    orderedAt: v.number(), // la fecha de la orden
    orderedBy: v.string(),
    // Las peticiones de repuesto que han generado esta orden, con su número y
    // su fecha de solicitud: es lo que se lee en la cabecera del documento.
    requestRefs: v.array(
      v.object({
        reference: v.string(),
        requestedAt: v.number(),
      }),
    ),
    lines: v.array(purchaseOrderLineValidator),
    // Código de la solicitud de compra externa (por defecto vacío u opcional)
    solicitudeCode: v.optional(v.string()),
    notes: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    cancelNote: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_supplier", ["supplier"])
    .index("by_orderedAt", ["orderedAt"])
    .index("by_solicitudeCode", ["solicitudeCode"])
    // La referencia, para repartir el número siguiente sin leer la tabla
    // entera (`lib/references`).
    .index("by_reference", ["reference"]),

  // Recepciones: cada entrada de material de un proveedor, con el albarán de
  // entrega adjunto (obligatorio) y lo que ha entrado. Una orden puede tener
  // varias —el proveedor manda lo que tiene— y de aquí salen el movimiento de
  // almacén, el estado de la orden y el «material recibido» de las peticiones.
  receptions: defineTable({
    orderId: v.id("purchaseOrders"),
    orderReference: v.string(), // "OC-0001", copiado
    supplier: v.string(),
    lines: v.array(receptionLineValidator),
    deliveryNote: deliveryNoteValidator, // el albarán: sin él no hay recepción
    note: v.optional(v.string()),
    receivedBy: v.string(),
    receivedAt: v.number(),
  })
    .index("by_order", ["orderId"])
    .index("by_receivedAt", ["receivedAt"]),

  // Roles del taller: los del sistema nacen en el código (su etiqueta y sus
  // permisos por defecto) y el administrador crea los personalizados. La
  // fila guarda además los permisos que el administrador haya configurado.
  roles: defineTable({
    key: v.string(), // slug único, p. ej. "manager" o "auxiliar-de-almacen"
    label: v.string(), // nombre visible, p. ej. "Responsable de repuestos"
    description: v.string(),
    kind: v.union(v.literal("system"), v.literal("custom")),
    grants: v.record(v.string(), v.boolean()), // capacidades concedidas
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.optional(v.id("users")),
  }).index("by_key", ["key"]),

  // Flags de la aplicación (p. ej. datos de demostración cargados)
  appSettings: defineTable({
    key: v.string(),
    seeded: v.boolean(),
  }).index("by_key", ["key"]),

  // Por dónde va la numeración de cada serie de referencias: la incidencia, la
  // petición de repuestos, la petición de compra y la orden (`lib/references`).
  // Es lo que hace que un número gastado no vuelva a repartirse **nunca**, ni
  // aunque la papelera borre todas las filas de la serie: lo que se cuenta no son
  // las filas que quedan, son los números que ya se han dado. La tabla nace sin
  // filas —una serie apunta su contador la primera vez que reparte un número— y
  // entonces la serie arranca desde la referencia más alta que hubiera en uso.
  referenceCounters: defineTable({
    // La serie: una clave de `lib/references`. La clave la valida el reparto,
    // como el rol de un usuario (`roleValidator`).
    kind: v.string(),
    // El último número repartido. No vuelve atrás.
    last: v.number(),
  }).index("by_kind", ["kind"]),

  // El freno de la consulta pública por código: una fila por código, con la
  // ventana en curso —cuándo empezó y cuántas consultas lleva—. Es estado
  // efímero, no trabajo del taller: se escribe al consultar y se reinicia sola
  // al cumplirse la hora (`lib/publicLookup`). Una fila por código y no una por
  // consulta a propósito: la puerta está abierta y lo que no puede crecer sin
  // freno es la tabla, que es justo lo que se viene a proteger. Lo que quede de
  // una ventana caducada lo borra la purga de la noche, y por eso hay índice por
  // fecha: la pasada no tiene que leer la tabla entera para saber qué sobra.
  publicLookupLimits: defineTable({
    // El código ya normalizado (`lib/publicCode`): como se sigue el caso.
    code: v.string(),
    // Cuándo empezó la ventana de una hora que se está contando.
    windowStart: v.number(),
    // Consultas dentro de esa ventana. Al cumplirse, vuelve a uno.
    count: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_windowStart", ["windowStart"]),

  // La foto pública del taller: una sola fila con lo poco del trabajo que se
  // puede enseñar a quien no ha entrado nunca. Existe para que la portada no
  // cuente nada al vuelo: contar equipos, repuestos e incidencias es leer esas
  // tablas enteras, y una página abierta a internet no puede permitirse que
  // cada visita las recorra. La foto la refresca el cron de `publicStats` cada
  // quince minutos, así que puede ir por detrás del trabajo real —de ahí que la
  // portada diga cuándo se tomó—, y solo guarda agregados: ni nombres, ni
  // referencias, ni ubicaciones, ni quién hizo qué. La fila es una sola por
  // clave fija, y por eso la tabla no crece.
  publicStats: defineTable({
    key: v.string(), // "taller": la fila única
    // Equipos dados de alta y en servicio (los de baja no cuentan).
    equipment: v.number(),
    // Repuestos del catálogo del almacén.
    spareParts: v.number(),
    // Incidencias vivas, sin cerrar, fuera de la papelera y del archivo.
    openIncidents: v.number(),
    // Incidencias cerradas en la ventana de la media, para dar contexto.
    closedLastMonth: v.number(),
    // Media de cierre en minutos, redondeada; nula cuando aún no hay muestra
    // bastante para publicarla sin señalar a un caso concreto.
    meanResolutionMinutes: v.union(v.number(), v.null()),
    // Cuándo se tomaron estos números, para que la portada lo diga.
    computedAt: v.number(),
  }).index("by_key", ["key"]),

  // Documentos de una incidencia: el archivo de verdad vive en el
  // almacenamiento del servidor y aquí queda su ficha (nombre visible, nota
  // opcional y de quién es). `storageId` es opcional porque los documentos
  // adjuntos antes de subirse los archivos —y los de la muestra— solo tienen
  // nombre; los que se adjuntan ahora siempre traen archivo.
  incidentDocuments: defineTable({
    incidentId: v.id("incidents"),
    // Nombre visible (el del archivo, o el que le ponga quien lo adjunta).
    name: v.string(),
    // El archivo subido. Sin él, la ficha lo marca como documento sin archivo.
    storageId: v.optional(v.id("_storage")),
    note: v.optional(v.string()),
    author: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_incident", ["incidentId"]),

  // Rastro de auditoría de los documentos: quién adjuntó, editó o quitó cada
  // uno y cuándo. Lo lee quien coordina el expediente. No se borra nunca: es
  // la única constancia de un adjunto retirado, y por eso `documentId` puede
  // apuntar a una fila que ya no existe (los identificadores no se reutilizan
  // y es lo que enlaza cada cambio con el documento del que habla).
  incidentDocumentLog: defineTable({
    incidentId: v.id("incidents"),
    documentId: v.id("incidentDocuments"),
    action: documentActionValidator,
    // Nombre visible en el momento del cambio (el nuevo, si se renombró).
    name: v.string(),
    // Nombre anterior: solo cuando la edición cambió el nombre visible.
    previousName: v.optional(v.string()),
    // Quién hizo el cambio: el nombre con el que firmaba entonces y su
    // usuario, para no depender de cómo se llame hoy.
    by: v.string(),
    byId: v.id("users"),
    at: v.number(),
  })
    .index("by_incident", ["incidentId"])
    // La auditoría global recorre el histórico entero por fecha. El filtro
    // por persona se aplica sobre esa misma lectura: la consulta necesita
    // siempre el total y las firmas de todo el histórico, así que no ahorra
    // nada tener un índice aparte por autor.
    .index("by_at", ["at"]),

  // Imágenes del formulario público de incidencia. Quien notifica una avería
  // no tiene cuenta, así que su subida no puede pasar por `uploads.ts` —que
  // pide sesión—: pasa por su propio vale. La fila es la constancia de que ese
  // archivo se pidió desde el formulario y de qué se comprobó al aceptarlo, y
  // es lo que distingue lo que dejó el formulario de lo que nadie acreditó
  // —la limpieza nocturna borra lo segundo—.
  reportUploads: defineTable({
    // Vale que acompaña a la URL de subida: sin él no se acepta ningún archivo.
    ticket: v.string(),
    // El archivo, ya comprobado (una imagen dentro del límite).
    storageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
    // Cuándo se acreditó. Sin acreditar, el archivo no sirve para una incidencia.
    claimedAt: v.optional(v.number()),
  })
    .index("by_ticket", ["ticket"])
    .index("by_createdAt", ["createdAt"])
    .index("by_storage", ["storageId"]),

  // La constancia de las pasadas de limpieza del almacén: una fila por pasada
  // (`pass`), con cuándo fue la última vez y qué retiró. La escriben las
  // propias pasadas —la de la madrugada y la que se lanza a mano desde
  // Ajustes del taller—, que es lo que permite enseñar qué se llevó la última
  // noche sin tener que reconstruirlo a partir de lo que queda.
  storageCleanupRuns: defineTable({
    // Qué pasada es: lo que dejó el formulario público o los archivos que ya
    // no cita nadie. Son las claves que reparte `lib/cleanupLog`.
    pass: v.string(),
    ranAt: v.number(),
    files: v.number(), // archivos retirados del almacén
    bytes: v.number(), // lo que ocupaban
    // Vales sin archivo que se retiraron con ellos: no son archivos, pero se
    // van en la misma pasada.
    tickets: v.optional(v.number()),
    // Archivos que la pasada no pudo leer: los que están en el almacén sin
    // dirección con la que abrirlos y los que algo cita y ya no están. No se
    // retiran —de un archivo que no se lee no se puede decidir nada—, así que
    // se cuentan aparte de los retirados para que la pantalla pueda señalarlos.
    unreadable: v.optional(v.number()),
    // Quién la lanzó: la limpieza automática o el nombre de quien pulsó.
    runBy: v.string(),
  }).index("by_pass", ["pass"]),

  // La constancia de las purgas a mano de las imágenes del formulario: una fila
  // por purga, que no se vuelve a tocar. La de las pasadas
  // (`storageCleanupRuns`) guarda la última vez de cada una y solo cuenta
  // cuántos archivos fueron; esto es otra cosa: cuando alguien borra a mano,
  // queda escrito quién, cuándo y qué se llevó, una fila por archivo.
  reportUploadPurges: defineTable({
    // Quién la hizo: el nombre visible de quien pulsó. Nunca la firma
    // automática: lo que retira la madrugada no pasa por aquí.
    runBy: v.string(),
    ranAt: v.number(),
    // Lo que se llevó, una entrada por archivo: su vale y lo que ocupaba. El
    // vale es lo único que identifica una imagen del formulario —su nombre no
    // se guarda en ninguna parte— y con él se puede volver a por ella mientras
    // esté en la papelera.
    images: v.array(v.object({ ticket: v.string(), size: v.number() })),
    // Y los vales que no llegaron a tener archivo: se fueron con ellas, pero
    // no eran imágenes.
    tickets: v.array(v.string()),
    bytes: v.number(),
  }).index("by_ranAt", ["ranAt"]),

  // La papelera del almacén: lo que retira la limpieza, guardado unos días
  // antes de borrarlo de verdad. Mientras la fila esté aquí, el archivo sigue
  // en el almacén y es esta fila la que lo cita —la limpieza solo retira lo
  // que no menciona nadie, así que con la fila delante lo deja en paz—; al
  // caducar se borran la fila y el archivo, y al rescatarlo se marca `kept` y
  // deja de caducar: solo se va si alguien lo borra a mano.
  trashFiles: defineTable({
    storageId: v.id("_storage"),
    // Lo poco que se sabe de un archivo por el que ya no responde ninguna
    // ficha: su tipo y lo que ocupa, tal y como lo ve el almacén.
    contentType: v.optional(v.string()),
    size: v.number(),
    // Qué pasada lo retiró y quién: las claves de `lib/cleanupLog` —solo
    // retiran archivos la del formulario y la de los que no cita nadie—.
    pass: v.union(v.literal("reportUploads"), v.literal("orphanFiles")),
    runBy: v.string(),
    removedAt: v.number(),
    // Cuándo se borra de verdad, si nadie lo rescata (`lib/trash`).
    purgeAt: v.number(),
    // El vale del formulario público, si el archivo vino de ahí: es lo que
    // permite devolverle su sitio —su vale, con ventana nueva— al recuperarlo.
    ticket: v.optional(v.string()),
    // Rescatado: ni caduca ni se borra solo.
    kept: v.boolean(),
    keptAt: v.optional(v.number()),
  })
    .index("by_kept_purgeAt", ["kept", "purgeAt"])
    .index("by_storage", ["storageId"]),

  // Ajustes de la limpieza del almacén: una sola fila (`key` = "default").
  // Guarda cuántos días se queda un archivo retirado en la papelera antes de
  // borrarlo de verdad; sin fila guardada vale el de partida del código
  // (`lib/trash`). Vale para lo que se retire a partir de entonces: lo que ya
  // está en la papelera cumple el plazo con el que entró.
  storageSettings: defineTable({
    key: v.string(),
    trashRetentionDays: v.number(), // plazo de la papelera, en días
    updatedAt: v.number(),
    updatedBy: v.optional(v.string()),
  }).index("by_key", ["key"]),

  // Ajustes del aviso de trabajo sin constancia: una sola fila
  // (`key` = "default"). El panel los lee para saber con qué margen avisa de
  // lo que lleva días en curso sin nota y a qué roles les llega; sin fila
  // guardada valen los valores de partida del código.
  alertSettings: defineTable({
    key: v.string(),
    days: v.number(), // margen sin constancia, en días
    roleKeys: v.array(v.string()), // roles a los que les llega el aviso
    updatedAt: v.number(),
    updatedBy: v.optional(v.string()),
  }).index("by_key", ["key"]),

  // Ajustes de los avisos de auditoría del expediente: una sola fila
  // (`key` = "default"). Guarda los roles a los que les llega el aviso de un
  // movimiento sensible (un documento retirado, o cualquier movimiento de una
  // incidencia ya cerrada); sin fila guardada valen los valores de partida
  // del código. No lleva margen: el aviso no depende del tiempo.
  auditAlertSettings: defineTable({
    key: v.string(),
    roleKeys: v.array(v.string()), // roles a los que les llega el aviso
    updatedAt: v.number(),
    updatedBy: v.optional(v.string()),
  }).index("by_key", ["key"]),

  // Ajustes del resumen semanal: una sola fila (`key` = "default"). El panel
  // los usa para saber si toca enviar, qué día de la semana y a qué roles les
  // llega; sin fila guardada valen los valores de partida del código.
  reportSettings: defineTable({
    key: v.string(),
    enabled: v.boolean(), // false = sin resumen semanal
    weekday: v.number(), // 1 = lunes … 7 = domingo (en UTC, como el cron)
    roleKeys: v.array(v.string()), // roles que reciben el correo
    lastSentAt: v.optional(v.number()),
    lastSentTo: v.optional(v.array(v.string())),
    updatedAt: v.number(),
    updatedBy: v.optional(v.string()),
  }).index("by_key", ["key"]),

  // Resúmenes semanales compuestos: una fila por semana (`key`). Guarda el
  // texto que salió —o el motivo por el que no salió— para que el panel pueda
  // enseñar qué se contó cada semana y a quién le llegó.
  weeklyReports: defineTable({
    key: v.string(), // "week-YYYY-MM-DD" (el día en que arranca la semana)
    from: v.number(),
    to: v.number(),
    subject: v.string(),
    text: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed")),
    recipients: v.array(v.string()),
    summary: v.object({
      touched: v.number(), // incidencias con movimiento
      withoutTrace: v.number(), // en curso sin constancia
      archived: v.number(), // fichas al archivo
    }),
    error: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_key", ["key"]),

  // Ajustes del archivo: una sola fila (`key` = "default"). La pasada
  // automática de cada noche los lee para saber desde qué antigüedad archiva.
  archiveSettings: defineTable({
    key: v.string(),
    enabled: v.boolean(), // false = sin archivado automático
    afterMonths: v.number(), // antigüedad mínima para archivar
    lastRunAt: v.optional(v.number()), // última pasada automática
    lastRunArchived: v.optional(v.number()), // cuánto archivó entonces
    updatedAt: v.number(),
    updatedBy: v.optional(v.string()),
  }).index("by_key", ["key"]),

  // Ajustes del correo saliente: una sola fila (`key` = "default"). Guarda por
  // qué servicio sale el correo del taller y con qué remitente; sin fila
  // guardada valen los de partida de `lib/mail` (la pasarela de la plataforma).
  // La clave del servicio vive aquí y no sale nunca al navegador: la consulta
  // de los ajustes la enmascara y la entrega —que la lee— es interna. El
  // `provider` es una clave de `lib/mail`, como el rol de un usuario: la valida
  // el reparto, no el esquema, para no tener el catálogo escrito dos veces.
  mailSettings: defineTable({
    key: v.string(),
    provider: v.string(),
    enabled: v.boolean(), // false = no se manda ningún correo del taller
    fromName: v.string(),
    fromEmail: v.string(),
    replyTo: v.optional(v.string()),
    bcc: v.optional(v.string()), // copia oculta fija del taller (una dirección)
    // Roles que reciben por correo el aviso interno de cada incidencia nueva.
    // Vacío = no se avisa a nadie por correo (quien la notificó sigue recibiendo
    // el suyo). Se valida contra la tabla de roles, no aquí.
    incidentRoles: v.optional(v.array(v.string())),
    domain: v.optional(v.string()), // dominio verificado (Mailgun)
    relayUrl: v.optional(v.string()), // puente HTTP del relevo propio
    smtpUser: v.optional(v.string()), // cuenta SMTP (Gmail, buzón de pruebas)
    apiKey: v.optional(v.string()), // secreto del servicio, nunca en una lectura
    relayToken: v.optional(v.string()), // testigo del relevo, idem
    updatedAt: v.number(),
    updatedBy: v.optional(v.string()),
    // La última prueba de envío, para que la pantalla pueda enseñar si el
    // servicio contesta o qué dijo al no hacerlo.
    lastTestAt: v.optional(v.number()),
    lastTestTo: v.optional(v.string()),
    lastTestOk: v.optional(v.boolean()),
    lastTestError: v.optional(v.string()),
  }).index("by_key", ["key"]),

  // Histórico de correos salientes: qué salió, a quién y qué contestó el
  // servicio. Guarda el sobre —destinatarios, copia oculta, asunto y resultado—
  // y nunca el cuerpo, que ya vive en la ficha de la incidencia o en el resumen.
  // Es de auditoría, no trabajo del taller: el vaciado no lo toca, y se poda solo
  // al apuntar (los últimos `MAIL_LOG_LIMIT`), porque crece con cada aviso.
  mailLog: defineTable({
    at: v.number(),
    what: v.string(), // «el aviso a quien notificó», en minúsculas
    origin: v.string(), // "incidencia" | "resumen" | "prueba"
    provider: v.string(),
    to: v.array(v.string()),
    bcc: v.array(v.string()),
    subject: v.string(),
    ok: v.boolean(),
    error: v.optional(v.string()),
    relatedId: v.optional(v.string()), // la incidencia, cuando la hay
  }).index("by_at", ["at"]),

  // Registro inmutable de auditoría de seguridad: registra cambios de roles,
  // activación/baja de cuentas, vaciado de taller e intentos de acceso no autorizados.
  securityAuditLog: defineTable({
    actorId: v.optional(v.id("users")),
    actorEmail: v.optional(v.string()),
    action: v.string(), // "role_change" | "account_status_change" | "unauthorized_access" | "workshop_reset"
    target: v.string(), // e.g. "user:..." | "workshop"
    metadata: v.optional(v.string()), // Detalles del evento en JSON
    at: v.number(),
  })
    .index("by_at", ["at"])
    .index("by_action", ["action"])
    .index("by_actor", ["actorId"]),

  // Catálogos maestros normalizados (marca, ubicación de equipos, ubicación en almacén de repuestos,
  // proveedor, puesto, categoría de repuesto) con autocompletado y prevención de erratas.
  catalogs: defineTable({
    kind: v.union(
      v.literal("brand"),
      v.literal("equipmentLocation"),
      v.literal("partLocation"),
      v.literal("location"), // Compatibilidad y migración de datos previos
      v.literal("supplier"),
      v.literal("position"),
      v.literal("partCategory"),
      v.literal("externalWorkshop"),
    ),
    name: v.string(), // Nombre oficial o canónico visible, ej. "Plató 1" o "Estantería A-01"
    normalized: v.string(), // Minúsculas, sin acentos ni espacios sobrantes para deduplicación
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_kind", ["kind"])
    .index("by_kind_normalized", ["kind", "normalized"]),
});

export default schema;
