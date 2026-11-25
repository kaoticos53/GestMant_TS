import { ConvexError } from "convex/values";
import { matchesQuery } from "./browse";
import { isIncidentInProgress } from "./incidentFlow";
import { richDocBlocks, richDocToPlainText } from "./richDoc";
import { diffRichDoc, type RichDocChanges } from "./richDocDiff";
import { REFERENCE_PREFIX, normalizeReference } from "./references";
import { COORDINATION_ROLES, type RoleKey } from "./roles";

/** Categorías del catálogo de repuestos. */
export const PART_CATEGORIES = [
  "Vídeo y cámaras",
  "Audio",
  "Iluminación",
  "Alimentación",
  "Conectividad",
  "Mecánica",
  "Consumibles",
  "Herramientas",
] as const;

export type Priority = "urgent" | "normal" | "low";
export type RequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "issued"
  | "onHold"
  | "returned"
  | "cancelled"
  | "pendingSupplierQuote"
  | "materialReceived";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export const INCIDENT_PRIORITIES = [
  "low",
  "medium",
  "high",
  "urgent",
] as const;

export type IncidentPriority = (typeof INCIDENT_PRIORITIES)[number];

export const DEFAULT_INCIDENT_PRIORITY: IncidentPriority = "medium";

export const INCIDENT_PRIORITY_META: Record<
  IncidentPriority,
  { label: string; rank: number; badgeClassName: string }
> = {
  low: {
    label: "Baja",
    rank: 1,
    badgeClassName: "border-border bg-muted text-muted-foreground",
  },
  medium: {
    label: "Media",
    rank: 2,
    badgeClassName: "border-signal/25 bg-signal/10 text-signal",
  },
  high: {
    label: "Alta",
    rank: 3,
    badgeClassName:
      "border-status-warning/30 bg-status-warning-surface text-status-warning-foreground",
  },
  urgent: {
    label: "Urgente",
    rank: 4,
    badgeClassName: "border-destructive/35 bg-destructive/10 text-destructive",
  },
};

export function normalizeIncidentPriority(
  value?: string | null,
): IncidentPriority {
  if (
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "urgent"
  ) {
    return value;
  }
  return DEFAULT_INCIDENT_PRIORITY;
}

export function incidentPriorityRank(
  priority?: IncidentPriority | null,
): number {
  return INCIDENT_PRIORITY_META[normalizeIncidentPriority(priority)].rank;
}

export const PRIORITY_META: Record<
  Priority,
  { label: string; badgeClassName: string }
> = {
  urgent: {
    label: "Urgente",
    badgeClassName: "border-destructive/25 bg-destructive/10 text-destructive",
  },
  normal: {
    label: "Normal",
    badgeClassName: "border-signal/25 bg-signal/10 text-signal",
  },
  low: {
    label: "Baja",
    badgeClassName: "border-border bg-muted text-muted-foreground",
  },
};

/** Metadatos de motivos de decisión legibles por la UI. No son el único origen de
 * `decisionNote`; sirven para mostrar un motivo estandarizado cuando existe. */
export const REJECTION_REASON_LABELS: Record<string, string> = {
  outOfScope: "Fuera de alcance",
  noBudget: "Sin presupuesto",
  duplicated: "Duplicada",
  incompatibleModel: "Modelo incompatible",
  partObsolete: "Repuesto obsoleto",
  stockPending: "Stock pendiente",
  incidentClosed: "Incidencia ya cerrada",
  requestCancelled: "Petición cancelada",
  materialReturned: "Material devuelto",
  materialPartiallyReturned: "Material devuelto en parte",
  materialDelivered: "Material entregado",
  materialPartiallyDelivered: "Material entregado en parte",
  pendingExternalQuote: "Pendiente de presupuesto externo",
  other: "Otro motivo",
};

export const STATUS_META: Record<
  RequestStatus,
  {
    label: string;
    description: string;
    badgeClassName: string;
    dotClassName: string;
  }
