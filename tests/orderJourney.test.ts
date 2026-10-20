import { describe, expect, test } from "vitest";
import {
  PURCHASE_ORDER_STEP_LABELS,
  purchaseOrderStepBlocker,
  type PurchaseOrderStatus,
} from "@/lib/purchaseFlow";
import {
  blockedJourneySteps,
  nextPurchaseOrderAction,
  orderJourney,
} from "@/lib/orderJourney";

/** Las etapas resumidas como «clave:estado», que es lo que se quiere comprobar. */
function resumen(status: PurchaseOrderStatus, received = false): string[] {
  return orderJourney(status, { received }).map(
    (stage) => `${stage.key}:${stage.state}`,
  );
}

describe("el recorrido de la orden de compra", () => {
  test("enviada: el primer tramo es el de ahora y el resto espera", () => {
    expect(resumen("pending")).toEqual([
      "sent:current",
      "receiving:pending",
      "closed:pending",
    ]);
  });

  test("parcial: el material está entrando", () => {
    expect(resumen("partial", true)).toEqual([
      "sent:done",
      "receiving:current",
      "closed:pending",
    ]);
  });

  test("completada: el último tramo se llama por lo que pasó", () => {
    const stages = orderJourney("completed", { received: true });
    expect(stages.map((stage) => stage.state)).toEqual([
      "done",
      "done",
      "current",
    ]);
    expect(stages[2].label).toBe("Completada");
  });

  test("anulada con material dentro no finge no haber recibido", () => {
    const stages = orderJourney("cancelled", { received: true });
    expect(stages.map((stage) => stage.state)).toEqual([
      "done",
      "done",
      "current",
    ]);
    expect(stages[2].label).toBe("Anulada");
  });

  test("anulada sin que llegara nada deja la recepción en punteado", () => {
    expect(resumen("cancelled", false)).toEqual([
      "sent:done",
      "receiving:skipped",
      "closed:current",
    ]);
  });
});

describe("el siguiente paso de la orden", () => {
  test("recepcionar mientras falte material", () => {
    expect(nextPurchaseOrderAction("pending", { canManage: true })).toBe(
      "receive",
    );
    expect(nextPurchaseOrderAction("partial", { canManage: true })).toBe(
      "receive",
    );
  });

  test("cerrada: no hay nada que dar", () => {
    expect(
      nextPurchaseOrderAction("completed", { canManage: true }),
    ).toBeNull();
    expect(
      nextPurchaseOrderAction("cancelled", { canManage: true }),
    ).toBeNull();
  });

  test("quien no gestiona compras no tiene siguiente paso", () => {
    for (const status of [
      "pending",
      "partial",
      "completed",
      "cancelled",
    ] satisfies PurchaseOrderStatus[]) {
      expect(nextPurchaseOrderAction(status, { canManage: false })).toBeNull();
    }
  });
});

describe("los motivos de los pasos que no se pueden dar", () => {
  test("con la orden abierta no hay nada bloqueado", () => {
    expect(blockedJourneySteps("pending")).toEqual([]);
    expect(blockedJourneySteps("partial")).toEqual([]);
  });

  test("cerrada: los dos pasos, con el motivo del cierre, bajo el último tramo", () => {
    const pasos = blockedJourneySteps("completed");
    expect(pasos.map((paso) => paso.action)).toEqual(["receive", "cancel"]);
    expect(pasos.every((paso) => paso.stage === "closed")).toBe(true);
    expect(
      pasos.every(
        (paso) =>
          paso.reason === purchaseOrderStepBlocker("completed", paso.action),
      ),
    ).toBe(true);
    expect(pasos[0].label).toBe(PURCHASE_ORDER_STEP_LABELS.receive);
  });

  test("anulada: el motivo es el de la anulación, no el de la completada", () => {
    const [recibir] = blockedJourneySteps("cancelled");
    expect(recibir.reason).toContain("anulada");
  });
});
