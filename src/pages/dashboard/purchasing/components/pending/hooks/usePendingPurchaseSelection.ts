import { isPurchaseRequestUntreated } from "@/lib/purchaseFlow";
import type { PurchaseRequestDoc } from "@/lib/purchasing";
import { useMemo, useState } from "react";
import type { PurchaseSelectionValidation } from "../types";

/**
 * Evalúa las reglas de negocio de la selección de peticiones de compra:
 * - Filtra las peticiones que están marcadas y cuyo estado es no tratado.
 * - Comprueba la regla de proveedor único por orden de compra.
 * - Genera el mensaje de estado para el operador de compras.
 */
export function evaluatePurchaseSelection(
  purchaseRequests: readonly PurchaseRequestDoc[],
  selectedIds: ReadonlySet<string>,
): PurchaseSelectionValidation {
  const selectedItems = purchaseRequests.filter(
    (row) => isPurchaseRequestUntreated(row.status) && selectedIds.has(row._id),
  );

  const suppliersSet = new Set(selectedItems.map((row) => row.supplier));
  const suppliers = [...suppliersSet];
  const count = selectedItems.length;
  const isSingleSupplier = suppliers.length === 1;

  let feedbackMessage: string;
  if (count === 0) {
    feedbackMessage = "Marca lo que va en la orden: se agrupa por proveedor.";
  } else if (suppliers.length > 1) {
    feedbackMessage = "Has mezclado proveedores: una orden es de uno solo.";
  } else {
    feedbackMessage = `${count} artículo${count === 1 ? "" : "s"} para ${suppliers[0]}`;
  }

  // Quién puede montar la orden lo pregunta el botón a `<Can>`; aquí solo se
  // mira si la selección sirve —algo marcado y de un solo proveedor—.
  const canCreateOrder = count > 0 && isSingleSupplier;

  return {
    selectedItems,
    count,
    suppliers,
    isSingleSupplier,
    feedbackMessage,
    canCreateOrder,
  };
}

/**
 * Hook para gestionar la selección de peticiones de compra y la creación de órdenes.
 */
export function usePendingPurchaseSelection(
  purchaseRequests: readonly PurchaseRequestDoc[],
) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);

  const validation = useMemo(
    () => evaluatePurchaseSelection(purchaseRequests, selectedIds),
    [purchaseRequests, selectedIds],
  );

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleGroup = (items: readonly PurchaseRequestDoc[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = items.every((item) => next.has(item._id));
      for (const item of items) {
        if (allSelected) {
          next.delete(item._id);
        } else {
          next.add(item._id);
        }
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const isGroupFullySelected = (
    items: readonly PurchaseRequestDoc[],
  ): boolean =>
    items.length > 0 && items.every((item) => selectedIds.has(item._id));

  return {
    selectedIds,
    isOrderDialogOpen,
    setIsOrderDialogOpen,
    validation,
    toggleItem,
    toggleGroup,
    clearSelection,
    isGroupFullySelected,
  };
}
