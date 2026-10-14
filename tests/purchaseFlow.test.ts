import { describe, expect, test } from "vitest";
import type {
  PurchaseOrderStatus,
  PurchaseRequestStatus,
} from "../src/convex/schema";
import {
  PURCHASE_ORDER_STEP_LABELS,
  blockedPurchaseOrderSteps,
  canAdvancePurchaseOrder,
  canAdvancePurchaseRequest,
  isPurchaseOrderClosed,
  isPurchaseRequestAwaitingDelivery,
  isPurchaseRequestClosed,
  isPurchaseRequestUntreated,
  nextPurchaseRequestStatus,
  purchaseOrderStatusAfterReceiving,
  purchaseOrderStepBlocker,
  purchaseRequestReceivedStatus,
  type PurchaseOrderAction,
  type PurchaseRequestAction,
} from "../src/lib/purchaseFlow";

/**
 * La tabla esperada, escrita con los tipos del esquema: si se añade un estado a
 * la base sin decidir por dónde pasa, esto no compila y hay que decidirlo.
 */
const DESDE_PETICION: Record<
  PurchaseRequestStatus,
  readonly PurchaseRequestAction[]
> = {
  pending: ["order", "cancel"],
  ordered: ["unorder", "receive"],
  received: [],
  cancelled: [],
};

const DESDE_ORDEN: Record<PurchaseOrderStatus, readonly PurchaseOrderAction[]> =
  {
    pending: ["receive", "cancel"],
    partial: ["receive", "cancel"],
    completed: [],
    cancelled: [],
  };

/** Y a dónde lleva cada paso de la petición de compra. */
const DESTINOS_PETICION: Record<PurchaseRequestAction, PurchaseRequestStatus> =
  {
    order: "ordered",
    unorder: "pending",
    cancel: "cancelled",
    receive: "received",
  };

const ACCIONES_PETICION = [
  ...new Set(Object.values(DESDE_PETICION).flat()),
] as PurchaseRequestAction[];
const ACCIONES_ORDEN = [
  ...new Set(Object.values(DESDE_ORDEN).flat()),
] as PurchaseOrderAction[];

describe("la máquina de la compra — qué se puede hacer desde cada estado", () => {
  test("desde cada estado de la petición se puede dar exactamente lo decidido", () => {
    for (const [status, actions] of Object.entries(DESDE_PETICION) as [
      PurchaseRequestStatus,
      readonly PurchaseRequestAction[],
    ][]) {
      for (const action of ACCIONES_PETICION) {
        expect(
          canAdvancePurchaseRequest(status, action),
          `${action} desde ${status}`,
        ).toBe(actions.includes(action));
      }
    }
  });

  test("desde cada estado de la orden se puede dar exactamente lo decidido", () => {
    for (const [status, actions] of Object.entries(DESDE_ORDEN) as [
      PurchaseOrderStatus,
      readonly PurchaseOrderAction[],
    ][]) {
      for (const action of ACCIONES_ORDEN) {
        expect(
          canAdvancePurchaseOrder(status, action),
          `${action} desde ${status}`,
        ).toBe(actions.includes(action));
      }
    }
  });

  test("cada paso de la petición lleva a donde dice, y sale de algún sitio", () => {
    for (const [action, to] of Object.entries(DESTINOS_PETICION) as [
      PurchaseRequestAction,
      PurchaseRequestStatus,
    ][]) {
      const from = (
        Object.keys(DESDE_PETICION) as PurchaseRequestStatus[]
      ).find((status) => DESDE_PETICION[status].includes(action));
      // Un paso que no sale de ningún estado es un paso muerto: nadie puede
      // darlo nunca.
      expect(from, `«${action}» no sale de ningún estado`).toBeDefined();
      if (from === undefined) continue;
      expect(nextPurchaseRequestStatus(from, action), action).toBe(to);
    }
  });

  test("lo que no es legal no lleva a ningún sitio, y no revienta", () => {
    expect(nextPurchaseRequestStatus("received", "receive")).toBeNull();
    expect(nextPurchaseRequestStatus("cancelled", "order")).toBeNull();
    expect(nextPurchaseRequestStatus("ordered", "cancel")).toBeNull();
    // Un estado que no es de la compra tampoco pasa por esta puerta.
    expect(nextPurchaseRequestStatus("reported", "order")).toBeNull();
  });
});

