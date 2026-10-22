import { describe, expect, it } from "vitest";
import type { Id } from "../src/convex/_generated/dataModel";
import {
  getCompatibleParts,
  parseNumericInput,
  resolveRequestModelId,
  validateNewPartPayload,
} from "../src/pages/dashboard/requests/dialogs/associate/helpers";
import type { EquipmentDoc, PartDoc } from "../src/pages/dashboard/requests/dialogs/associate/types";

describe("associateDialog helpers", () => {
  describe("parseNumericInput", () => {
    it("convierte enteros y decimales con punto", () => {
      expect(parseNumericInput("15", 0)).toBe(15);
      expect(parseNumericInput("12.5", 0)).toBe(12.5);
    });

    it("convierte decimales con coma (notación europea)", () => {
      expect(parseNumericInput("29,90", 0)).toBe(29.9);
      expect(parseNumericInput("0,5", 0)).toBe(0.5);
    });

    it("retorna fallback si el valor no es un número válido", () => {
      expect(parseNumericInput("abc", -1)).toBe(-1);
      expect(parseNumericInput("", 10)).toBe(10);
    });
  });

  describe("resolveRequestModelId", () => {
    const catalogModels = [
      { _id: "model_1" as Id<"equipmentModels">, model: "HDC-3500" },
      { _id: "model_2" as Id<"equipmentModels">, model: "Alpha 7 IV" },
    ];

    it("retorna undefined si no hay equipo en la petición", () => {
      expect(resolveRequestModelId(undefined, catalogModels)).toBeUndefined();
    });

    it("retorna modelId directo si el equipo lo tiene asignado", () => {
      const eq = { model: "HDC-3500", modelId: "model_direct" as Id<"equipmentModels"> } as EquipmentDoc;
      expect(resolveRequestModelId(eq, catalogModels)).toBe("model_direct");
    });

    it("busca en el catálogo por nombre de modelo ignorando mayúsculas y espacios", () => {
      const eq = { model: "  hdc-3500  " } as EquipmentDoc;
      expect(resolveRequestModelId(eq, catalogModels)).toBe("model_1");
    });

    it("retorna undefined si el modelo no está en el catálogo", () => {
      const eq = { model: "Inexistente" } as EquipmentDoc;
      expect(resolveRequestModelId(eq, catalogModels)).toBeUndefined();
    });
  });

  describe("getCompatibleParts", () => {
    const parts = [
      { _id: "p1" as Id<"spareParts">, code: "P-1", compatibleModels: ["model_1" as Id<"equipmentModels">] },
      { _id: "p2" as Id<"spareParts">, code: "P-2", compatibleModels: ["model_2" as Id<"equipmentModels">] },
      { _id: "p3" as Id<"spareParts">, code: "P-3", compatibleModels: [] },
    ] as PartDoc[];

    it("retorna todos los repuestos si requestModelId es undefined", () => {
      expect(getCompatibleParts(parts, undefined)).toEqual(parts);
    });

    it("retorna únicamente los repuestos que contienen el modelId en compatibleModels", () => {
      const compatible = getCompatibleParts(parts, "model_1" as Id<"equipmentModels">);
      expect(compatible).toHaveLength(1);
      expect(compatible[0]._id).toBe("p1");
    });
  });

  describe("validateNewPartPayload", () => {
    it("requiere código y nombre obligatorios", () => {
      const resultEmptyCode = validateNewPartPayload({
        code: "",
        name: "Lente frontal",
        stockText: "1",
        minStockText: "0",
        priceText: "10",
      });
      expect(resultEmptyCode.valid).toBe(false);
      expect(resultEmptyCode.error).toBe("El código y el nombre son obligatorios.");

      const resultEmptyName = validateNewPartPayload({
        code: "LNT-01",
        name: "   ",
        stockText: "1",
        minStockText: "0",
        priceText: "10",
      });
      expect(resultEmptyName.valid).toBe(false);
    });

    it("rechaza números negativos para stock, mínimo o precio", () => {
      const resultNegStock = validateNewPartPayload({
        code: "LNT-01",
        name: "Lente frontal",
        stockText: "-5",
        minStockText: "0",
        priceText: "10",
      });
      expect(resultNegStock.valid).toBe(false);
      expect(resultNegStock.error).toContain("positivos");
    });

    it("acepta campos correctos y procesa coma decimal en precio", () => {
      const result = validateNewPartPayload({
        code: "LNT-01",
        name: "Lente frontal",
        stockText: "2",
        minStockText: "1",
        priceText: "29,50",
      });
      expect(result.valid).toBe(true);
      expect(result.stock).toBe(2);
      expect(result.minStock).toBe(1);
      expect(result.price).toBe(29.5);
    });
  });
});
