import { describe, expect, test } from "vitest";
import {
  analyzeInputMatches,
  calculateSimilarity,
  damerauLevenshteinDistance,
  normalizeCatalogString,
} from "../src/lib/catalogs";

describe("Catálogos y Autocompletado (src/lib/catalogs.ts)", () => {
  describe("normalización de texto", () => {
    test("elimina acentos, mayúsculas y espacios duplicados", () => {
      expect(normalizeCatalogString("  Panasónic   ")).toBe("panasonic");
      expect(normalizeCatalogString("Plató   1")).toBe("plato 1");
      expect(normalizeCatalogString("CÁMARAS")).toBe("camaras");
    });
  });

  describe("distancia Damerau-Levenshtein", () => {
    test("detecta igualdad exacta tras normalización", () => {
      expect(damerauLevenshteinDistance("Sony", "SONY")).toBe(0);
      expect(damerauLevenshteinDistance("Plató 1", "Plato 1")).toBe(0);
    });

    test("detecta sustitución simple (distancia = 1)", () => {
      expect(damerauLevenshteinDistance("Soni", "Sony")).toBe(1);
    });

    test("detecta transposición adyacente (distancia = 1)", () => {
      expect(damerauLevenshteinDistance("Pansaoinc", "Panasonic")).toBe(2);
      expect(damerauLevenshteinDistance("Sney", "Sony")).toBe(2);
      expect(damerauLevenshteinDistance("caon", "canon")).toBe(1);
    });

    test("detecta inserción y eliminación", () => {
      expect(damerauLevenshteinDistance("Panasonik", "Panasonic")).toBe(1);
      expect(damerauLevenshteinDistance("Farnel", "Farnell")).toBe(1);
    });
  });

  describe("similitud porcentual", () => {
    test("idénticos dan 1.0", () => {
      expect(calculateSimilarity("Canon", "canon")).toBe(1.0);
    });

    test("erratas leves dan similitud alta (> 0.75)", () => {
      expect(calculateSimilarity("Farnel", "Farnell")).toBeGreaterThan(0.8);
      expect(calculateSimilarity("Panasnic", "Panasonic")).toBeGreaterThan(0.85);
    });
  });

  describe("análisis de coincidencias y sugerencia de erratas", () => {
    const catalogoMarcas = [
      { name: "Sony", normalized: "sony" },
      { name: "Panasonic", normalized: "panasonic" },
      { name: "Canon", normalized: "canon" },
      { name: "Blackmagic Design", normalized: "blackmagic design" },
    ];

    test("reconoce match exacto", () => {
      const res = analyzeInputMatches("SONY", catalogoMarcas);
      expect(res.exactMatch?.name).toBe("Sony");
      expect(res.bestTypoSuggestion).toBeNull();
    });

    test("sugiere '¿Quisiste decir Panasonic?' ante 'Panasnic'", () => {
      const res = analyzeInputMatches("Panasnic", catalogoMarcas);
      expect(res.exactMatch).toBeNull();
      expect(res.bestTypoSuggestion?.item.name).toBe("Panasonic");
      expect(res.bestTypoSuggestion?.distance).toBe(1);
    });

    test("sugiere '¿Quisiste decir Canon?' ante 'Cnon'", () => {
      const res = analyzeInputMatches("Cnon", catalogoMarcas);
      expect(res.exactMatch).toBeNull();
      expect(res.bestTypoSuggestion?.item.name).toBe("Canon");
    });
  });

  describe("separación de tipos de catálogo (CATALOG_KIND_LABELS)", () => {
    test("diferencia claramente entre ubicación de equipo y ubicación de repuesto en almacén", async () => {
      const { CATALOG_KIND_LABELS } = await import("../src/lib/catalogs");
      expect(CATALOG_KIND_LABELS.equipmentLocation).toBeDefined();
      expect(CATALOG_KIND_LABELS.partLocation).toBeDefined();
      expect(CATALOG_KIND_LABELS.equipmentLocation.label).not.toEqual(
        CATALOG_KIND_LABELS.partLocation.label,
      );
      expect(CATALOG_KIND_LABELS.equipmentLocation.singular).toContain("equipo");
      expect(CATALOG_KIND_LABELS.partLocation.singular).toContain("almacén");
    });

    test("incluye catálogo para empresas externas y SAT", async () => {
      const { CATALOG_KIND_LABELS } = await import("../src/lib/catalogs");
      expect(CATALOG_KIND_LABELS.externalWorkshop).toBeDefined();
      expect(CATALOG_KIND_LABELS.externalWorkshop.label).toContain("Empresas externas");
      expect(CATALOG_KIND_LABELS.externalWorkshop.singular).toContain("SAT");
    });
  });
});

