import { describe, expect, it } from "vitest";
import {
  buildInitialDeliveryQuantities,
  buildIssueBatchLines,
  calculateShortages,
  calculateTotalDeliveryQuantity,
  clampDeliveryQuantity,
  formatShortagePurchasesHint,
} from "@/pages/dashboard/requests/dialogs/decisionDialog/helpers";
import type { PartDoc, RequestLine } from "@/pages/dashboard/requests/dialogs/decisionDialog/types";

describe("decisionDialog helpers", () => {
  describe("calculateShortages", () => {
    it("detecta líneas con stock menor a la cantidad pedida", () => {
      const parts = [
        { _id: "p1", stock: 5 },
        { _id: "p2", stock: 2 },
      ] as unknown as PartDoc[];
      const lines = [
        { sparePartId: "p1", quantity: 3 },
        { sparePartId: "p2", quantity: 5 },
      ] as unknown as RequestLine[];

      const shortages = calculateShortages(lines, parts);
      expect(shortages.length).toBe(1);
      expect(shortages[0].sparePartId).toBe("p2");
    });

    it("detecta como faltante si la pieza no existe en el catálogo de repuestos", () => {
      const parts = [] as unknown as PartDoc[];
      const lines = [
        { sparePartId: "p-missing", quantity: 1 },
      ] as unknown as RequestLine[];

      const shortages = calculateShortages(lines, parts);
      expect(shortages.length).toBe(1);
    });
  });

  describe("buildInitialDeliveryQuantities", () => {
    it("calcula lo que queda pendiente por línea para una petición aprobada", () => {
      const lines = [
        { sparePartId: "p1", quantity: 4, deliveredQuantity: 1 },
        { sparePartId: "p2", quantity: 2, deliveredQuantity: 2 },
      ] as unknown as RequestLine[];

      const result = buildInitialDeliveryQuantities(lines, "approved");
      expect(result["p1"]).toBe(3);
      expect(result["p2"]).toBe(0);
    });
  });

  describe("clampDeliveryQuantity", () => {
    it("acota el valor entre 0 y el remaining máximo", () => {
      expect(clampDeliveryQuantity(-5, 10)).toBe(0);
      expect(clampDeliveryQuantity(4.9, 10)).toBe(4);
      expect(clampDeliveryQuantity(15, 10)).toBe(10);
      expect(clampDeliveryQuantity(NaN, 10)).toBe(0);
    });
  });

  describe("buildIssueBatchLines", () => {
    it("devuelve únicamente las líneas con cantidad mayor a cero", () => {
      const lines = [
        { sparePartId: "p1" },
        { sparePartId: "p2" },
      ] as unknown as RequestLine[];
      const entrega = { p1: 3, p2: 0 };

      const batch = buildIssueBatchLines(lines, entrega);
      expect(batch).toEqual([{ sparePartId: "p1", quantity: 3 }]);
    });
  });

  describe("calculateTotalDeliveryQuantity", () => {
    it("suma correctamente las unidades de todas las líneas", () => {
      const lines = [
        { sparePartId: "p1" },
        { sparePartId: "p2" },
      ] as unknown as RequestLine[];
      const entrega = { p1: 4, p2: 6 };

      expect(calculateTotalDeliveryQuantity(lines, entrega)).toBe(10);
    });
  });

  describe("formatShortagePurchasesHint", () => {
    it("avisa si ya hay compras vivas en camino", () => {
      expect(formatShortagePurchasesHint(2, 1)).toContain(
        "ya hay una petición de compra viva",
      );
      expect(formatShortagePurchasesHint(2, 3)).toContain(
        "ya hay 3 peticiones de compra vivas",
      );
    });

    it("pide rechazar o reponer el catálogo si no hay compras vivas", () => {
      expect(formatShortagePurchasesHint(2, 0)).toContain(
        "Rechaza la petición o repón el catálogo antes de aprobar.",
      );
    });
  });
});
