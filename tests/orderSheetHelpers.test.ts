import { describe, expect, it } from "vitest";
import {
  formatOrderHeaderDescription,
  formatReceptionLinesSummary,
  getOrderSheetNextHint,
} from "@/pages/dashboard/purchasing/dialogs/orderSheet/helpers";

describe("orderSheet helpers", () => {
  describe("getOrderSheetNextHint", () => {
    it("indica que la llevan quienes gestionan compras si canManage es false", () => {
      expect(getOrderSheetNextHint(false, "ordered")).toBe(
        "La llevan quienes gestionan las compras.",
      );
      expect(getOrderSheetNextHint(false, "completed")).toBe(
        "La llevan quienes gestionan las compras.",
      );
    });

    it("indica que la orden está completada cuando status es completed", () => {
      expect(getOrderSheetNextHint(true, "completed")).toBe(
        "La orden está completada: entró todo lo que se pidió.",
      );
    });

    it("indica que la orden está anulada cuando status es cancelled", () => {
      expect(getOrderSheetNextHint(true, "cancelled")).toBe(
        "La orden está anulada: sus peticiones volvieron a la cola.",
      );
    });

    it("indica sin pasos disponibles para otros estados no contemplados", () => {
      expect(getOrderSheetNextHint(true, "ordered")).toBe(
        "Sin pasos disponibles ahora mismo.",
      );
      expect(getOrderSheetNextHint(true, "partiallyReceived")).toBe(
        "Sin pasos disponibles ahora mismo.",
      );
    });
  });

  describe("formatOrderHeaderDescription", () => {
    it("formatea correctamente los metadatos de la orden y totales recibidos", () => {
      const order = {
        supplier: "Rodamientos del Norte",
        orderedAt: 1714560000000,
        orderedBy: "Marta Gómez",
      };
      const total = {
        received: 5,
        quantity: 10,
      };

      const result = formatOrderHeaderDescription(order, total);
      expect(result).toContain("Rodamientos del Norte");
      expect(result).toContain("Marta Gómez");
      expect(result).toContain("5/10 ud recibidas");
    });
  });

  describe("formatReceptionLinesSummary", () => {
    it("combina líneas recibidas con código y cantidad", () => {
      const lines = [
        { code: "ROD-6204", quantity: 4 },
        { code: "RET-3552", quantity: 2 },
      ];
      expect(formatReceptionLinesSummary(lines)).toBe(
        "ROD-6204 × 4 · RET-3552 × 2",
      );
    });

    it("maneja una lista vacía de líneas sin errores", () => {
      expect(formatReceptionLinesSummary([])).toBe("");
    });
  });
});
