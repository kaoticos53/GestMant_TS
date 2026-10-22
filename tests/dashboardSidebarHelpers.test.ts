import { describe, expect, it } from "vitest";
import {
  getNavButtonClass,
  getNavPillClass,
} from "@/pages/dashboard/components/sidebar/helpers";

describe("dashboardSidebarHelpers", () => {
  describe("getNavButtonClass", () => {
    it("devuelve clases activas con acento signal cuando active es true", () => {
      const className = getNavButtonClass(true);
      expect(className).toContain("border-signal/30");
      expect(className).toContain("bg-signal/10");
      expect(className).toContain("text-signal");
    });

    it("devuelve clases discretas con borde transparente cuando active es false", () => {
      const className = getNavButtonClass(false);
      expect(className).toContain("border-transparent");
      expect(className).toContain("text-muted-foreground");
      expect(className).toContain("hover:bg-muted");
    });
  });

  describe("getNavPillClass", () => {
    it("devuelve fondo signal y texto contrastado cuando active es true", () => {
      const className = getNavPillClass(true);
      expect(className).toContain("bg-signal");
      expect(className).toContain("text-primary-foreground");
    });

    it("devuelve fondo muted y texto secundario cuando active es false", () => {
      const className = getNavPillClass(false);
      expect(className).toContain("bg-muted");
      expect(className).toContain("text-muted-foreground");
    });
  });
});