> = {
  pending: {
    label: "Pendiente",
    description: "Esperando revisión del responsable de repuestos",
    badgeClassName:
      "border-status-warning/30 bg-status-warning-surface text-status-warning-foreground",
    dotClassName: "bg-status-warning",
  },
  approved: {
    label: "Aprobada",
    description: "Material apartado; pendiente de entregar",
    badgeClassName: "border-signal/25 bg-signal/10 text-signal",
    dotClassName: "bg-signal",
  },
  rejected: {
    label: "Rechazada",
    description: "No se ha servido material",
    badgeClassName: "border-border bg-muted text-muted-foreground",
    dotClassName: "bg-muted-foreground",
  },
  issued: {
    label: "Entregada",
    description: "Material entregado al técnico",
    badgeClassName:
      "border-status-success/30 bg-status-success-surface text-status-success-foreground",
    dotClassName: "bg-status-success",
  },
  onHold: {
    label: "En espera",
    description: "Suspendida temporalmente por una dependencia",
    badgeClassName: "border-border/60 bg-muted/50 text-muted-foreground",
    dotClassName: "bg-muted-foreground",
  },
  returned: {
    label: "Devuelta",
    description: "El material se ha devuelto del técnico",
    badgeClassName:
      "border-status-warning/30 bg-status-warning-surface text-status-warning-foreground",
    dotClassName: "bg-status-warning",
  },
  cancelled: {
    label: "Cancelada",
    description: "La petición se ha cancelado",
    badgeClassName: "border-border bg-muted text-muted-foreground",
    dotClassName: "bg-muted-foreground",
  },
  pendingSupplierQuote: {
    label: "Presupuesto pendiente",
    description: "En espera de respuesta del proveedor",
    badgeClassName:
      "border-status-info/30 bg-status-info-surface text-status-info-foreground",
    dotClassName: "bg-status-info",
  },
  materialReceived: {
    label: "Material recibido",
    description:
      "Lo que faltaba se compró y ya ha entrado en el almacén: se puede resolver",
    badgeClassName:
      "border-status-success/30 bg-status-success-surface text-status-success-foreground",
    dotClassName: "bg-status-success",
  },
};

export const SEVERITY_META: Record<
  IncidentSeverity,
  { label: string; badgeClassName: string }
> = {
  low: {
    label: "Baja",
    badgeClassName: "border-border bg-muted text-muted-foreground",
  },
  medium: {
    label: "Media",
    badgeClassName: "border-signal/25 bg-signal/10 text-signal",
  },
  high: {
    label: "Alta",
    badgeClassName:
      "border-status-warning/30 bg-status-warning-surface text-status-warning-foreground",
  },
  critical: {
    label: "Crítica",
    badgeClassName: "border-destructive/25 bg-destructive/10 text-destructive",
  },
};

/** Nombre visible de un equipo del inventario: "Cámara de estudio HDC-3500". */
export function equipmentLabel(equipment: {
  name: string;
  model: string;
}): string {
  return `${equipment.name} ${equipment.model}`.trim();
}

/**
 * ¿La petición corresponde al equipo indicado? Se compara por el id guardado
 * (elegido del inventario) y, si no lo tiene, por coincidencia del modelo en
 * el texto libre (peticiones creadas escribiendo el modelo a mano).
 */
export function requestMatchesEquipment(
  request: { equipmentId?: string; equipment?: string },
  equipment: { _id: string; model: string } | undefined,
): boolean {
  if (!equipment) return true;
  if (request.equipmentId && request.equipmentId === equipment._id) return true;
  const model = equipment.model.trim().toLowerCase();
  if (!model || !request.equipment) return false;
  return request.equipment.toLowerCase().includes(model);
}

/**
 * Resuelve el equipo del inventario asociado a una incidencia:
 * 1) Por `equipmentId` explícito si existe en la lista.
 * 2) Por coincidencia exacta de número de serie (sin falso positivo por modelo si el nº de serie no coincide).
 * 3) Si no hay nº de serie en la incidencia, por modelo único en inventario (o modelo + ubicación única).
 */
export function findMatchingEquipmentForIncident<
  T extends {
    _id: string;
    model: string;
    serialNumber?: string;
    location?: string;
  },
>(
  incident: {
    equipmentId?: string;
    model?: string;
    serialNumber?: string;
    location?: string;
  },
  equipment: readonly T[],
): T | null {
  if (incident.equipmentId) {
    return equipment.find((item) => item._id === incident.equipmentId) ?? null;
  }

  const norm = (value?: string | null) => (value ?? "").trim().toLowerCase();
  const incSerial = norm(incident.serialNumber);
  const incModel = norm(incident.model);
  const incLocation = norm(incident.location);

  if (incSerial !== "") {
    const serialMatches = equipment.filter(
      (item) => norm(item.serialNumber) === incSerial,
    );
    if (serialMatches.length === 0) return null;
    if (serialMatches.length === 1) return serialMatches[0];
    if (incModel !== "") {
      const modelMatches = serialMatches.filter(
        (item) => norm(item.model) === incModel,
      );
      if (modelMatches.length === 1) return modelMatches[0];
    }
    return serialMatches[0];
  }

  if (incModel !== "") {
    const modelMatches = equipment.filter(
      (item) => norm(item.model) === incModel,
    );
    if (modelMatches.length === 1) return modelMatches[0];
    if (modelMatches.length > 1 && incLocation !== "") {
      const locationMatches = modelMatches.filter(
        (item) => norm(item.location) === incLocation,
      );
      if (locationMatches.length === 1) return locationMatches[0];
    }
  }

  return null;
}

