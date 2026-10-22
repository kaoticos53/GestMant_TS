import { describe, expect, it } from "vitest";
import {
  EXEMPT_EMPTY_NOTICE_TABS,
  isTabExemptFromEmptyNotice,
} from "@/pages/dashboard/components/content/helpers";

describe("dashboardContentHelpers", () => {
  describe("EXEMPT_EMPTY_NOTICE_TABS", () => {
    it("contiene exactamente las 5 pestañas de gestión y configuración exentas", () => {
      expect(EXEMPT_EMPTY_NOTICE_TABS).toEqual([
        "profile",
        "permissions",
        "settings",
        "archive",
        "audit",
      ]);
    });
  });

  describe("isTabExemptFromEmptyNotice", () => {
    it.each([
      "profile",
      "permissions",
      "settings",
      "archive",
      "audit",
    ])("devuelve true para la pestaña exenta '%s'", (tab) => {
      expect(isTabExemptFromEmptyNotice(tab)).toBe(true);
    });

    it.each([
      "incidents",
      "requests",
      "purchasing",
      "inventory",
      "manuals",
      "machines",
      "equipment",
      "users",
      "",
      "desconocida",
    ])("devuelve false para la pestaña operativa '%s'", (tab) => {
      expect(isTabExemptFromEmptyNotice(tab)).toBe(false);
    });
  });
});
