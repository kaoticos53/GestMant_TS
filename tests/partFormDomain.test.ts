import { describe, expect, test } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  parseNumberField,
  validatePartForm,
  toPartPayload,
  type PartFormValues,
} from "../src/pages/dashboard/inventory/domain/partForm";

describe("Dominio de Inventario: partForm", () => {
  describe("parseNumberField", () => {
    test("parsea enteros y decimales con punto", () => {
      expect(parseNumberField("42", 0)).toBe(42);
      expect(parseNumberField("15.75", 0)).toBe(15.75);
    });

    test("parsea números con coma decimal europea y espacios", () => {
      expect(parseNumberField("  23,45  ", 0)).toBe(23.45);
      expect(parseNumberField(",5", 0)).toBe(0.5);
    });

    test("devuelve el fallback cuando la cadena está vacía o es inválida", () => {
      expect(parseNumberField("", 10)).toBe(10);
      expect(parseNumberField("   ", -1)).toBe(-1);
      expect(parseNumberField("abc", 0)).toBe(0);
      expect(parseNumberField("12px", -1)).toBe(-1);
    });
  });

  describe("validatePartForm", () => {
    const validForm: PartFormValues = {
      code: "FUS-10A",
      name: "Fusible cerámico 10 A",
      description: "",
      category: "Protección",
      unit: "ud",
      stockText: "25",
      minStockText: "5",
      location: "EST-A1",
      supplier: "Farnell",
      partNumber: "0215010.MXP",
      priceText: "1,20",
      purchaseUrl: "https://example.com/fuse",
      compatibleModelIds: ["mod-1" as Id<"equipmentModels">],
    };

    test("acepta un formulario con todos los datos requeridos correctos", () => {
      const res = validatePartForm(validForm);
      expect(res.isValid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    test("rechaza código vacío o en blanco", () => {
      const res = validatePartForm({ ...validForm, code: "   " });
      expect(res.isValid).toBe(false);
      expect(res.error).toBe("El código es obligatorio.");
    });

    test("rechaza nombre vacío o en blanco", () => {
      const res = validatePartForm({ ...validForm, name: "  " });
      expect(res.isValid).toBe(false);
      expect(res.error).toBe("El nombre es obligatorio.");
    });

    test("rechaza stock o stock mínimo negativo o inválido", () => {
      expect(validatePartForm({ ...validForm, stockText: "-1" })).toEqual({
        isValid: false,
        error: "El stock y el stock mínimo deben ser números positivos.",
      });

      expect(validatePartForm({ ...validForm, minStockText: "-5" })).toEqual({
        isValid: false,
        error: "El stock y el stock mínimo deben ser números positivos.",
      });

      expect(validatePartForm({ ...validForm, stockText: "no-numero" })).toEqual({
        isValid: false,
        error: "El stock y el stock mínimo deben ser números positivos.",
      });
    });

    test("rechaza precios negativos", () => {
      const res = validatePartForm({ ...validForm, priceText: "-0,50" });
      expect(res.isValid).toBe(false);
      expect(res.error).toBe("El precio no puede ser negativo.");
    });
  });

  describe("toPartPayload", () => {
    test("convierte y limpia los valores en el DTO para Convex", () => {
      const form: PartFormValues = {
        code: "  ali-24015  ",
        name: "  Fuente 24V  ",
        description: "",
        category: "  Alimentación  ",
        unit: "  ",
        stockText: "10",
        minStockText: "2",
        location: "  B-03  ",
        supplier: "  Mean Well  ",
        partNumber: "  NDR-150-24  ",
        priceText: "45,50",
        purchaseUrl: "  https://meanwell.com  ",
        compatibleModelIds: ["mod-1" as Id<"equipmentModels">],
      };

      const payload = toPartPayload(form);

      expect(payload).toEqual({
        code: "ali-24015",
        name: "Fuente 24V",
        category: "Alimentación",
        unit: "ud", // Fallback por defecto cuando está en blanco
        stock: 10,
        minStock: 2,
        location: "B-03",
        supplier: "Mean Well",
        partNumber: "NDR-150-24",
        unitPrice: 45.5,
        purchaseUrl: "https://meanwell.com",
        compatibleModels: ["mod-1"],
        compatibleWith: [],
      });
    });
  });
});
