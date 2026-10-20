/**
 * El recorrido de una orden de compra, para leerlo de un vistazo en su ficha.
 *
 * Tres etapas y un final: **enviada → recibiendo → completada**, y ese último
 * tramo se llama «Anulada» cuando la orden se anuló. Una orden anulada que ya
 * tenía material dentro pasó por «recibiendo» y se pinta como tal; la que se anuló
 * sin que llegara nada deja esa etapa en punteado —no se finge un paso que no
 * ocurrió—.
 *
 * Lo que se puede hacer con la orden lo decide la máquina de `lib/purchaseFlow`
 * (`canAdvancePurchaseOrder`); aquí solo se cuenta, como en el resto de fichas.
 * La forma de las etapas y de los motivos es la de `lib/journey`.
 */

import type { BlockedJourneyStep, JourneyStage } from "./journey";
import {
  PURCHASE_ORDER_STATUS_META,
  type PurchaseOrderStatus,
} from "./purchasing";
import {
  canAdvancePurchaseOrder,
  isPurchaseOrderClosed,
  PURCHASE_ORDER_SHEET_STEPS,
  PURCHASE_ORDER_STEP_LABELS,
  purchaseOrderStepBlocker,
  type PurchaseOrderAction,
} from "./purchaseFlow";

/** Cuál de los tramos del recorrido de una orden. */
export type OrderJourneyStageKey = "sent" | "receiving" | "closed";

/**
 * El recorrido de la orden. `received` dice si ha entrado algo: es lo que
 * distingue una anulada que llegó a recepcionar de una que se quedó en el envío.
 */
export function orderJourney(
  status: PurchaseOrderStatus,
  { received }: { received: boolean },
): JourneyStage[] {
  const sent: JourneyStage = {
    key: "sent",
    label: "Enviada",
    // Una orden existe porque se mandó al proveedor: esa etapa siempre se pasó.
    state: status === "pending" ? "current" : "done",
  };

  const receiving: JourneyStage = {
    key: "receiving",
    label: "Recibiendo",
    state:
      status === "partial"
        ? "current"
        : status === "completed"
          ? "done"
          : status === "cancelled"
            ? received
              ? "done"
              : "skipped"
            : "pending",
  };

  const closed: JourneyStage = {
    key: "closed",
    label: isPurchaseOrderClosed(status)
      ? PURCHASE_ORDER_STATUS_META[status].label
      : PURCHASE_ORDER_STATUS_META.completed.label,
    state: isPurchaseOrderClosed(status) ? "current" : "pending",
  };

  return [sent, receiving, closed];
}

/**
 * El paso que toca ahora, de los que ofrece la ficha, para quien gestiona las
 * compras: recepcionar lo que falta. Una orden completada o anulada no tiene
 * ninguno y el motivo lo pone la ficha.
 */
export function nextPurchaseOrderAction(
  status: PurchaseOrderStatus,
  { canManage }: { canManage: boolean },
): PurchaseOrderAction | null {
  if (!canManage) return null;
  return canAdvancePurchaseOrder(status, "receive") ? "receive" : null;
}

/** Cómo se lee el paso en la ficha. */
export const NEXT_ORDER_STEP_LABELS: Partial<
  Record<PurchaseOrderAction, string>
> = {
  receive: "Recepcionar el material que falta",
};

/**
 * Los pasos de la ficha que la máquina no deja dar desde aquí, con su motivo.
 *
 * Los dos —recepcionar y anular— se dan con la orden abierta y solo se bloquean
 * cuando ya está cerrada, así que su motivo vive bajo el último tramo: el que
 * cuenta cómo terminó («Completada» o «Anulada»).
 */
export function blockedJourneySteps(
  status: PurchaseOrderStatus,
  steps: readonly PurchaseOrderAction[] = PURCHASE_ORDER_SHEET_STEPS,
): BlockedJourneyStep<PurchaseOrderAction>[] {
  return steps.flatMap((action) => {
    const reason = purchaseOrderStepBlocker(status, action);
    if (reason === null) return [];
    return [
      {
        stage: "closed",
        action,
        label: PURCHASE_ORDER_STEP_LABELS[action],
        reason,
      },
    ];
  });
}