/**
 * Comprobación rápida O(1) de si una incidencia sin equipo asignado podría
 * emparejar con un equipo concreto según las mismas reglas de serie/modelo
 * que `findMatchingEquipmentForIncident`. Permite evitar cargar el inventario
 * entero cuando ninguna incidencia sin vincular coincide con el equipo tocado.
 */
export function incidentCouldMatchEquipment(
  incident: {
    equipmentId?: string;
    model?: string;
    serialNumber?: string;
  },
  equipment: {
    _id: string;
    model: string;
    serialNumber?: string;
  },
): boolean {
  if (incident.equipmentId !== undefined) {
    return incident.equipmentId === equipment._id;
  }

  const norm = (value?: string | null) => (value ?? "").trim().toLowerCase();
  const incSerial = norm(incident.serialNumber);
  const incModel = norm(incident.model);

  if (incSerial !== "") {
    const eqSerial = norm(equipment.serialNumber);
    return eqSerial !== "" && incSerial === eqSerial;
  }

  if (incModel !== "") {
    const eqModel = norm(equipment.model);
    return eqModel !== "" && incModel === eqModel;
  }

  return false;
}

export type StockState = "out" | "low" | "ok";

export function stockState(stock: number, minStock: number): StockState {
  if (stock <= 0) return "out";
  if (stock <= minStock) return "low";
  return "ok";
}

export const STOCK_META: Record<
  StockState,
  { label: string; badgeClassName: string }
> = {
  out: {
    label: "Agotado",
    badgeClassName: "border-destructive/25 bg-destructive/10 text-destructive",
  },
  low: {
    label: "Stock bajo",
    badgeClassName:
      "border-status-warning/30 bg-status-warning-surface text-status-warning-foreground",
  },
  ok: {
    label: "Disponible",
    badgeClassName:
      "border-status-success/30 bg-status-success-surface text-status-success-foreground",
  },
};

/** Estados del ciclo de vida de una incidencia. */
export type IncidentStatus =
  | "reported"
  | "assigned"
  | "workshop"
  | "waitingParts"
  | "repairing"
  | "externalRepair"
  | "resolved"
  | "unresolved";

export const INCIDENT_STATUS_META: Record<
  IncidentStatus,
  { label: string; badgeClassName: string; description: string }
> = {
  reported: {
    label: "Nueva",
    badgeClassName: "border-destructive/25 bg-destructive/10 text-destructive",
    description: "Notificada, pendiente de asignar",
  },
  assigned: {
    label: "Asignada",
    badgeClassName: "border-signal/25 bg-signal/10 text-signal",
    description: "En manos de un técnico",
  },
  workshop: {
    label: "En taller",
    badgeClassName:
      "border-status-warning/30 bg-status-warning-surface text-status-warning-foreground",
    description: "Entrada de incidencia a taller abierta",
  },
  waitingParts: {
    label: "En espera de repuestos",
    badgeClassName:
      "border-status-info/30 bg-status-info-surface text-status-info-foreground",
    description:
      "Con una petición de repuestos abierta: no se trabaja hasta que llegue el material",
  },
  repairing: {
    label: "En reparación",
    badgeClassName:
      "border-violet-600/25 bg-violet-600/10 text-violet-700 dark:text-violet-300",
    description:
      "Con el material entregado: el trabajo sigue en el sitio o en el taller",
  },
  externalRepair: {
    label: "En reparación externa",
    badgeClassName:
      "border-indigo-600/25 bg-indigo-600/10 text-indigo-700 dark:text-indigo-300",
    description: "Enviada a una empresa o servicio técnico externo",
  },
  resolved: {
    label: "Resuelta",
    badgeClassName:
      "border-status-success/30 bg-status-success-surface text-status-success-foreground",
    description: "Cerrada con resolución",
  },
  unresolved: {
    label: "Sin resolución",
    badgeClassName: "border-border bg-muted text-muted-foreground",
    description: "Cerrada sin poder resolverla",
  },
};

/**
 * El nombre del estado para pantalla. En los dos estados que conviven con una
 * entrada a taller abierta se añade dónde está el equipo —«En espera de
 * repuestos · taller»—: el estado dice qué le pasa al caso y el sitio, dónde se
 * trabaja. En los demás el sitio ya se lee del propio estado o no viene al caso.
 */
export function incidentStatusLabel(
  status: IncidentStatus,
  inWorkshop: boolean,
): string {
  const label = INCIDENT_STATUS_META[status].label;
  if (status !== "waitingParts" && status !== "repairing") return label;
  return `${label} · ${inWorkshop ? "taller" : "en el sitio"}`;
}

