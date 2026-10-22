import { describe, expect, it } from "vitest";
import type { Release } from "@/lib/changelog";
import {
  CHANGELOG_CATEGORY_OPTIONS,
  filterReleases,
  getCategoryBadgeClass,
} from "@/pages/../components/changelog/helpers";

const mockReleases: readonly Release[] = [
  {
    version: "1.2.0",
    date: "2026-10-20",
    title: "Nueva gestión de inventario",
    summary: "Se añaden módulos de trazabilidad y avisos.",
    highlights: ["Trazabilidad completa"],
    changes: [
      {
        category: "novedad",
        description: "Incorporación de lectura QR para piezas",
        tag: "Inventario",
      },
      {
        category: "seguridad",
        description: "Auditoría estricta de accesos",
        tag: "Seguridad",
      },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-10-10",
    title: "Correcciones menores en taller",
    summary: "Ajustes de rendimiento y solución de errores.",
    changes: [
      {
        category: "correccion",
        description: "Solución a fallo en recuento de peticiones",
      },
      {
        category: "mejora",
        description: "Mejora en tiempos de carga de la lista",
      },
    ],
  },
];

describe("changelogDialogHelpers", () => {
  describe("CHANGELOG_CATEGORY_OPTIONS", () => {
    it("incluye todas las categorías esperadas", () => {
      const ids = CHANGELOG_CATEGORY_OPTIONS.map((c) => c.id);
      expect(ids).toEqual([
        "todas",
        "novedad",
        "mejora",
        "correccion",
        "seguridad",
      ]);
    });
  });

  describe("getCategoryBadgeClass", () => {
    it("devuelve estilos verde para novedad", () => {
      expect(getCategoryBadgeClass("novedad")).toContain("emerald");
    });

    it("devuelve estilos azul para mejora", () => {
      expect(getCategoryBadgeClass("mejora")).toContain("sky");
    });

    it("devuelve estilos ámbar para correccion", () => {
      expect(getCategoryBadgeClass("correccion")).toContain("amber");
    });

    it("devuelve estilos morado para seguridad", () => {
      expect(getCategoryBadgeClass("seguridad")).toContain("purple");
    });
  });

  describe("filterReleases", () => {
    it("devuelve todas las versiones cuando la búsqueda está vacía y categoría es todas", () => {
      const res = filterReleases(mockReleases, "", "todas");
      expect(res).toHaveLength(2);
    });

    it("filtra por texto en la versión", () => {
      const res = filterReleases(mockReleases, "1.2.0", "todas");
      expect(res).toHaveLength(1);
      expect(res[0].version).toBe("1.2.0");
    });

    it("filtra por texto en la descripción de un cambio", () => {
      const res = filterReleases(mockReleases, "lectura QR", "todas");
      expect(res).toHaveLength(1);
      expect(res[0].changes).toHaveLength(1);
      expect(res[0].changes[0].description).toContain("lectura QR");
    });

    it("filtra por categoría específica", () => {
      const res = filterReleases(mockReleases, "", "seguridad");
      expect(res).toHaveLength(1);
      expect(res[0].version).toBe("1.2.0");
      expect(res[0].changes).toHaveLength(1);
      expect(res[0].changes[0].category).toBe("seguridad");
    });

    it("descarta versiones si ninguno de sus cambios coincide con la categoría", () => {
      const res = filterReleases(mockReleases, "", "novedad");
      expect(res).toHaveLength(1);
      expect(res[0].version).toBe("1.2.0");
    });

    it("aplica defaultVersion si no hay búsqueda activa", () => {
      const res = filterReleases(mockReleases, "", "todas", "v1.1.0");
      expect(res).toHaveLength(1);
      expect(res[0].version).toBe("1.1.0");
    });

    it("ignora defaultVersion si hay texto de búsqueda", () => {
      const res = filterReleases(mockReleases, "inventario", "todas", "v1.1.0");
      expect(res).toHaveLength(1);
      expect(res[0].version).toBe("1.2.0");
    });

    it("devuelve array vacío si no hay coincidencias", () => {
      const res = filterReleases(mockReleases, "término_inexistente_xyz", "todas");
      expect(res).toHaveLength(0);
    });
  });
});
