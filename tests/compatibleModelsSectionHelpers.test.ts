import { describe, expect, it } from "vitest";
import type { Id } from "../src/convex/_generated/dataModel";
import {
  checkHasExactMatch,
  modelLabel,
  resolveCompatibleModels,
  resolveModelsMap,
  searchCompatibleModels,
} from "../src/pages/dashboard/inventory/components/compatibleModels/helpers";
import type { EquipmentModelDoc } from "../src/pages/dashboard/inventory/types";

describe("compatibleModelsSectionHelpers", () => {
  const dummyModels: EquipmentModelDoc[] = [
    {
      _id: "mod-1" as Id<"equipmentModels">,
      _creationTime: 1000,
      model: "HDC-3500",
      brand: "Sony",
      name: "Cámara de estudio 4K",
      category: "Broadcast",
    },
    {
      _id: "mod-2" as Id<"equipmentModels">,
      _creationTime: 2000,
      model: "URSA Mini Pro",
      brand: "Blackmagic",
      name: "Cámara de cine digital",
      category: "Cine",
    },
    {
      _id: "mod-3" as Id<"equipmentModels">,
      _creationTime: 3000,
      model: "Custom-Generic",
      name: "Equipo genérico sin marca",
      category: "Auxiliar",
    },
  ];

  describe("modelLabel", () => {
    it("incluye la marca si está disponible", () => {
      expect(modelLabel(dummyModels[0])).toBe("Sony HDC-3500");
    });

    it("devuelve solo el modelo si no tiene marca", () => {
      expect(modelLabel(dummyModels[2])).toBe("Custom-Generic");
    });
  });

  describe("resolveModelsMap", () => {
    it("crea un Map indexado por _id", () => {
      const map = resolveModelsMap(dummyModels);
      expect(map.size).toBe(3);
      expect(map.get("mod-1" as Id<"equipmentModels">)?.model).toBe("HDC-3500");
    });

    it("devuelve mapa vacío si no hay modelos", () => {
      const map = resolveModelsMap([]);
      expect(map.size).toBe(0);
    });
  });

  describe("resolveCompatibleModels", () => {
    it("resuelve los documentos de los IDs seleccionados en orden", () => {
      const map = resolveModelsMap(dummyModels);
      const selected = [
        "mod-2" as Id<"equipmentModels">,
        "mod-1" as Id<"equipmentModels">,
      ];
      const resolved = resolveCompatibleModels(selected, map);
      expect(resolved).toHaveLength(2);
      expect(resolved[0]._id).toBe("mod-2");
      expect(resolved[1]._id).toBe("mod-1");
    });

    it("descarta IDs inexistentes en el catálogo", () => {
      const map = resolveModelsMap(dummyModels);
      const selected = [
        "mod-1" as Id<"equipmentModels">,
        "mod-inexistente" as Id<"equipmentModels">,
      ];
      const resolved = resolveCompatibleModels(selected, map);
      expect(resolved).toHaveLength(1);
      expect(resolved[0]._id).toBe("mod-1");
    });
  });

  describe("searchCompatibleModels", () => {
    it("devuelve lista vacía si la consulta está vacía o son solo espacios", () => {
      expect(searchCompatibleModels(dummyModels, [], "")).toEqual([]);
      expect(searchCompatibleModels(dummyModels, [], "   ")).toEqual([]);
    });

    it("encuentra modelos por marca, modelo o categoría", () => {
      const byBrand = searchCompatibleModels(dummyModels, [], "Sony");
      expect(byBrand).toHaveLength(1);
      expect(byBrand[0]._id).toBe("mod-1");

      const byCat = searchCompatibleModels(dummyModels, [], "Cine");
      expect(byCat).toHaveLength(1);
      expect(byCat[0]._id).toBe("mod-2");
    });

    it("excluye los modelos que ya están en compatibleModelIds", () => {
      const matches = searchCompatibleModels(
        dummyModels,
        ["mod-1" as Id<"equipmentModels">],
        "Sony",
      );
      expect(matches).toHaveLength(0);
    });

    it("respeta el límite máximo de resultados", () => {
      const manyModels: EquipmentModelDoc[] = Array.from({ length: 10 }, (_, i) => ({
        _id: `mod-${i}` as Id<"equipmentModels">,
        _creationTime: i,
        model: `Model-${i}`,
        brand: "Toyota",
        name: `Máquina ${i}`,
      }));
      const matches = searchCompatibleModels(manyModels, [], "Toyota", 3);
      expect(matches).toHaveLength(3);
    });
  });

  describe("checkHasExactMatch", () => {
    it("devuelve true si la consulta está vacía", () => {
      expect(checkHasExactMatch(dummyModels, "")).toBe(true);
      expect(checkHasExactMatch(dummyModels, "   ")).toBe(true);
    });

    it("detecta coincidencia exacta por model sin distinguir mayúsculas", () => {
      expect(checkHasExactMatch(dummyModels, "hdc-3500")).toBe(true);
      expect(checkHasExactMatch(dummyModels, "HDC-3500")).toBe(true);
    });

    it("detecta coincidencia exacta por modelLabel (marca + modelo)", () => {
      expect(checkHasExactMatch(dummyModels, "Sony HDC-3500")).toBe(true);
      expect(checkHasExactMatch(dummyModels, "sony hdc-3500")).toBe(true);
    });

    it("devuelve false si no hay coincidencia exacta completa", () => {
      expect(checkHasExactMatch(dummyModels, "HDC-350")).toBe(false);
      expect(checkHasExactMatch(dummyModels, "Sony")).toBe(false);
      expect(checkHasExactMatch(dummyModels, "Inexistente")).toBe(false);
    });
  });
});
