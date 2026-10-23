import { describe, expect, it } from "vitest";
import {
  canAccessDashboardTab,
  type TabAccessContext,
} from "@/pages/dashboard/components/content/router/helpers";
import type { Capability } from "@/lib/permissions";
import type { NavId } from "@/pages/dashboard/types";

describe("dashboardTabRouter rules", () => {
  const createMockContext = (
    overrides?: Partial<TabAccessContext>,
    allowedCaps: Capability[] = [],
  ): TabAccessContext => ({
    can: (cap: Capability) => allowedCaps.includes(cap),
    canSeePurchasing: false,
    adminOk: false,
    isGuest: false,
    ...overrides,
  });

  describe("canAccessDashboardTab", () => {
    it("permite pestañas base siempre accesibles", () => {
      const ctx = createMockContext();
      const baseTabs: NavId[] = [
        "profile",
        "incidents",
        "requests",
        "archive",
        "settings",
      ];
      for (const tab of baseTabs) {
        expect(canAccessDashboardTab(tab, ctx)).toBe(true);
      }
    });

    it("controla acceso a compras según canSeePurchasing", () => {
      expect(
        canAccessDashboardTab("purchasing", createMockContext({ canSeePurchasing: false })),
      ).toBe(false);
      expect(
        canAccessDashboardTab("purchasing", createMockContext({ canSeePurchasing: true })),
      ).toBe(true);
    });

    it("controla acceso a inventario según viewInventory", () => {
      expect(
        canAccessDashboardTab("inventory", createMockContext({}, [])),
      ).toBe(false);
      expect(
        canAccessDashboardTab("inventory", createMockContext({}, ["viewInventory"])),
      ).toBe(true);
    });

    it("controla acceso a manuales según viewManuals y no ser invitado", () => {
      expect(
        canAccessDashboardTab("manuals", createMockContext({ isGuest: true }, ["viewManuals"])),
      ).toBe(false);
      expect(
        canAccessDashboardTab("manuals", createMockContext({ isGuest: false }, [])),
      ).toBe(false);
      expect(
        canAccessDashboardTab("manuals", createMockContext({ isGuest: false }, ["viewManuals"])),
      ).toBe(true);
    });

    it("controla acceso a máquinas según no ser invitado", () => {
      expect(
        canAccessDashboardTab("machines", createMockContext({ isGuest: true })),
      ).toBe(false);
      expect(
        canAccessDashboardTab("machines", createMockContext({ isGuest: false })),
      ).toBe(true);
    });

    it("controla acceso a equipos según viewEquipment", () => {
      expect(
        canAccessDashboardTab("equipment", createMockContext({}, [])),
      ).toBe(false);
      expect(
        canAccessDashboardTab("equipment", createMockContext({}, ["viewEquipment"])),
      ).toBe(true);
    });

    it("controla acceso a módulos administrativos según adminOk", () => {
      const adminTabs: NavId[] = ["audit", "users", "permissions"];
      for (const tab of adminTabs) {
        expect(
          canAccessDashboardTab(tab, createMockContext({ adminOk: false })),
        ).toBe(false);
        expect(
          canAccessDashboardTab(tab, createMockContext({ adminOk: true })),
        ).toBe(true);
      }
    });
  });
});
