import { describe, expect, it } from "vitest";
import {
  formatAuthorOption,
  formatSummaryDetails,
  formatTotalMovements,
  isResetDisabled,
} from "../src/pages/dashboard/audit/components/filters/helpers";

describe("auditFiltersCard helpers", () => {
  describe("formatAuthorOption", () => {
    it("formatea singular para 1 movimiento", () => {
      expect(formatAuthorOption("Juan Pérez", 1)).toBe(
        "Juan Pérez · 1 movimiento",
      );
    });

    it("formatea plural para más de 1 movimiento", () => {
      expect(formatAuthorOption("Ana Gómez", 5)).toBe(
        "Ana Gómez · 5 movimientos",
      );
    });
  });

  describe("isResetDisabled", () => {
    it("devuelve true si filterCount es 0 y la búsqueda está vacía o con espacios", () => {
      expect(isResetDisabled(0, "")).toBe(true);
      expect(isResetDisabled(0, "   ")).toBe(true);
    });

    it("devuelve false si hay filtros activos o búsqueda no vacía", () => {
      expect(isResetDisabled(1, "")).toBe(false);
      expect(isResetDisabled(0, "albarán")).toBe(false);
      expect(isResetDisabled(2, "motor")).toBe(false);
    });
  });

  describe("formatTotalMovements", () => {
    it("formatea singular para 1 movimiento", () => {
      expect(formatTotalMovements(1)).toBe("1 movimiento");
    });

    it("formatea plural para múltiples movimientos", () => {
      expect(formatTotalMovements(12)).toBe("12 movimientos");
    });
  });

  describe("formatSummaryDetails", () => {
    it("formatea personas e incidencias en singular sin desglose", () => {
      expect(formatSummaryDetails(1, 1, [])).toBe(
        " · 1 persona · 1 incidencia",
      );
    });

    it("formatea personas e incidencias en plural con desglose", () => {
      expect(formatSummaryDetails(3, 4, ["2 añadidos", "1 eliminado"])).toBe(
        " · 3 personas · 4 incidencias · 2 añadidos · 1 eliminado",
      );
    });
  });
});