/**
 * La referencia de una incidencia: el número con el que el taller la cita entre
 * sí —«la INC-0004»—, tanto en la cola y en el archivo como de viva voz. No sale
 * del taller: quien notificó sigue su caso por el código que se le dio
 * (`lib/publicCode`).
 *
 * El prefijo y la escritura son los de todas las series del taller
 * (`lib/references`); aquí solo queda dicho cuál de ellas es la incidencia, para
 * que quien la busca —en la cola o en el archivo— no tenga que saberlo.
 */
export const INCIDENT_REFERENCE_PREFIX = REFERENCE_PREFIX.incident;

/** Lo que alguien teclea → la referencia de la incidencia («inc-4» → «INC-0004»). */
export function normalizeIncidentReference(input: string): string | null {
  return normalizeReference("incident", input);
}

/**
 * ¿Lo escrito tiene forma de referencia —«INC-0004», «inc 4», «incidencia 12» o el
 * número suelto— y no de otra cosa?
 *
 * `normalizeIncidentReference` es más listo que esto a propósito: saca el número
 * de donde sea, porque en la cola del taller interesa encontrar la incidencia
 * aunque la referencia venga dentro de una frase. Aquí no: lo que se busca es
 * reconocer el caso de quien teclea una referencia creyendo que es otra cosa, y
 * para eso el número tiene que estar solo —el prefijo, con guion o espacio, y
 * nada más—. Un código a medias, como «A7K2», no cuela: lleva letras y números
 * mezclados, que es justo lo que una referencia no hace.
 */
export function looksLikeIncidentReference(input: string): boolean {
  return /^\s*(?:inc(?:idencia)?)?[\s-]*\d{1,9}\s*$/i.test(input);
}

/**
 * ¿Esta incidencia es la que se busca? Por sus datos —igual que el resto de
 * listas del panel— o por su referencia escrita a mano: «INC-0004», «inc-4» o
 * el número suelto. Los ceros de delante son un detalle del formato, no algo
 * que nadie teclee, y la referencia es lo que se le dio a quien notificó la
 * avería: tiene que encontrarse como la escriba.
 */
export function matchesIncidentQuery(
  fields: readonly (string | undefined)[],
  reference: string,
  query: string,
): boolean {
  return (
    matchesQuery(fields, query) ||
    reference === normalizeIncidentReference(query)
  );
}

/** Filtros de la cola de incidencias, en orden de avance del flujo. */
export const INCIDENT_FILTERS: { id: IncidentStatus | "all"; label: string }[] =
  [
    { id: "all", label: "Todas" },
    { id: "reported", label: "Nuevas" },
    { id: "assigned", label: "Asignadas" },
    { id: "workshop", label: "En taller" },
    { id: "waitingParts", label: "Esperando repuestos" },
    { id: "repairing", label: "En reparación" },
    { id: "externalRepair", label: "Reparación externa" },
    { id: "resolved", label: "Resueltas" },
    { id: "unresolved", label: "Sin resolución" },
  ];

/** Tipos de intervención del historial de mantenimiento. */
export type MaintenanceKind = "repair" | "preventive";

export const MAINTENANCE_META: Record<
  MaintenanceKind,
  { label: string; badgeClassName: string }
> = {
  repair: {
    label: "Avería",
    badgeClassName: "border-destructive/25 bg-destructive/10 text-destructive",
  },
  preventive: {
    label: "Preventivo",
    badgeClassName: "border-signal/25 bg-signal/10 text-signal",
  },
};

export type ReviewState = "none" | "ok" | "overdue";

/**
 * Próxima revisión preventiva: la última intervención preventiva (o la fecha
 * de alta del equipo si aún no hay ninguna) más el intervalo del plan.
 * `state`: "none" sin plan, "ok" al día, "overdue" revisión vencida.
 */
export function nextReview(
  records: { kind: MaintenanceKind; performedAt: number }[],
  intervalDays?: number | null,
  fallback?: number | null,
): { state: ReviewState; dueAt: number | null } {
  if (!intervalDays || intervalDays <= 0) {
    return { state: "none", dueAt: null };
  }
  let latest: number | null = null;
  for (const record of records) {
    if (
      record.kind === "preventive" &&
      (latest === null || record.performedAt > latest)
    ) {
      latest = record.performedAt;
    }
  }
  const base = latest ?? fallback;
  if (base === undefined || base === null) {
    return { state: "none", dueAt: null };
  }
  const dueAt = base + intervalDays * 24 * 60 * 60 * 1000;
  return { state: dueAt < Date.now() ? "overdue" : "ok", dueAt };
}

