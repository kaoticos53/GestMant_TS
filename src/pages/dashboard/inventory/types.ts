import type { Doc } from "@/convex/_generated/dataModel";

export type PartDoc = Doc<"spareParts">;
export type EquipmentModelDoc = Doc<"equipmentModels">;

/** Cuántos equipos enseña a la vez la búsqueda de compatibles. */
export const COMPATIBLE_RESULTS = 6;

export interface InventoryViewProps {
  /** Solo responsable de repuestos/admin escriben en el catálogo (fail-closed). */
  canManage?: boolean;
  /** Quién mira: su orden de la tabla se recuerda aparte del de los demás. */
  currentUserId?: string | null;
  /** Texto con el que se abre la vista (viene de la búsqueda global). */
  initialSearch?: string;
  /** Abre la tabla mostrando solo lo que está por debajo del mínimo */
  initialLowStockOnly?: boolean;
}
