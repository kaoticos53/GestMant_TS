import { describe, expect, it } from "vitest";
import {
  CONFIRM_WORD,
  formatPurchasingSeedSummary,
  formatResetSummary,
  formatSeedSummary,
  isVaciarConfirmed,
} from "../src/pages/dashboard/settings/workshopData/helpers";

describe("workshopDataCard helpers", () => {
  describe("CONFIRM_WORD & isVaciarConfirmed", () => {
    it("debe tener 'VACIAR' como palabra de confirmación", () => {
      expect(CONFIRM_WORD).toBe("VACIAR");
    });

    it("valida positivamente la palabra exacta en mayúsculas, minúsculas o con espacios", () => {
      expect(isVaciarConfirmed("VACIAR")).toBe(true);
      expect(isVaciarConfirmed("vaciar")).toBe(true);
      expect(isVaciarConfirmed("  Vaciar  ")).toBe(true);
      expect(isVaciarConfirmed("VaCiAr")).toBe(true);
    });

    it("rechaza entradas incorrectas o vacías", () => {
      expect(isVaciarConfirmed("")).toBe(false);
      expect(isVaciarConfirmed("   ")).toBe(false);
      expect(isVaciarConfirmed("borrar")).toBe(false);
      expect(isVaciarConfirmed("VACIARLO")).toBe(false);
    });
  });

  describe("formatSeedSummary", () => {
    it("devuelve mensaje base si no hay fotos ni manuales", () => {
      expect(formatSeedSummary(0, 0)).toBe("Datos de ejemplo cargados");
    });

    it("incluye aviso de fotos cuando solo hay fotos", () => {
      expect(formatSeedSummary(3, 0)).toBe(
        "Datos de ejemplo cargados · 3 fotos del formulario esperando limpieza",
      );
    });

    it("incluye aviso de manuales cuando solo hay manuales", () => {
      expect(formatSeedSummary(0, 5)).toBe(
        "Datos de ejemplo cargados · 5 manuales",
      );
    });

    it("combina ambos avisos cuando hay fotos y manuales", () => {
      expect(formatSeedSummary(2, 4)).toBe(
        "Datos de ejemplo cargados · 2 fotos del formulario esperando limpieza · 4 manuales",
      );
    });
  });

  describe("formatPurchasingSeedSummary", () => {
    it("formatea correctamente peticiones y órdenes", () => {
      expect(formatPurchasingSeedSummary(8, 3)).toBe(
        "Compras de ejemplo · 8 peticiones de compra en 3 órdenes",
      );
    });
  });

  describe("formatResetSummary", () => {
    it("indica que ya estaba vacío cuando deletedCount es 0", () => {
      expect(formatResetSummary(0)).toBe("El taller ya estaba vacío");
    });

    it("formatea singular para 1 ficha retirada", () => {
      expect(formatResetSummary(1)).toBe("Taller vacío · 1 ficha retirada");
    });

    it("formatea plural para más de 1 ficha retirada", () => {
      expect(formatResetSummary(42)).toBe("Taller vacío · 42 fichas retiradas");
    });
  });
});
