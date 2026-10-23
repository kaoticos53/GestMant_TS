import { describe, expect, it } from "vitest";
import {
  getInitialModelFormValues,
  validateEquipmentModelForm,
} from "../src/pages/dashboard/settings/modelDialog/helpers";
import type { Id } from "@/convex/_generated/dataModel";
import type { EquipmentModelDoc } from "../src/pages/dashboard/settings/modelDialog/types";

describe("equipmentModelDialogHelpers", () => {
  const existingModel: EquipmentModelDoc = {
    _id: "mod_1" as Id<"equipmentModels">,
    _creationTime: 1000,
    model: "8FGF25",
    name: "Carretilla elevadora diésel",
    brand: "Toyota",
    category: "Elevación",
    defaultSupplier: "Toyota Material Handling",
    defaultMaintenanceIntervalDays: 90,
    description: "Capacidad 2.5T",
  } as unknown as EquipmentModelDoc;

  describe("getInitialModelFormValues", () => {
    it("devuelve valores vacíos para un modelo nuevo (null)", () => {
      const values = getInitialModelFormValues(null);
      expect(values.modelCode).toBe("");
      expect(values.name).toBe("");
      expect(values.brand).toBe("");
      expect(values.category).toBe("");
      expect(values.defaultSupplier).toBe("");
      expect(values.maintenanceInterval).toBe("");
      expect(values.description).toBe("");
    });

    it("rellena los campos con los datos del modelo existente", () => {
      const values = getInitialModelFormValues(existingModel);
      expect(values.modelCode).toBe("8FGF25");
      expect(values.name).toBe("Carretilla elevadora diésel");
      expect(values.brand).toBe("Toyota");
      expect(values.maintenanceInterval).toBe("90");
    });
  });

  describe("validateEquipmentModelForm", () => {
    it("falla si el código de modelo está en blanco", () => {
      const res = validateEquipmentModelForm({
        modelCode: "   ",
        name: "Torno",
        brand: "",
        category: "",
        defaultSupplier: "",
        maintenanceInterval: "",
        description: "",
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("El código o denominación del modelo es obligatorio.");
      }
    });

    it("falla si la designación genérica está en blanco", () => {
      const res = validateEquipmentModelForm({
        modelCode: "8FGF25",
        name: "   ",
        brand: "",
        category: "",
        defaultSupplier: "",
        maintenanceInterval: "",
        description: "",
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("La designación genérica del modelo es obligatoria.");
      }
    });

    it("falla si el intervalo preventivo es 0 o negativo", () => {
      const resZero = validateEquipmentModelForm({
        modelCode: "8FGF25",
        name: "Carretilla",
        brand: "",
        category: "",
        defaultSupplier: "",
        maintenanceInterval: "0",
        description: "",
      });
      expect(resZero.success).toBe(false);
      if (!resZero.success) {
        expect(resZero.error).toBe("El intervalo preventivo debe ser un número entero de días mayor a 0.");
      }

      const resNegative = validateEquipmentModelForm({
        modelCode: "8FGF25",
        name: "Carretilla",
        brand: "",
        category: "",
        defaultSupplier: "",
        maintenanceInterval: "-15",
        description: "",
      });
      expect(resNegative.success).toBe(false);
    });

    it("falla si el intervalo preventivo no es numérico", () => {
      const res = validateEquipmentModelForm({
        modelCode: "8FGF25",
        name: "Carretilla",
        brand: "",
        category: "",
        defaultSupplier: "",
        maintenanceInterval: "dos semanas",
        description: "",
      });
      expect(res.success).toBe(false);
    });

    it("genera el payload normalizado con datos válidos", () => {
      const res = validateEquipmentModelForm({
        modelCode: "  HDC-3500  ",
        name: "  Cámara de estudio 4K  ",
        brand: "  Sony  ",
        category: "  Audiovisual  ",
        defaultSupplier: "  ",
        maintenanceInterval: " 180 ",
        description: "  Sensor 3-CMOS 2/3 pulgada  ",
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.payload.model).toBe("HDC-3500");
        expect(res.payload.name).toBe("Cámara de estudio 4K");
        expect(res.payload.brand).toBe("Sony");
        expect(res.payload.category).toBe("Audiovisual");
        expect(res.payload.defaultSupplier).toBeUndefined();
        expect(res.payload.defaultMaintenanceIntervalDays).toBe(180);
        expect(res.payload.description).toBe("Sensor 3-CMOS 2/3 pulgada");
      }
    });
  });
});
