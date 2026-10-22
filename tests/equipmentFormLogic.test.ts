import { describe, expect, test } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  buildEquipmentPayload,
  findModelTemplate,
  firstFilled,
  getUniqueModelSuggestions,
  validateEquipmentForm,
} from "@/pages/dashboard/equipment/dialogs/equipmentFormLogic";
import type { EquipmentDoc } from "@/pages/dashboard/equipment/types";

describe("equipmentFormLogic", () => {
  describe("firstFilled", () => {
    test("devuelve el primer valor no vacío", () => {
      expect(firstFilled("", undefined, "  ", "Sony", "Panasonic")).toBe("Sony");
      expect(firstFilled(undefined, undefined)).toBe("");
    });
  });

  describe("findModelTemplate", () => {
    const mockCatalogModels: Doc<"equipmentModels">[] = [
      {
        _id: "cm_1" as Id<"equipmentModels">,
        _creationTime: 1000,
        model: "HDC-3500",
        brand: "Sony",
        name: "Cámara de estudio 4K",
        defaultSupplier: "Sony Broadcast",
        defaultMaintenanceIntervalDays: 180,
        description: "Sensor 2/3 pulgadas",
      },
    ];

    const mockInventoryEquipment: EquipmentDoc[] = [
      {
        _id: "eq_1" as Id<"equipment">,
        _creationTime: 2000,
        code: "EQ-001",
        model: "AG-CX350",
        brand: "Panasonic",
        name: "Camcorder 4K",
        supplier: "Panasonic Pro",
        maintenanceIntervalDays: 365,
        description: "Óptica integrada",
        location: "Plató 1",
        serialNumber: "SN123",
      },
    ];

    test("encuentra plantilla en el catálogo oficial prioritariamente", () => {
      const template = findModelTemplate("hdc-3500", mockCatalogModels, mockInventoryEquipment);
      expect(template).not.toBeNull();
      expect(template?.source).toBe("catalog");
      expect(template?.brand).toBe("Sony");
      expect(template?.maintenanceIntervalDays).toBe(180);
      expect(template?.sourceLabel).toContain("Plantilla: Cámara de estudio 4K");
    });

    test("encuentra plantilla en inventario previo si no está en catálogo", () => {
      const template = findModelTemplate("ag-cx350", mockCatalogModels, mockInventoryEquipment);
      expect(template).not.toBeNull();
      expect(template?.source).toBe("inventory");
      expect(template?.brand).toBe("Panasonic");
      expect(template?.supplier).toBe("Panasonic Pro");
      expect(template?.sourceLabel).toContain("Equipo previo: Camcorder 4K");
    });

    test("retorna null si el modelo no coincide con nada o está vacío", () => {
      expect(findModelTemplate("", mockCatalogModels, mockInventoryEquipment)).toBeNull();
      expect(findModelTemplate("Modelo-Inexistente", mockCatalogModels, mockInventoryEquipment)).toBeNull();
    });
  });

  describe("getUniqueModelSuggestions", () => {
    test("combina modelos de catálogo e inventario sin duplicados y ordenados", () => {
      const catalog = [{ model: "Sony HDC" }, { model: "Canon C300" }] as Doc<"equipmentModels">[];
      const equipment = [{ model: "Canon C300" }, { model: "Arri Alexa" }] as EquipmentDoc[];
      const uniqueInv = ["Sony HDC", "Blackmagic 6K"];

      const suggestions = getUniqueModelSuggestions(catalog, equipment, uniqueInv);
      expect(suggestions).toEqual([
        "Arri Alexa",
        "Blackmagic 6K",
        "Canon C300",
        "Sony HDC",
      ]);
    });
  });

  describe("validateEquipmentForm", () => {
    const baseValid = {
      finalCode: "EQ-100",
      name: "Monitor de vídeo",
      model: "LMD-A240",
      purchaseDate: "2024-01-10",
      warrantyEndDate: "2026-01-10",
      decommissionDate: "",
      intervalDays: "180",
    };

    test("valida exitosamente un formulario correcto", () => {
      const result = validateEquipmentForm(baseValid, false);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.interval).toBe(180);
        expect(typeof result.purchase).toBe("number");
        expect(typeof result.warranty).toBe("number");
        expect(result.decommission).toBeUndefined();
      }
    });

    test("falla si el código es obligatorio en edición y viene vacío", () => {
      const result = validateEquipmentForm({ ...baseValid, finalCode: "" }, true);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("código de inventario es obligatorio");
      }
    });

    test("falla si la designación o el modelo están vacíos", () => {
      const res1 = validateEquipmentForm({ ...baseValid, name: "  " }, false);
      expect(res1.valid).toBe(false);
      const res2 = validateEquipmentForm({ ...baseValid, model: "  " }, false);
      expect(res2.valid).toBe(false);
    });

    test("falla si el intervalo es menor o igual a cero o no numérico", () => {
      const res1 = validateEquipmentForm({ ...baseValid, intervalDays: "0" }, false);
      expect(res1.valid).toBe(false);
      if (!res1.valid) {
        expect(res1.error).toContain("número de días mayor que cero");
      }
      const res2 = validateEquipmentForm({ ...baseValid, intervalDays: "-10" }, false);
      expect(res2.valid).toBe(false);
    });

    test("falla si fecha de baja es anterior a fecha de alta", () => {
      const result = validateEquipmentForm(
        {
          ...baseValid,
          purchaseDate: "2024-05-01",
          decommissionDate: "2024-04-01",
        },
        false,
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("fecha de baja no puede ser anterior a la fecha de alta");
      }
    });

    test("falla si fin de garantía es anterior a fecha de alta", () => {
      const result = validateEquipmentForm(
        {
          ...baseValid,
          purchaseDate: "2024-05-01",
          warrantyEndDate: "2024-04-01",
        },
        false,
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("fin de garantía no puede ser anterior a la fecha de alta");
      }
    });
  });

  describe("buildEquipmentPayload", () => {
    test("construye el payload formateado y trimeado para Convex", () => {
      const payload = buildEquipmentPayload(
        {
          finalCode: "  EQ-007  ",
          brand: "  Sony  ",
          name: "  Cámara  ",
          model: "  FX9  ",
          location: "  Plató 2  ",
          description: "Texto de prueba",
          serialNumber: "  SN999  ",
          supplier: "  Farnell  ",
          modelId: "cm_1" as Id<"equipmentModels">,
        },
        {
          purchase: 1700000000000,
          warranty: 1750000000000,
          decommission: undefined,
          interval: 90,
        },
      );

      expect(payload.code).toBe("EQ-007");
      expect(payload.brand).toBe("Sony");
      expect(payload.name).toBe("Cámara");
      expect(payload.model).toBe("FX9");
      expect(payload.location).toBe("Plató 2");
      expect(payload.serialNumber).toBe("SN999");
      expect(payload.supplier).toBe("Farnell");
      expect(payload.maintenanceIntervalDays).toBe(90);
      expect(payload.modelId).toBe("cm_1");
    });
  });
});