describe("lo sin tratar y lo cerrado — lo que ofrece la ficha de compras", () => {
  test("sin tratar es solo lo que espera a que alguien monte la orden", () => {
    expect(isPurchaseRequestUntreated("pending")).toBe(true);
    for (const status of ["ordered", "received", "cancelled"]) {
      expect(isPurchaseRequestUntreated(status), status).toBe(false);
    }
  });

  test("cerrada es lo recibido y lo retirado: ahí no se toca la nota", () => {
    expect(isPurchaseRequestClosed("received")).toBe(true);
    expect(isPurchaseRequestClosed("cancelled")).toBe(true);
    for (const status of ["pending", "ordered"]) {
      expect(isPurchaseRequestClosed(status), status).toBe(false);
    }
    // Y la orden: completada o anulada, en ninguna se anota ni se recepciona.
    expect(isPurchaseOrderClosed("completed")).toBe(true);
    expect(isPurchaseOrderClosed("cancelled")).toBe(true);
    for (const status of ["pending", "partial"]) {
      expect(isPurchaseOrderClosed(status), status).toBe(false);
    }
  });

  test("en camino es lo que se pidió y todavía no ha entrado", () => {
    expect(isPurchaseRequestAwaitingDelivery({ status: "pending" })).toBe(true);
    expect(isPurchaseRequestAwaitingDelivery({ status: "ordered" })).toBe(true);
    expect(isPurchaseRequestAwaitingDelivery({ status: "received" })).toBe(
      false,
    );
    expect(isPurchaseRequestAwaitingDelivery({ status: "cancelled" })).toBe(
      false,
    );
    // Con fecha de recepción está fuera aunque el estado se quedara atrás: es lo
    // que evita comprar dos veces lo que ya entró.
    expect(
      isPurchaseRequestAwaitingDelivery({ status: "ordered", receivedAt: 1 }),
    ).toBe(false);
  });
});

describe("la vuelta de la petición cuando su material llega", () => {
  test("cierra la que estaba pedida, y también la que se quedó sin tratar", () => {
    expect(purchaseRequestReceivedStatus("ordered")).toBe("received");
    // Una fila vieja que sigue «sin tratar» dentro de una orden: su material ha
    // llegado, y dejarla abierta la haría comprarse otra vez.
    expect(purchaseRequestReceivedStatus("pending")).toBe("received");
  });

  test("lo ya cerrado no revive", () => {
    expect(purchaseRequestReceivedStatus("received")).toBeNull();
    expect(purchaseRequestReceivedStatus("cancelled")).toBeNull();
  });
});

describe("la orden después de una recepción", () => {
  const linea = (quantity: number, receivedQuantity: number) => ({
    quantity,
    receivedQuantity,
  });

  test("completada cuando ha llegado todo lo pedido", () => {
    expect(purchaseOrderStatusAfterReceiving([linea(3, 3)])).toBe("completed");
    expect(purchaseOrderStatusAfterReceiving([linea(3, 3), linea(1, 2)])).toBe(
      "completed",
    );
  });

  test("parcial si queda algo por llegar, aunque sea de un solo artículo", () => {
    // Se mira artículo a artículo, no el total: recibir 100 de uno y 0 de otro no
    // es haber recibido la mitad de todo.
    expect(purchaseOrderStatusAfterReceiving([linea(100, 100), linea(1, 0)])) //
      .toBe("partial");
    expect(purchaseOrderStatusAfterReceiving([linea(3, 1)])).toBe("partial");
  });

  test("lo que llegó de más no la deja a medias", () => {
    expect(purchaseOrderStatusAfterReceiving([linea(3, 5)])).toBe("completed");
  });
});

describe("por qué no se puede recepcionar ni anular — lo que explica la ficha", () => {
  const ESTADOS: PurchaseOrderStatus[] = [
    "pending",
    "partial",
    "completed",
    "cancelled",
  ];
  const PASOS = Object.keys(
    PURCHASE_ORDER_STEP_LABELS,
  ) as PurchaseOrderAction[];

  test("hay motivo exactamente cuando el paso no es legal", () => {
    for (const status of ESTADOS) {
      for (const action of PASOS) {
        const reason = purchaseOrderStepBlocker(status, action);
        expect(reason === null, `${action} desde ${status}`).toBe(
          canAdvancePurchaseOrder(status, action),
        );
        if (reason !== null) expect(reason.trim(), action).not.toBe("");
      }
    }
  });

  test("mientras le falta material, las dos cosas se pueden", () => {
    for (const status of ["pending", "partial"] as PurchaseOrderStatus[]) {
      expect(blockedPurchaseOrderSteps(status), status).toEqual([]);
    }
  });

  test("una orden cerrada lo dice una vez, y dice por qué", () => {
    const completada = blockedPurchaseOrderSteps("completed");
    expect(completada).toHaveLength(1);
    expect(completada[0].actions).toEqual(["receive", "cancel"]);
    expect(completada[0].reason).toContain("ya está completada");

    const anulada = blockedPurchaseOrderSteps("cancelled");
    expect(anulada).toHaveLength(1);
    expect(anulada[0].reason).toContain("ya está anulada");
  });
});
