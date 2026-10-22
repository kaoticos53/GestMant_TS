import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DEFAULT_TRASH_RETENTION_DAYS } from "@/lib/trash";
import {
  buildTrashedIncidentRows,
  buildTrashedRequestRows,
  partitionByArchived,
} from "../helpers/trashRows";
import type { TrashRow } from "../types";

export interface UseArchiveDataParams {
  canArchiveIncidents?: boolean;
  canArchiveRequests?: boolean;
  canViewCatalog?: boolean;
  canViewEquipment?: boolean;
}

/**
 * Hook de aplicación que encapsula la carga condicional de colecciones de Convex
 * para el módulo de archivo, particionando en memoria los elementos archivados
 * frente a activos y formateando las filas de papelera de incidencias y peticiones.
 */
export function useArchiveData({
  canArchiveIncidents = false,
  canArchiveRequests = false,
  canViewCatalog = false,
  canViewEquipment = false,
}: UseArchiveDataParams) {
  // Carga de colecciones
  const allIncidents =
    useQuery(api.incidents.list, { includeArchived: true }) ?? [];
  const allRequests =
    useQuery(api.partRequests.list, { includeArchived: true }) ?? [];
  const parts =
    useQuery(api.spareParts.list, canViewCatalog ? {} : "skip") ?? [];
  const equipment =
    useQuery(api.equipment.list, canViewEquipment ? {} : "skip") ?? [];

  const { archived: incidents, active: activeIncidents } =
    partitionByArchived(allIncidents);
  const { archived: requests, active: activeRequests } =
    partitionByArchived(allRequests);

  // Consultas de papelera
  const queryIncidentTrash = useQuery(
    api.incidents.trash,
    canArchiveIncidents ? {} : ("skip" as const),
  );
  const queryRequestTrash = useQuery(
    api.partRequests.trash,
    canArchiveRequests ? {} : ("skip" as const),
  );

  const trashedIncidents = queryIncidentTrash?.items ?? [];
  const trashedRequests = queryRequestTrash?.items ?? [];
  const trashRetentionDays =
    queryIncidentTrash?.retentionDays ??
    queryRequestTrash?.retentionDays ??
    DEFAULT_TRASH_RETENTION_DAYS;

  const trashedIncidentRows: Extract<TrashRow, { kind: "incident" }>[] =
    buildTrashedIncidentRows(trashedIncidents, canArchiveIncidents);
  const trashedRequestRows: Extract<TrashRow, { kind: "request" }>[] =
    buildTrashedRequestRows(trashedRequests, canArchiveRequests);

  return {
    allIncidents,
    allRequests,
    incidents,
    requests,
    activeIncidents,
    activeRequests,
    parts,
    equipment,
    trashedIncidentRows,
    trashedRequestRows,
    trashRetentionDays,
  };
}
