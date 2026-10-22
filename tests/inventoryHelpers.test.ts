import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  INVENTORY_SORT_COLUMNS,
  countLowStockParts,
  filterInventoryParts,
  modelLabel,
} from "@/pages/dashboard/inventory/helpers";
import type {
  EquipmentDoc,
  EquipmentModelDoc,
  PartDoc,
} from "@/pages/dashboard/inventory/types";

describe("inventory helpers", () => {
  describe("modelLabel", () => {
    it("incluye marca y modelo si la marca está presente", () => {
      const model = {
        _id: "m1" as Id<"equipmentModels">,
        _creationTime: 1,
        brand: "Sony",
        model: "HDC-3500",
      } as EquipmentModelDoc;
      expect(modelLabel(model)).toBe("Sony HDC-3500");
    });

    it("retorna solo el modelo si no tiene marca", () => {
      const model = {
        _id: "m2" as Id<"equipmentModels">,
        _creationTime: 2,
        model: "Custom Rig 100",
      } as EquipmentModelDoc;
      expect(modelLabel(model)).toBe("Custom Rig 100");
    });
  });

  describe("countLowStockParts", () => {
    it("cuenta correctamente repuestos por debajo del stock mínimo o agotados", () => {
      const parts: PartDoc[] = [
        { _id: "p1" as Id<"spareParts">, stock: 0, minStock: 2 } as PartDoc,
        { _id: "p2" as Id<"spareParts">, stock: 1, minStock: 2 } as PartDoc,
        { _id: "p3" as Id<"spareParts">, stock: 5, minStock: 2 } as PartDoc,
      ];
      expect(countLowStockParts(parts)).toBe(2);
    });
  });

  describe("filterInventoryParts", () => {
    const modelSonyId = "model-sony" as Id<"equipmentModels">;
    const catalogModels: EquipmentModelDoc[] = [
      {
        _id: modelSonyId,
        _creationTime: 1,
        brand: "Sony",
        model: "HDC-3500",
      } as EquipmentModelDoc,
    ];

    const equipment: EquipmentDoc[] = [
      {
        _id: "eq-1" as Id<"equipment">,
        _creationTime: 1,
        name: "Cámara Plató 1",
        model: "HDC-3500",
        modelId: modelSonyId,
      } as EquipmentDoc,
    ];

    const parts: PartDoc[] = [
      {
        _id: "p1" as Id<"spareParts">,
        _creationTime: 10,
        code: "CON-01",
        name: "Conector BNC Macho",
        description: "Conector para cable coaxial",
        category: "Conectividad",
        stock: 10,
        minStock: 2,
        location: "A-01",
        supplier: "Neutrik",
        compatibleModels: [modelSonyId],
      } as PartDoc,
      {
        _id: "p2" as Id<"spareParts">,
        _creationTime: 20,
        code: "BAT-99",
        name: "Batería V-Mount",
        description: "Batería Li-ion alta capacidad",
        category: "Energía",
        stock: 1,
        minStock: 3,
        location: "B-05",
        supplier: "SWIT",
        compatibleModels: [],
      } as PartDoc,
    ];

    it("retorna todos los repuestos sin filtros activos", () => {
      const result = filterInventoryParts({
        parts,
        equipment,
        catalogModels,
        category: "all",
        equipmentFilter: "all",
        lowStockOnly: false,
        search: "",
      });
      expect(result).toHaveLength(2);
    });

    it("filtra por categoría seleccionada", () => {
      const result = filterInventoryParts({
        parts,
        equipment,
        catalogModels,
        category: "Energía",
        equipmentFilter: "all",
        lowStockOnly: false,
        search: "",
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.code).toBe("BAT-99");
    });

    it("filtra por equipo y modelo compatible", () => {
      const result = filterInventoryParts({
        parts,
        equipment,
        catalogModels,
        category: "all",
        equipmentFilter: "eq-1",
        lowStockOnly: false,
        search: "",
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.code).toBe("CON-01");
    });

    it("filtra solo repuestos con stock bajo", () => {
      const result = filterInventoryParts({
        parts,
        equipment,
        catalogModels,
        category: "all",
        equipmentFilter: "all",
        lowStockOnly: true,
        search: "",
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.code).toBe("BAT-99");
    });

    it("filtra por texto de búsqueda en nombre, código, ubicación o proveedor", () => {
      expect(
        filterInventoryParts({
          parts,
          equipment,
          catalogModels,
          category: "all",
          equipmentFilter: "all",
          lowStockOnly: false,
          search: "neutrik",
        }),
      ).toHaveLength(1);

      expect(
        filterInventoryParts({
          parts,
          equipment,
          catalogModels,
          category: "all",
          equipmentFilter: "all",
          lowStockOnly: false,
          search: "B-05",
        }),
      ).toHaveLength(1);
    });
  });

  describe("INVENTORY_SORT_COLUMNS", () => {
    it("provee accesores válidos para ordenación", () => {
      const part = {
        name: "Lámpara LED",
        category: "Iluminación",
        location: "D-10",
        stock: 4,
        minStock: 2,
        unitPrice: 45.5,
      } as PartDoc;

      expect(INVENTORY_SORT_COLUMNS.part.value(part)).toBe("Lámpara LED");
      expect(INVENTORY_SORT_COLUMNS.category.value(part)).toBe("Iluminación");
      expect(INVENTORY_SORT_COLUMNS.location.value(part)).toBe("D-10");
      expect(INVENTORY_SORT_COLUMNS.stock.value(part)).toBe(4);
      expect(INVENTORY_SORT_COLUMNS.minStock.value(part)).toBe(2);
      expect(INVENTORY_SORT_COLUMNS.price.value(part)).toBe(45.5);
    });
  });
});