/** "hace 2 h", "hace 3 d"... */
export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "ahora mismo";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days} d`;
  return new Date(timestamp).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  });
}

/** "5 oct 2026, 09:41" */
export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "05 oct 2026" — solo fecha, para la ficha de los equipos. */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

/* ------------------------------------------------------------------ */
/* Notas del ciclo de vida                                             */
/* ------------------------------------------------------------------ */

/**
 * Margen que tiene quien escribe una nota para corregirla o retirarla. Pasado
 * ese rato la nota ya es histórico del expediente: se puede añadir otra, pero
 * no reescribir la anterior. Retirarla, en cambio, es reversible siempre: la
 * nota queda oculta y vuelve al cuaderno cuando se recupera.
 */
export const NOTE_EDIT_WINDOW_MS = 15 * 60 * 1000;

/**
 * ¿Sigue dentro del plazo para cambiarla? Se cuenta desde que se escribió de
 * verdad (`createdAt`), no desde la fecha del hilo (`at`), que puede ser
 * retroactiva al reconstruir el historial.
 */
export function isNoteWithinEditWindow(
  writtenAt: number,
  now: number = Date.now(),
): boolean {
  const elapsed = now - writtenAt;
  return elapsed >= 0 && elapsed <= NOTE_EDIT_WINDOW_MS;
}

/** Momento en el que se cierra el plazo de una nota escrita en ese instante. */
export function noteEditDeadline(writtenAt: number): number {
  return writtenAt + NOTE_EDIT_WINDOW_MS;
}

/**
 * Las notas que siguen en el cuaderno. Una retirada no se pierde: sale del
 * hilo y espera en la ficha a que alguien la recupere, así que todo lo que
 * enseña el cuaderno —la ficha, el informe, la búsqueda y el aviso de trabajo
 * sin constancia— mira por aquí.
 */
export function liveNotes<T extends { deletedAt?: number }>(
  notes: readonly T[] | undefined,
): T[] {
  return (notes ?? []).filter((note) => note.deletedAt === undefined);
}

/** Las notas retiradas, que se pueden recuperar desde la ficha. */
export function retiredNotes<T extends { deletedAt?: number }>(
  notes: readonly T[] | undefined,
): T[] {
  return (notes ?? []).filter((note) => note.deletedAt !== undefined);
}

/** Una versión anterior de una nota: lo que decía y cuándo se sustituyó. */
export interface NoteVersion {
  note: string;
  at: number;
}

/**
 * Correcciones de una nota, de la más reciente a la más antigua: lo que decía
 * antes de cada cambio y cuándo se cambió, para poder reconstruirla. Se guarda
 * en orden cronológico, así que aquí se le da la vuelta: lo último primero es
 * como se lee un historial. Vacío si la nota nunca se corrigió.
 */
export function noteVersions(entry: {
  versions?: readonly NoteVersion[];
}): NoteVersion[] {
  return [...(entry.versions ?? [])].reverse();
}

/** Una corrección de una nota, con las diferencias que introdujo. */
export interface NoteVersionChange extends RichDocChanges {
  /**
   * Posición de la versión en el historial guardado (de la más antigua a la
   * más reciente). Es lo que identifica la versión para volver a ella: la fecha
   * no sirve de nada, porque dos correcciones seguidas pueden caer en el mismo
   * instante. El historial solo crece por el final, así que la posición de una
   * versión no cambia.
   */
  index: number;
  /** Cuándo se sustituyó ese texto. */
  at: number;
  /** El texto que la sustituyó (la versión siguiente, o la nota actual). */
  to: string;
}

/**
 * Las correcciones de una nota con sus diferencias: cada versión guardada
 * comparada con el texto que la sustituyó —la versión siguiente, o la nota tal
 * y como está ahora—, de la corrección más reciente hacia atrás. Cada paso se
 * lee como el cambio que fue: lo que se añadió y lo que se quitó en ese
 * momento, no el acumulado de todas las correcciones.
 *
 * La comparación es por bloques: los dos documentos se emparejan bloque a
 * bloque (párrafo con párrafo, lista con lista, imagen con imagen) y solo
 * dentro de la pareja que cambió se miran las palabras. Así una nota nueva que
 * llevaba formato se compara por lo que se lee, y un párrafo que apareció
 * entero se marca como el bloque que es.
 */
export function noteVersionChanges(entry: {
  note: string;
  versions?: readonly NoteVersion[];
}): NoteVersionChange[] {
  // `noteVersions` devuelve la más reciente primero; la posición que se
  // conserva es la del historial guardado, así que se cuenta al revés.
  const versions = noteVersions(entry);
  const total = versions.length;
  const current = richDocBlocks(entry.note);
  return versions.map((version, index) => {
    const next =
      index === 0 ? current : richDocBlocks(versions[index - 1].note);
    return {
      index: total - 1 - index,
      at: version.at,
      to: richDocToPlainText(next),
      ...diffRichDoc(richDocBlocks(version.note), next),
    };
  });
}

/**
 * La última vez que una nota se devolvió a una versión anterior de su
 * historial: quién lo hizo, cuándo y de qué versión se trajo el texto.
 */
export interface NoteRestoration {
  /** Cuándo se restauró. */
  at: number;
  /** Quién la restauró. */
  by: string;
  /** Posición de la versión restaurada en el historial; `null` si no se anotó. */
  version: number | null;
  /** Cuándo se sustituyó esa versión (su fecha, para nombrarla); `null` si no consta. */
  from: number | null;
}

/**
 * La última restauración de una nota, o `null` si nunca se devolvió atrás. La
 * constancia vive en la propia nota —quién, cuándo y a qué versión—, así que se
 * lee igual en la ficha y en el informe: es lo que distingue un retroceso a lo
 * que decía antes de una corrección escrita a mano.
 */
export function noteRestoration(entry: {
  versions?: readonly NoteVersion[];
  restoredAt?: number;
  restoredBy?: string;
  restoredVersion?: number;
}): NoteRestoration | null {
  if (entry.restoredAt === undefined) return null;
  const version = entry.restoredVersion;
  return {
    at: entry.restoredAt,
    by: entry.restoredBy ?? "—",
    version: version ?? null,
    from:
      version === undefined ? null : (entry.versions?.[version]?.at ?? null),
  };
}

/**
 * La posición del historial a la que hay que volver para deshacer una
 * restauración, o `null` si esa restauración no cambiaría nada.
 *
 * Devolver la nota a una versión anterior archiva el texto que la nota dice
 * ahora al final del historial, así que deshacer es volver a esa última
 * posición: allí queda lo que la restauración acaba de quitar. Y si la versión
 * elegida ya dice lo mismo que la nota, el backend no archiva ni cambia nada,
 * por lo que tampoco hay nada que deshacer.
 */
export function noteRestoreUndoIndex(
  entry: { note: string; versions?: readonly NoteVersion[] },
  versionIndex: number,
): number | null {
  const versions = entry.versions ?? [];
  const version = versions[versionIndex];
  if (version === undefined || version.note === entry.note) return null;
  return versions.length;
}

/**
 * El tamaño de un archivo, para leerlo de un vistazo: «198 KB», «4,9 MB». Los
 * bytes no se enseñan —nadie decide nada con ellos— y de cero para abajo se dice
 * «0 KB», que es lo que hay cuando el archivo ya no está.
 */
export function formatFileSize(bytes: number): string {
  if (!(bytes > 0)) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("es-ES", {
    maximumFractionDigits: 1,
  })} MB`;
}

