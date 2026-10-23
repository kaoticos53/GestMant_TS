import { describe, expect, it } from "vitest";
import {
  buildInitialQuantities,
  parseReceivedItems,
  validateReceiveInput,
} from "@/pages/dashboard/purchasing/dialogs/receive/helpers";
import type { PurchaseOrderLine } from "@/lib/purchasing";
import type { Id } from "@/convex/_generated/dataModel";

describe("receiveDialog helpers", () => {
  const dummyLine = (
    id: string,
    quantity: number,
    receivedQuantity: number,
  ): PurchaseOrderLine => ({
    purchaseRequestId: id as Id<"purchaseRequests">,
    code: `COD-${id}`,
    name: `Pieza ${id}`,
    unit: "uds",
    quantity,
    receivedQuantity,
    pricePerUnit: 10,
  });

  describe("buildInitialQuantities", () => {
    it("mapea solo las líneas con cantidad pendiente > 0", () => {
      const lines = [
        dummyLine("req1", 5, 2), // pendiente: 3
        dummyLine("req2", 4, 4), // pendiente: 0
        dummyLine("req3", 10, 0), // pendiente: 10
      ];

      const quantities = buildInitialQuantities(lines);
      expect(quantities).toEqual({
        req1: "3",
        req3: "10",
      });
      expect(quantities.req2).toBeUndefined();
    });

    it("retorna objeto vacío si no hay líneas pendientes", () => {
      const lines = [dummyLine("req1", 2, 2)];
      expect(buildInitialQuantities(lines)).toEqual({});
    });
  });

  describe("parseReceivedItems", () => {
    it("convierte strings numéricos y omite vacíos, cero o negativos", () => {
      const cantidades = {
        req1: "3",
        req2: "0",
        req3: "",
        req4: "-1",
        req5: "invalid",
        req6: "5.5",
      };

      const items = parseReceivedItems(cantidades);
      expect(items).toEqual([
        { purchaseRequestId: "req1", quantity: 3 },
        { purchaseRequestId: "req6", quantity: 5.5 },
      ]);
    });
  });

  describe("validateReceiveInput", () => {
    it("exige albarán obligatorio", () => {
      const error = validateReceiveInput(null, [
        { purchaseRequestId: "req1" as Id<"purchaseRequests">, quantity: 1 },
      ]);
      expect(error).toBe("Adjunta el albarán de entrega: sin él no se da la entrada.");
    });

    it("exige al menos un item con cantidad recibida", () => {
      const file = new File(["dummy"], "albaran.pdf", { type: "application/pdf" });
      const error = validateReceiveInput(file, []);
      expect(error).toBe("Escribe cuánto ha llegado.");
    });

    it("retorna null si el albarán y los items son válidos", () => {
      const file = new File(["dummy"], "albaran.pdf", { type: "application/pdf" });
      const error = validateReceiveInput(file, [
        { purchaseRequestId: "req1" as Id<"purchaseRequests">, quantity: 2 },
      ]);
      expect(error).toBeNull();
    });
  });
});
