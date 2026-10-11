import type { Role } from "./roles";

/**
 * Capacidades que el administrador puede conceder (o quitar) a cada rol desde
 * el módulo de permisos. El administrador siempre las tiene todas.
 */
export type Capability =
  | "viewIncidents"
  | "manageIncidents"
  | "viewRequests"
  | "createRequests"
  | "lookupCatalog"
  | "decideRequests"
  | "viewPurchasing"
  | "managePurchasing"
  | "viewInventory"
  | "manageInventory"
  | "viewEquipment"
  | "manageEquipment"
  | "lookupEquipment"
  | "viewManuals"
  | "manageManuals"
  | "sendMessages"
  | "manageUsers"
  | "configurePermissions"
  | "viewAudit";

/** Una capacidad con su etiqueta para la matriz del administrador. */
export interface CapabilityMeta {
  id: Capability;
  /** Bloqueada: solo la tiene el administrador y no se puede conceder. */
  locked?: boolean;
  group: string;
  label: string;
  description: string;
}

/**
 * Catálogo de capacidades: qué puede ver y modificar cada rol. El orden
 * agrupa la matriz de configuración por módulo de la aplicación.
 *
 * Las capacidades de modificación se comprueban en el backend de cada módulo.
 * Las de «ver» gobiernan el acceso desde la interfaz (menú, módulo y tarjetas
 * del resumen). Las lecturas que necesita otro flujo se conceden aparte con
 * `lookupCatalog` (peticiones) y `lookupEquipment` (incidencias): sin ninguna
 * de ellas y sin la capacidad de ver el módulo, `spareParts` y `equipment`
 * devuelven lista vacía en vez de un error, para no romper el formulario de
 * peticiones, la verificación de incidencias ni la búsqueda global.
 */
export const CAPABILITIES: CapabilityMeta[] = [
  {
    id: "viewIncidents",
    group: "Incidencias",
    label: "Ver la cola de incidencias",
    description:
      "Muestra el módulo de incidencias en el menú y su cola de trabajo.",
  },
  {
    id: "manageIncidents",
    group: "Incidencias",
    label: "Asignar y cerrar incidencias",
    description:
      "Asignar a otros técnicos, verificar, derivar a taller, cerrar y gestionar los documentos adjuntos. Las notas las escribe también el técnico al que esté asignada la incidencia.",
  },
  {
    id: "viewRequests",
    group: "Peticiones",
    label: "Ver las peticiones de repuestos",
    description: "Muestra el módulo de peticiones y el estado de cada una.",
  },
  {
    id: "createRequests",
    group: "Peticiones",
    label: "Crear peticiones",
    description: "Solicitar material y adjuntar fotos o documentos.",
  },
  {
    id: "lookupCatalog",
    group: "Peticiones",
    label: "Consultar el catálogo al pedir material",
    description:
      "Permite leer repuestos y equipos desde el formulario de peticiones y el perfil, sin dar acceso a sus módulos.",
  },
  {
    id: "decideRequests",
    group: "Peticiones",
    label: "Aprobar, rechazar y entregar",
    description: "Decidir las peticiones y marcarlas como entregadas.",
  },
  {
    id: "viewPurchasing",
    group: "Compras",
    label: "Ver las compras",
    description:
      "Muestra el módulo de compras: las peticiones de compra sin tratar, las órdenes y sus recepciones.",
  },
  {
    id: "managePurchasing",
    group: "Compras",
    label: "Comprar y recepcionar",
    description:
      "Generar peticiones de compra, montar las órdenes por proveedor, anotar cada artículo y recepcionar el material con su albarán.",
  },
  {
    id: "viewInventory",
    group: "Repuestos",
    label: "Ver el catálogo de repuestos",
    description:
      "Muestra el stock, la ubicación y los avisos del almacén AV. El catálogo se sigue leyendo al crear peticiones.",
  },
  {
    id: "manageInventory",
    group: "Repuestos",
    label: "Modificar repuestos",
    description: "Altas, ediciones y ajustes de stock del catálogo.",
  },
  {
    id: "viewEquipment",
    group: "Equipos",
    label: "Ver el inventario de equipos",
    description: "Muestra el inventario y las fichas del equipo audiovisual.",
  },
  {
    id: "manageEquipment",
    group: "Equipos",
    label: "Modificar equipos e historial",
    description: "Altas, ediciones, bajas y registro de intervenciones.",
  },
  {
    id: "lookupEquipment",
    group: "Equipos",
    label: "Consultar el inventario al vincular una incidencia",
    description:
      "Permite elegir el equipo de una incidencia al verificarla o cerrarla, sin dar acceso al módulo de equipos.",
  },
  {
    id: "viewManuals",
    group: "Manuales",
    label: "Ver y descargar manuales",
    description:
      "Muestra el módulo de manuales y permite abrir y descargar sus archivos y leer las notas del taller. Las sesiones de invitado no tienen acceso.",
  },
  {
    id: "manageManuals",
    group: "Manuales",
    label: "Subir, cambiar y borrar manuales",
    description:
      "Carga de manuales en PDF, cambio de su clasificación y borrado. Las notas del taller las escribe su autor, tenga o no este permiso.",
  },
  {
    id: "sendMessages",
    group: "Comunicación",
    label: "Enviar mensajes internos",
    description: "Escribir a otras personas del taller desde la mensajería.",
  },
  {
    id: "manageUsers",
    group: "Administración",
    label: "Gestionar usuarios y roles",
    description:
      "Alta, baja, edición y cambio de rol de las personas del taller.",
    locked: true,
  },
  {
    id: "configurePermissions",
    group: "Administración",
    label: "Configurar los permisos por rol",
    description: "Acceder a este módulo de configuración.",
    locked: true,
  },
  {
    id: "viewAudit",
    group: "Administración",
    label: "Auditar los documentos del expediente",
    description:
      "Consultar quién adjuntó, editó o retiró un documento en cualquier incidencia, con filtros por persona y fecha.",
    locked: true,
  },
];

