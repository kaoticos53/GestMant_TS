import type { Id } from "@/convex/_generated/dataModel";
import type { AuditFilters, AuditPresetId, AuditRange } from "@/lib/audit";
import type { QueueSortOption } from "../QueueToolbar";
import type { DocumentTrailAction, IncidentStatus } from "@/lib/workshop";

/** Props de la vista principal de auditoría. */
export interface AuditViewProps {
  /** Abre la ficha de una incidencia en la cola (solo si no está archivada). */
  onOpenIncident: (id: Id<"incidents">) => void;
}

/** Órdenes del rastro: la fecha del movimiento es lo que lo ordena todo. */
export const AUDIT_SORT_OPTIONS: QueueSortOption[] = [
  { id: "recent", label: "Movimiento: lo último primero" },
  { id: "oldest", label: "Movimiento: lo más antiguo primero" },
];

/** Valor del desplegable de persona cuando no se filtra por ninguna. */
export const AUDIT_EVERYONE = "all";

/** Valor del desplegable de tipo cuando no se filtra por ninguno. */
export const AUDIT_EVERY_KIND = "all";

/** Entrada del rastro de auditoría de documentos. */
export interface AuditEntry {
  _id: string;
  incidentId: Id<"incidents">;
  reference: string;
  title: string;
  action: DocumentTrailAction;
  name: string;
  previousName?: string;
  by: string;
  byId: string;
  at: number;
  status?: IncidentStatus;
  archived: boolean;
}

/** Autor con número de movimientos para el filtro de personas. */
export interface AuditAuthor {
  id: Id<"users">;
  name: string;
  movements: number;
}

/** Resumen global devuelto por el servidor Convex. */
export interface AuditQueryResult {
  entries: AuditEntry[];
  authors: AuditAuthor[];
  unfilteredTotal: number;
  summary: {
    total: number;
    people: number;
    incidents: number;
    byAction: Record<DocumentTrailAction, number>;
  };
}

/** Props para la tarjeta superior informativa. */
export interface AuditHeaderCardProps {
  rango: AuditRange;
  audit: AuditQueryResult | undefined;
}

/** Props para la tarjeta de filtros. */
export interface AuditFiltersCardProps {
  filters: AuditFilters;
  authors: AuditAuthor[];
  activePreset: string;
  filterCount: number;
  search: string;
  sortedCount: number;
  summary: {
    total: number;
    people: number;
    incidents: number;
  };
  breakdown: string[];
  onApplyFilters: (
    next: AuditFilters | ((current: AuditFilters) => AuditFilters),
  ) => void;
  onApplyPreset: (presetId: Exclude<AuditPresetId, "custom">) => void;
  onResetFilters: () => void;
  onExport: () => void;
}

/** Props para el renderizado de una fila individual de movimiento. */
export interface AuditMovementRowProps {
  entry: AuditEntry;
  compact: boolean;
  onOpenIncident: (id: Id<"incidents">) => void;
}

/** Props para una sección agrupada por día. */
export interface AuditGroupSectionProps {
  label: string;
  compact: boolean;
  entries: AuditEntry[];
  onOpenIncident: (id: Id<"incidents">) => void;
}