/** "18:12" — solo la hora, para decir hasta cuándo se puede corregir. */
export function formatClockTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ------------------------------------------------------------------ */
/* Documentos del expediente y su rastro de auditoría                  */
/* ------------------------------------------------------------------ */

/**
 * Cambios que el rastro de auditoría anota de un documento adjunto. Son los
 * mismos valores que guarda el backend (`DOCUMENT_ACTIONS` en el esquema).
 * «editado» cubre el renombrado y la corrección de la nota del adjunto: en el
 * rastro se distinguen por si traen `previousName`. «reemplazado» es otra cosa:
 * el archivo que había se sustituyó y el anterior ya no está en el almacén.
 */
export type DocumentTrailAction =
  "attached" | "edited" | "replaced" | "removed";

/**
 * Frase con la que el rastro cuenta cada cambio: quién viene aparte, esto es
 * solo lo que pasó con el documento.
 */
export function documentTrailLabel(entry: {
  action: DocumentTrailAction;
  name: string;
  previousName?: string;
}): string {
  if (entry.action === "attached") return `Adjuntó «${entry.name}»`;
  if (entry.action === "removed") return `Quitó «${entry.name}»`;
  if (entry.action === "replaced") {
    return entry.previousName
      ? `Reemplazó el archivo de «${entry.previousName}» y lo renombró a «${entry.name}»`
      : `Reemplazó el archivo de «${entry.name}»`;
  }
  return entry.previousName
    ? `Renombró «${entry.previousName}» a «${entry.name}»`
    : `Actualizó la ficha de «${entry.name}»`;
}

/* ------------------------------------------------------------------ */
/* Incidencias en curso sin constancia del técnico                     */
/* ------------------------------------------------------------------ */

/**
 * Margen con el que nace el aviso: días que puede llevar una incidencia en
 * curso sin que quien la trabaja haya escrito una sola nota. Pasado ese margen
 * el panel avisa: es el caso de un trabajo que avanza sin dejar rastro en el
 * cuaderno. Quien coordina puede cambiarlo desde el panel (`alertSettings`),
 * así que este es solo el valor de partida (el que se enseña mientras cargan
 * los ajustes guardados).
 */
export const DEFAULT_WORK_WITHOUT_TRACE_DAYS = 3;

/** Límites razonables del margen configurable, en días. */
export const MIN_WORK_WITHOUT_TRACE_DAYS = 1;
export const MAX_WORK_WITHOUT_TRACE_DAYS = 30;

