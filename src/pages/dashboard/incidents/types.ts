import type { Doc } from "@/convex/_generated/dataModel";
import type { IncidentStatus } from "@/lib/workshop";
import type { QueueSortOption } from "../QueueToolbar";

/**
 * La incidencia tal y como la sirve la cola: sus documentos llegan con el
 * enlace del archivo ya resuelto, para poder abrirlo desde la ficha. Los
 * documentos sin archivo (los viajan solo con su nombre) quedan con `url`
 * ausente o nula, y la ficha los marca como tales.
 */
export type IncidentDoc = Omit<Doc<"incidents">, "documents"> & {
  documents?: (NonNullable<Doc<"incidents">["documents"]>[number] & {
    url?: string | null;
  })[];
};

export type EquipmentDoc = Doc<"equipment">;

/** Orden de la cola: primero lo que está esperando acción. */
export const STATUS_RANK: Record<IncidentStatus, number> = {
  reported: 0,
  assigned: 1,
  workshop: 2,
  unresolved: 3,
  resolved: 4,
};

/** Órdenes disponibles cuando el histórico es largo. */
export const SORT_OPTIONS: QueueSortOption[] = [
  { id: "recent", label: "Fecha: más recientes primero" },
  { id: "oldest", label: "Fecha: más antiguas primero" },
  { id: "queue", label: "Orden de trabajo: pendientes primero" },
];
