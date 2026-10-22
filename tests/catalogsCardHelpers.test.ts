import { describe, expect, it } from "vitest";
import type { Id } from "../src/convex/_generated/dataModel";
import {
  filterCatalogItems,
  getAvailableMergeTargets,
  validateCatalogItemName,
} from "../src/pages/dashboard/settings/catalogs/helpers";
import type { CatalogItemDoc } from "../src/pages/dashboard/settings/catalogs/types";

describe("catalogsCard helpers", () => {
  const mockItems: CatalogItemDoc[] = [
    {
      _id: "cat_1" as Id<"catalogs">,
      _creationTime: 1000,
      kind: "brand",
      name: "Sony Electronics",
      normalized: "sony electronics",
    },
    {
      _id: "cat_2" as Id<"catalogs">,
      _creationTime: 1001,
      kind: "brand",
      name: "Panasonic Broadcast",
      normalized: "panasonic broadcast",
    },
    {
      _id: "cat_3" as Id<"catalogs">,
      _creationTime: 1002,
      kind: "brand",
      name: "Cámara Réflex",
      normalized: "camara reflex",
    },
  ];

  describe("filterCatalogItems", () => {
    it("retorna todos los elementos si la búsqueda está vacía", () => {
      expect(filterCatalogItems(mockItems, "")).toEqual(mockItems);
      expect(filterCatalogItems(mockItems, "   ")).toEqual(mockItems);
    });

    it("filtra por coincidencia parcial insensible a mayúsculas", () => {
      const results = filterCatalogItems(mockItems, "SONY");
      expect(results).toHaveLength(1);
      expect(results[0]._id).toBe("cat_1");
    });

    it("filtra insensible a tildes (normalización)", () => {
      const results = filterCatalogItems(mockItems, "camara");
      expect(results).toHaveLength(1);
      expect(results[0]._id).toBe("cat_3");

      const resultsWithAccent = filterCatalogItems(mockItems, "CÁMARA");
      expect(resultsWithAccent).toHaveLength(1);
      expect(resultsWithAccent[0]._id).toBe("cat_3");
    });

    it("retorna arreglo vacío si no hay coincidencias", () => {
      expect(filterCatalogItems(mockItems, "Inexistente")).toEqual([]);
    });
  });

  describe("getAvailableMergeTargets", () => {
    it("excluye el elemento de origen de las opciones disponibles", () => {
      const targets = getAvailableMergeTargets(mockItems, "cat_2" as Id<"catalogs">);
      expect(targets).toHaveLength(2);
      expect(targets.find((i) => i._id === "cat_2")).toBeUndefined();
      expect(targets.map((i) => i._id)).toEqual(["cat_1", "cat_3"]);
    });

    it("mantiene todos si el id de origen no existe en la lista", () => {
      const targets = getAvailableMergeTargets(mockItems, "cat_unknown" as Id<"catalogs">);
      expect(targets).toEqual(mockItems);
    });
  });

  describe("validateCatalogItemName", () => {
    it("rechaza nombres vacíos o solo espacios", () => {
      expect(validateCatalogItemName("").valid).toBe(false);
      expect(validateCatalogItemName("   ").valid).toBe(false);
      expect(validateCatalogItemName("").error).toBeDefined();
    });

    it("acepta y recorta nombres válidos", () => {
      const result = validateCatalogItemName("   Canon Inc   ");
      expect(result.valid).toBe(true);
      expect(result.cleaned).toBe("Canon Inc");
      expect(result.error).toBeUndefined();
    });
  });
});