/** ¿Existe esa capacidad en el catálogo? (claves ajenas se descartan). */
export function isKnownCapability(key: string): key is Capability {
  return CAPABILITIES.some((item) => item.id === key);
}

/**
 * Permisos por defecto de cada rol del sistema: reproducen el comportamiento
 * inicial de la aplicación (sin ninguna fila guardada en la tabla `roles`).
 * Los roles personalizados no tienen defaults: nacen de una plantilla.
 */
export const DEFAULT_GRANTS: Record<Role, Record<Capability, boolean>> = {
  admin: {
    viewIncidents: true,
    manageIncidents: true,
    viewRequests: true,
    createRequests: true,
    lookupCatalog: true,
    decideRequests: true,
    viewPurchasing: true,
    managePurchasing: true,
    viewInventory: true,
    manageInventory: true,
    viewEquipment: true,
    manageEquipment: true,
    lookupEquipment: false,
    viewManuals: true,
    manageManuals: true,
    sendMessages: true,
    manageUsers: true,
    configurePermissions: true,
    viewAudit: true,
  },
  manager: {
    viewIncidents: true,
    manageIncidents: true,
    viewRequests: true,
    createRequests: true,
    lookupCatalog: true,
    decideRequests: true,
    viewPurchasing: true,
    managePurchasing: true,
    viewInventory: true,
    manageInventory: true,
    viewEquipment: true,
    manageEquipment: true,
    lookupEquipment: false,
    viewManuals: true,
    manageManuals: true,
    sendMessages: true,
    manageUsers: false,
    configurePermissions: false,
    viewAudit: false,
  },
  technician: {
    viewIncidents: true,
    manageIncidents: false,
    viewRequests: true,
    createRequests: true,
    lookupCatalog: true,
    decideRequests: false,
    viewPurchasing: false,
    managePurchasing: false,
    viewInventory: false,
    manageInventory: false,
    viewEquipment: false,
    manageEquipment: false,
    lookupEquipment: false,
    // El técnico consulta y descarga los manuales y escribe sus propias notas
    // del taller, pero no sube ni borra los manuales del módulo.
    viewManuals: true,
    manageManuals: false,
    sendMessages: true,
    manageUsers: false,
    configurePermissions: false,
    viewAudit: false,
  },
  guest: {
    viewIncidents: false,
    manageIncidents: false,
    viewRequests: false,
    createRequests: false,
    lookupCatalog: false,
    decideRequests: false,
    viewPurchasing: false,
    managePurchasing: false,
    viewInventory: false,
    manageInventory: false,
    viewEquipment: false,
    manageEquipment: false,
    lookupEquipment: false,
    viewManuals: false,
    manageManuals: false,
    sendMessages: false,
    manageUsers: false,
    configurePermissions: false,
    viewAudit: false,
  },
};

/* La mezcla de lo guardado sobre los defaults vive en el backend
 * (`src/convex/permissions.ts`), que también resuelve los roles
 * personalizados, que no tienen valores por defecto. */
