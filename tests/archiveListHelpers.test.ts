import { describe, expect, it } from "vitest";
import {
  canRestoreEntry,
  getEmptyStateDescription,
  getEmptyStateTitle,
} from "@/pages/dashboard/archive/components/list/helpers";

describe("archiveList helpers", () => {
  describe("getEmptyStateTitle", () => {
    it("devuelve mensaje de búsqueda si search no está vacío", () => {
      expect(getEmptyStateTitle("motor", 50)).toBe(
        "Nada en el archivo coincide con «motor»",
      );
    });

    it("devuelve archivo vacío si no hay búsqueda y totalEntries es 0", () => {
      expect(getEmptyStateTitle("", 0)).toBe("El archivo está vacío");
    });

    it("devuelve filtro vacío si no hay búsqueda pero hay registros totales", () => {
      expect(getEmptyStateTitle("", 10)).toBe(
        "No hay fichas de ese tipo en el archivo",
      );
    });
  });

  describe("getEmptyStateDescription", () => {
    it("devuelve sugerencia de búsqueda si search no está vacío", () => {
      expect(getEmptyStateDescription("bomba", 5)).toContain(
        "Prueba con otra referencia",
      );
    });

    it("devuelve explicación pedagógica cuando el archivo está totalmente vacío", () => {
      expect(getEmptyStateDescription("", 0)).toContain(
        "Aquí van las incidencias cerradas",
      );
    });

    it("sugiere cambiar el filtro si hay otras fichas", () => {
      expect(getEmptyStateDescription("", 12)).toBe(
        "Cambia el filtro para ver el resto del archivo.",
      );
    });
  });

  describe("canRestoreEntry", () => {
    it("para incidencias evalúa canArchiveIncidents", () => {
      expect(canRestoreEntry("incident", true, false)).toBe(true);
      expect(canRestoreEntry("incident", false, true)).toBe(false);
    });

    it("para peticiones de repuesto evalúa canArchiveRequests", () => {
      expect(canRestoreEntry("request", false, true)).toBe(true);
      expect(canRestoreEntry("request", true, false)).toBe(false);
    });
  });
});
