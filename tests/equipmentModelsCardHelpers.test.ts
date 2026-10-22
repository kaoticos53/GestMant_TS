import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  computeModelUsageStats,
  filterEquipmentModels,
  getCannotDeleteReason,
} from "@/pages/dashboard/settings/equipmentModels/helpers";
import type {
  EquipmentDoc,
  EquipmentModelDoc,
  ManualDoc,
  PartDoc,
  UsageStats,
} from "@/pages/dashboard/settings/equipmentModels/types";

describe("equipmentModelsCard helpers", () => {
  const model1Id = "model-1" as Id<"equipmentModels">;
  const model2Id = "model-2" as Id<"equipmentModels">;

  const mockModels: EquipmentModelDoc[] = [
    {
      _id: model1Id,
      _creationTime: 1,
      brand: "Sony",
      model: "HDC-3500",
      name: "Cámara de estudio 4K",
      category: "Cámaras",
    } as EquipmentModelDoc,
    {
      _id: model2Id,
      _creationTime: 2,
      brand: "Blackmagic",
      model: "ATEM Mini Pro",
      name: "Mezclador de vídeo",
      category: "Vídeo",
    } as EquipmentModelDoc,
  ];

  describe("computeModelUsageStats", () => {
    it("calcula recuentos exactos para equipos, repuestos compatibles y manuales", () => {
      const equipment: EquipmentDoc[] = [
        { _id: "eq1", modelId: model1Id } as unknown as EquipmentDoc,
        { _id: "eq2", modelId: model1Id } as unknown as EquipmentDoc,
        { _id: "eq3", modelId: undefined } as unknown as EquipmentDoc,
      ];

      const parts: PartDoc[] = [
        { _id: "p1", compatibleModels: [model1Id, model2Id] } as unknown as PartDoc,
        { _id: "p2", compatibleModels: [model1Id] } as unknown as PartDoc,
      ];

      const manuals: ManualDoc[] = [
        { _id: "m1", modelId: model2Id } as unknown as ManualDoc,
      ];

      const stats = computeModelUsageStats(equipment, parts, manuals);

      expect(stats.equipCount.get(model1Id)).toBe(2);
      expect(stats.equipCount.get(model2Id)).toBeUndefined();

      expect(stats.partsCount.get(model1Id)).toBe(2);
      expect(stats.partsCount.get(model2Id)).toBe(1);

      expect(stats.manualsCount.get(model1Id)).toBeUndefined();
      expect(stats.manualsCount.get(model2Id)).toBe(1);
    });
  });

  describe("filterEquipmentModels", () => {
    it("retorna todos los modelos si el término de búsqueda está vacío", () => {
      expect(filterEquipmentModels(mockModels, "")).toHaveLength(2);
      expect(filterEquipmentModels(mockModels, "   ")).toHaveLength(2);
    });

    it("filtra por marca ignorando mayúsculas", () => {
      const result = filterEquipmentModels(mockModels, "sony");
      expect(result).toHaveLength(1);
      expect(result[0]?._id).toBe(model1Id);
    });

    it("filtra por código de modelo", () => {
      const result = filterEquipmentModels(mockModels, "atem");
      expect(result).toHaveLength(1);
      expect(result[0]?._id).toBe(model2Id);
    });

    it("filtra por nombre descriptivo", () => {
      const result = filterEquipmentModels(mockModels, "mezclador");
      expect(result).toHaveLength(1);
      expect(result[0]?._id).toBe(model2Id);
    });

    it("filtra por categoría", () => {
      const result = filterEquipmentModels(mockModels, "cámaras");
      expect(result).toHaveLength(1);
      expect(result[0]?._id).toBe(model1Id);
    });

    it("retorna lista vacía si no hay coincidencias", () => {
      expect(filterEquipmentModels(mockModels, "panasonic")).toHaveLength(0);
    });
  });

  describe("getCannotDeleteReason", () => {
    const stats: UsageStats = {
      equipCount: new Map([[model1Id, 3]]),
      partsCount: new Map([[model1Id, 5]]),
      manualsCount: new Map([[model2Id, 1]]),
    };

    it("retorna null si modelId es undefined", () => {
      expect(getCannotDeleteReason(undefined, stats)).toBeNull();
    });

    it("bloquea y avisa si hay equipos físicos asociados", () => {
      const reason = getCannotDeleteReason(model1Id, stats);
      expect(reason).toContain("Hay 3 equipo(s) en inventario con este modelo");
    });

    it("bloquea y avisa si hay manuales asociados", () => {
      const reason = getCannotDeleteReason(model2Id, stats);
      expect(reason).toContain("Hay 1 manual(es) asignados a este modelo");
    });

    it("permite borrar (null) si no hay equipos ni manuales (aunque haya repuestos compatibles)", () => {
      const modelCleanId = "clean" as Id<"equipmentModels">;
      expect(getCannotDeleteReason(modelCleanId, stats)).toBeNull();
    });
  });
});
