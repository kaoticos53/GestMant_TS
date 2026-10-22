import type { PurchaseRequestDoc } from "@/lib/purchasing";

/** Tipos de acción modal que pueden ejecutarse sobre una petición de compra pendiente. */
export type PurchaseActionType = "supplier" | "note" | "cancel";

/** Objetivo activo del diálogo modal de acción. */
export interface PurchaseActionTarget {
  request: PurchaseRequestDoc;
  action: PurchaseActionType;
}

/** Estado de validación de la selección de peticiones de compra para generar una orden. */
export interface PurchaseSelectionValidation {
  /** Peticiones sin tratar seleccionadas */
  selectedItems: PurchaseRequestDoc[];
  /** Número total de artículos seleccionados */
  count: number;
  /** Nombres de los proveedores presentes en la selección */
  suppliers: string[];
  /** Indica si la selección contiene un único proveedor */
  isSingleSupplier: boolean;
  /** Mensaje contextual para la barra de creación de orden */
  feedbackMessage: string;
  /** Indica si es posible abrir el diálogo de creación de orden */
  canCreateOrder: boolean;
}
