import { describe, expect, it } from "vitest";
import {
  DENSITY_OPTIONS,
  resolveIsCompact,
  shouldShowDensity,
} from "../src/components/dataTableToolbar/helpers";

describe("dataTableToolbar helpers", () => {
  describe("resolveIsCompact", () => {
    it("prioriza la prop booleana compact sobre density", () => {
      expect(resolveIsCompact(true, "comfortable")).toBe(true);
      expect(resolveIsCompact(false, "compact")).toBe(false);
    });

    it("evalúa density cuando compact es undefined", () => {
      expect(resolveIsCompact(undefined, "compact")).toBe(true);
      expect(resolveIsCompact(undefined, "comfortable")).toBe(false);
    });

    it("devuelve undefined cuando ambas props son undefined", () => {
      expect(resolveIsCompact(undefined, undefined)).toBeUndefined();
    });
  });

  describe("shouldShowDensity", () => {
    it("devuelve true solo si isCompact está definido y hay callback", () => {
      expect(shouldShowDensity(true, true)).toBe(true);
      expect(shouldShowDensity(false, true)).toBe(true);
      expect(shouldShowDensity(true, false)).toBe(false);
      expect(shouldShowDensity(undefined, true)).toBe(false);
      expect(shouldShowDensity(undefined, false)).toBe(false);
    });
  });

  describe("DENSITY_OPTIONS", () => {
    it("contiene exactamente las 2 opciones: cómoda y compacta", () => {
      expect(DENSITY_OPTIONS).toHaveLength(2);
      expect(DENSITY_OPTIONS[0].id).toBe("comfortable");
      expect(DENSITY_OPTIONS[0].compactValue).toBe(false);
      expect(DENSITY_OPTIONS[1].id).toBe("compact");
      expect(DENSITY_OPTIONS[1].compactValue).toBe(true);
    });
  });
});