/**
 * A quién le llega el aviso mientras no se configure otra cosa: a quien
 * coordina el taller. Un rol personalizado entra solo si quien coordina lo
 * añade a mano, y uno que no coordine (el técnico) también, si lo elige.
 */
export const DEFAULT_WORK_WITHOUT_TRACE_ROLES: readonly RoleKey[] =
  COORDINATION_ROLES;

/**
 * ¿Le toca a este rol ver el aviso? Manda la lista guardada: si un rol no está
 * en ella no lo ve, aunque coordine incidencias; y si se añade uno que no
 * coordina (p. ej. el técnico), también lo ve. Es el reparto de un aviso, no un
 * permiso: abrir la incidencia que el aviso señala se rige por los permisos de
 * siempre.
 */
export function alertReachesRole(
  role: RoleKey | null | undefined,
  roleKeys: readonly RoleKey[],
): boolean {
  return role !== null && role !== undefined && roleKeys.includes(role);
}

/**
 * Cuándo empezó el trabajo, según la ficha de la incidencia: el paso a
 * «asignada» es el que lo marca (la derivación a taller, si la hay, es un paso
 * posterior del mismo trabajo). Devuelve null si no está en curso, o si el
 * historial no dice cuándo se asignó (entonces el aviso no se arriesga).
 */
export function inProgressSince(incident: {
  status: IncidentStatus;
  history: { status: IncidentStatus; at: number }[];
}): number | null {
  // En curso: la máquina de la incidencia (`lib/incidentFlow`) lo dice una vez.
  if (!isIncidentInProgress(incident.status)) {
    return null;
  }
  const assigned = incident.history.find(
    (entry) => entry.status === "assigned",
  );
  return assigned?.at ?? null;
}

/**
 * ¿Hay algo escrito por quien la trabaja ahora? Cuentan las notas de quien la
 * tiene asignada (o de su orden de taller); las de quien coordina no tapan el
 * hueco que busca este aviso, y si la incidencia cambia de manos el aviso
 * vuelve: quien la lleva ahora tiene que dejar su propia constancia. Las notas
 * antiguas sin firma sí cuentan: algo se anotó, aunque ya no se sepa quién. Las
 * retiradas no cuentan: si se sacaron del cuaderno, el hueco sigue ahí.
 */
export function hasTechnicianNote(incident: {
  assigneeId?: string;
  workshopAssigneeId?: string;
  lifecycleNotes?: { authorId?: string; deletedAt?: number }[];
}): boolean {
  const workers = [incident.assigneeId, incident.workshopAssigneeId].filter(
    (id): id is string => id !== undefined,
  );
  return liveNotes(incident.lifecycleNotes).some(
    (note) => note.authorId === undefined || workers.includes(note.authorId),
  );
}

/**
 * Días que lleva en curso sin dejar constancia, o null si no es el caso: no
 * está en curso, su técnico ya escribió algo, o todavía no ha pasado el margen
 * (el de partida salvo que quien coordina haya configurado otro).
 */
export function workWithoutTraceDays(
  incident: {
    status: IncidentStatus;
    history: { status: IncidentStatus; at: number }[];
    assigneeId?: string;
    workshopAssigneeId?: string;
    lifecycleNotes?: { authorId?: string; deletedAt?: number }[];
  },
  now: number = Date.now(),
  marginDays: number = DEFAULT_WORK_WITHOUT_TRACE_DAYS,
): number | null {
  const since = inProgressSince(incident);
  if (since === null) return null;
  if (hasTechnicianNote(incident)) return null;
  const days = Math.floor((now - since) / (24 * 60 * 60 * 1000));
  return days >= marginDays ? days : null;
}

export interface ErrorVisibilityEnv {
  VITE_APP_ENV?: string;
  VITE_ERROR_DETAILS?: string;
  DEV?: boolean;
  PROD?: boolean;
}

/**
 * Determina si se deben mostrar detalles técnicos de errores inesperados.
 * En builds de producción (`PROD`) se ocultan por defecto salvo que el entorno
 * indique explícitamente `VITE_APP_ENV=development` o `VITE_ERROR_DETAILS=true`.
 */
export function isDetailedErrorsEnabled(env?: ErrorVisibilityEnv): boolean {
  const source =
    env ??
    (typeof import.meta !== "undefined"
      ? (import.meta as unknown as { env?: ErrorVisibilityEnv }).env
      : undefined);
  if (!source) return false;

  const override = String(source.VITE_ERROR_DETAILS ?? "")
    .trim()
    .toLowerCase();
  if (override === "true" || override === "1") return true;
  if (override === "false" || override === "0") return false;

  const appEnv = String(source.VITE_APP_ENV ?? "")
    .trim()
    .toLowerCase();
  if (appEnv === "production" || appEnv === "prod") return false;
  if (appEnv === "development" || appEnv === "dev") return true;

  if (source.PROD === true && source.DEV !== true) return false;
  return source.DEV === true;
}

