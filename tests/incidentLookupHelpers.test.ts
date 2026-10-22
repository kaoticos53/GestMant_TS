import { describe, expect, test } from "vitest";
import {
  confusableNote,
  getTrackingCurrentSince,
  getTrackingEquipmentTitle,
  getTrackingMissingParts,
} from "@/pages/dashboard/lookup/helpers";

describe("incidentLookupHelpers", () => {
  describe("confusableNote", () => {
    test("formatea mensaje para un único carácter confuso", () => {
      const note = confusableNote("O");
      expect(note).toContain("la «O»");
      expect(note).toContain("se confunde con el cero o el uno");
    });

    test("formatea mensaje para múltiples caracteres confusos", () => {
      const note = confusableNote("OI");
      expect(note).toContain("«O» o «I»");
      expect(note).toContain("se confunden con el cero o el uno");
    });
  });

  describe("getTrackingEquipmentTitle", () => {
    test("combina tipo y modelo correctamente", () => {
      expect(
        getTrackingEquipmentTitle({
          equipmentKind: "Cámara",
          model: "HDC-3500",
        }),
      ).toBe("Cámara · HDC-3500");
    });

    test("funciona con solo tipo o solo modelo", () => {
      expect(
        getTrackingEquipmentTitle({
          equipmentKind: "Monitor",
          model: null,
        }),
      ).toBe("Monitor");
      expect(
        getTrackingEquipmentTitle({
          equipmentKind: null,
          model: "PVM-A250",
        }),
      ).toBe("PVM-A250");
    });

    test("muestra fallback si no hay datos de equipo", () => {
      expect(getTrackingEquipmentTitle({})).toBe("Equipo sin identificar");
    });
  });

  describe("getTrackingCurrentSince", () => {
    test("retorna timestamp del último paso si el caso está abierto y hay más de un evento", () => {
      const result = getTrackingCurrentSince({
        closedAt: null,
        history: [{ at: 1000 }, { at: 2500 }],
      });
      expect(result).toBe(2500);
    });

    test("retorna null si el caso ya está cerrado", () => {
      const result = getTrackingCurrentSince({
        closedAt: 3000,
        history: [{ at: 1000 }, { at: 2500 }],
      });
      expect(result).toBeNull();
    });

    test("retorna null si solo hay un evento histórico (la creación)", () => {
      const result = getTrackingCurrentSince({
        closedAt: null,
        history: [{ at: 1000 }],
      });
      expect(result).toBeNull();
    });
  });

  describe("getTrackingMissingParts", () => {
    const parts = [{ name: "Fusible", quantity: 2, since: 1000 }];

    test("devuelve repuestos si el caso no está cerrado", () => {
      expect(
        getTrackingMissingParts({ closedAt: null, pendingParts: parts }),
      ).toEqual(parts);
    });

    test("devuelve array vacío si el caso está cerrado", () => {
      expect(
        getTrackingMissingParts({ closedAt: 2000, pendingParts: parts }),
      ).toEqual([]);
    });

    test("devuelve array vacío si pendingParts es nulo o indefinido", () => {
      expect(
        getTrackingMissingParts({ closedAt: null, pendingParts: null }),
      ).toEqual([]);
    });
  });
});
