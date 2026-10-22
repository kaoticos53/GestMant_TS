import { describe, expect, it } from "vitest";
import {
  buildManualsSortColumns,
  formatManualBrandModel,
} from "../src/pages/dashboard/manuals/helpers/columns";
import type { EquipmentDoc, ManualDoc } from "../src/pages/dashboard/manuals/types";

describe("manualsColumns", () => {
  describe("formatManualBrandModel", () => {
    it("concatena marca y modelo con el separador cuando ambos existen", () => {
      expect(formatManualBrandModel("Toyota", "8FGF25")).toBe("Toyota · 8FGF25");
    });

    it("devuelve solo la marca si el modelo no está definido", () => {
      expect(formatManualBrandModel("Toyota", undefined)).toBe("Toyota");
      expect(formatManualBrandModel("Toyota", "")).toBe("Toyota");
    });

    it("devuelve solo el modelo si la marca no está definida", () => {
      expect(formatManualBrandModel(undefined, "8FGF25")).toBe("8FGF25");
      expect(formatManualBrandModel("", "8FGF25")).toBe("8FGF25");
    });

    it("devuelve cadena vacía si ninguno está definido", () => {
      expect(formatManualBrandModel(undefined, undefined)).toBe("");
      expect(formatManualBrandModel("", "")).toBe("");
    });
  });

  describe("buildManualsSortColumns", () => {
    const mockEquipment: EquipmentDoc = {
      _id: "eq_1" as any,
      _creationTime: 1000,
      name: "Torno Paralelo",
      location: "Taller A",
      model: "Pinacho L-1",
      status: "operational",
    } as unknown as EquipmentDoc;

    const mockManual: ManualDoc = {
      _id: "m_1" as any,
      _creationTime: 1000,
      title: "Manual de Uso Pinacho",
      type: "manual",
      brand: "Pinacho",
      model: "L-1",
      updatedAt: 1774000000000,
      equipmentId: "eq_1" as any,
      history: [],
      kind: "file",
      createdAt: 1000,
    } as unknown as ManualDoc;

    it("resuelve correctamente los valores de cada columna con equipo vinculado", () => {
      const columns = buildManualsSortColumns((m) =>
        m.equipmentId === "eq_1" ? mockEquipment : undefined
      );

      expect(columns.manual.value(mockManual)).toBe("Manual de Uso Pinacho");
      expect(columns.type.value(mockManual)).toBe("manual");
      expect(columns.brandModel.value(mockManual)).toBe("Pinacho · L-1");
      expect(columns.equipment.value(mockManual)).toBe("Torno Paralelo Pinacho L-1");
      expect(columns.updated.value(mockManual)).toBe(1774000000000);
    });

    it("devuelve cadena vacía en la columna equipment si no hay equipo vinculado", () => {
      const columns = buildManualsSortColumns(() => undefined);
      expect(columns.equipment.value(mockManual)).toBe("");
    });
  });
});