const TECHNICAL_ERROR_PATTERNS = [
  /\[CONVEX\b/i,
  /\bRequest ID:/i,
  /\bServer Error\b/i,
  /\bValidator error:/i,
  /\bArgumentValidationError\b/i,
  /\b(TypeError|ReferenceError|SyntaxError|RangeError):/i,
  /\b(ECONNREFUSED|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|EACCES)\b/,
  /\bfetch failed\b/i,
  /\bsocket hang up\b/i,
  /\bHTTP\s+5\d{2}\b/i,
  /\bhost\.docker\.internal\b/i,
  /\b127\.0\.0\.1:\d+/,
  /\berror sending request for url\b/i,
  /\btcp connect error\b/i,
  /\bNetwork is unreachable\b/i,
  /\bos error \d+\b/i,
  /\n\s+at\s+/,
];

const CONNECTION_ERROR_PATTERNS = [
  /\b(ECONNREFUSED|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN)\b/,
  /\bfetch failed\b/i,
  /\bsocket hang up\b/i,
  /No se pudo hablar con el (servicio|relevo)/i,
  /\berror sending request for url\b/i,
  /\btcp connect error\b/i,
  /\bNetwork is unreachable\b/i,
  /\bHTTP\s+5\d{2}\b/i,
];

/**
 * Reemplaza detalles técnicos internos por un mensaje legible y seguro para el usuario.
 */
export function sanitizeUserError(
  message: string,
  fallback = "Se ha producido un error inesperado. Inténtalo de nuevo.",
): string {
  const clean = message.trim();
  if (!clean) return fallback;
  const isTechnical = TECHNICAL_ERROR_PATTERNS.some((p) => p.test(clean));
  if (!isTechnical) return clean;
  if (CONNECTION_ERROR_PATTERNS.some((p) => p.test(clean))) {
    return "No se pudo conectar con el servicio externo. Inténtalo de nuevo más tarde.";
  }
  return fallback;
}

/**
 * Formatea un texto de error almacenado (p. ej. en base de datos) según el entorno.
 */
export function formatUiError(
  message: string | null | undefined,
  options?: { detailed?: boolean; fallback?: string },
): string {
  const fallback =
    options?.fallback ?? "Se ha producido un error inesperado. Inténtalo de nuevo.";
  if (!message || !message.trim()) return fallback;
  const detailed = options?.detailed ?? isDetailedErrorsEnabled();
  return detailed ? message : sanitizeUserError(message, fallback);
}

/**
 * Determina en backend (`APP_ENV` / `NODE_ENV`) si se devuelven detalles técnicos.
 * Si `APP_ENV=production` o `NODE_ENV=production` (sin `APP_ENV=development`),
 * oculta detalles técnicos.
 */
export function isBackendDetailedErrors(
  appEnv?: string,
  nodeEnv?: string,
): boolean {
  const env = (appEnv ?? "").trim().toLowerCase();
  if (env === "production" || env === "prod") return false;
  if (env === "development" || env === "dev") return true;
  return (nodeEnv ?? "").trim().toLowerCase() !== "production";
}

/**
 * Formatea un error en el backend según `APP_ENV` / `NODE_ENV`.
 */
export function formatBackendError(
  rawError: string,
  options?: { appEnv?: string; nodeEnv?: string; fallback?: string },
): string {
  if (isBackendDetailedErrors(options?.appEnv, options?.nodeEnv)) {
    return rawError;
  }
  return sanitizeUserError(rawError, options?.fallback);
}

/** Extrae el texto bruto de un error (ConvexError, Error o cadena) sin sanitizar. */
export function extractRawErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof ConvexError && typeof error.data === "string") {
    return error.data;
  }
  if (error instanceof Error) {
    const match = /Uncaught ConvexError:\s*(.+?)(?:\n|$)/.exec(error.message);
    if (match?.[1]) {
      return match[1].replace(/["\\]+$/, "");
    }
    return error.message;
  }
  return "";
}

/** Extrae un mensaje legible de un error de Convex para mostrarlo en un toast. */
export function getErrorMessage(
  error: unknown,
  options?: { detailed?: boolean },
): string {
  const detailed = options?.detailed ?? isDetailedErrorsEnabled();
  const raw = extractRawErrorMessage(error);
  if (!raw) return "Se ha producido un error. Inténtalo de nuevo.";
  if (detailed) return raw;
  const sanitized = sanitizeUserError(raw);
  if (error instanceof Error && !(error instanceof ConvexError) && sanitized !== raw.trim()) {
    console.error("[AppError]", error);
  }
  return sanitized;
}
