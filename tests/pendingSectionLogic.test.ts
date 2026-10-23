import { evaluatePurchaseSelection } from "@/pages/dashboard/purchasing/components/pending/hooks/usePendingPurchaseSelection";
import type { Id } from "@/convex/_generated/dataModel";
import type { PurchaseRequestDoc } from "@/lib/purchasing";
import { describe, expect, it } from "vitest";

function buildMockPurchaseRequest(
  id: string,
  supplier: string,
  status: "pending" | "ordered" | "received" | "cancelled" = "pending",
): PurchaseRequestDoc {
  return {
    _id: id as Id<"purchaseRequests">,
    reference: `PC-${id}`,
    code: `REP-${id}`,
    name: `Pieza ${id}`,
    quantity: 1,
    unit: "ud",
    supplier,
    status,
    reason: "workshop",
    requestReference: `PET-${id}`,
    requesterName: "Técnico Test",
    requestDate: 1000,
    requestedBy: "Responsable Test",
    requestedAt: 2000,
  };
}

describe("evaluatePurchaseSelection", () => {
  const items: PurchaseRequestDoc[] = [
    buildMockPurchaseRequest("1", "RS Components", "pending"),
    buildMockPurchaseRequest("2", "RS Components", "pending"),
    buildMockPurchaseRequest("3", "Farnell", "pending"),
    buildMockPurchaseRequest("4", "RS Components", "ordered"), // ya en orden
  ];

  it("devuelve mensaje informativo cuando no hay nada seleccionado", () => {
    const res = evaluatePurchaseSelection(items, new Set(), true);
    expect(res.count).toBe(0);
    expect(res.suppliers).toHaveLength(0);
    expect(res.canCreateOrder).toBe(false);
    expect(res.feedbackMessage).toBe(
      "Marca lo que va en la orden: se agrupa por proveedor.",
    );
  });

  it("ignora peticiones cuyo estado no sea untreated", () => {
    // Si se selecciona la fila 4 que está 'ordered', no debe computar
    const res = evaluatePurchaseSelection(items, new Set(["4"]), true);
    expect(res.count).toBe(0);
    expect(res.canCreateOrder).toBe(false);
  });

  it("permite crear orden si hay artículos seleccionados del mismo proveedor", () => {
    const res = evaluatePurchaseSelection(items, new Set(["1", "2"]), true);
    expect(res.count).toBe(2);
    expect(res.suppliers).toEqual(["RS Components"]);
    expect(res.isSingleSupplier).toBe(true);
    expect(res.canCreateOrder).toBe(true);
    expect(res.feedbackMessage).toBe("2 artículos para RS Components");
  });

  it("singulariza el mensaje con 1 artículo", () => {
    const res = evaluatePurchaseSelection(items, new Set(["1"]), true);
    expect(res.count).toBe(1);
    expect(res.feedbackMessage).toBe("1 artículo para RS Components");
    expect(res.canCreateOrder).toBe(true);
  });

  it("bloquea la creación de orden si se mezclan múltiples proveedores", () => {
    const res = evaluatePurchaseSelection(items, new Set(["1", "3"]), true);
    expect(res.count).toBe(2);
    expect(res.suppliers).toHaveLength(2);
    expect(res.isSingleSupplier).toBe(false);
    expect(res.canCreateOrder).toBe(false);
    expect(res.feedbackMessage).toBe(
      "Has mezclado proveedores: una orden es de uno solo.",
    );
  });

  it("bloquea la creación de orden si el usuario no tiene permisos canManage", () => {
    const res = evaluatePurchaseSelection(items, new Set(["1"]), false);
    expect(res.count).toBe(1);
    expect(res.canCreateOrder).toBe(false);
  });
});
