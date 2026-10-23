import { Boxes } from "lucide-react";
import { describe, expect, it } from "vitest";
import {
  getAvailableTabs,
  resolveActiveTabId,
  resolveDerivedPermissions,
} from "../src/pages/dashboard/settings/view/helpers";
import type { WorkshopTabItem } from "../src/pages/dashboard/settings/view/types";

describe("workshopSettingsView helpers", () => {
  describe("getAvailableTabs", () => {
    it("incluye siempre 'catalogs' y 'models' por defecto", () => {
      const tabs = getAvailableTabs({});
      expect(tabs.map((t) => t.id)).toEqual(["catalogs", "models"]);
    });

    it("agrega 'alerts' si puede gestionar alertas o auditoría", () => {
      const tabsWithAlert = getAvailableTabs({ canManageAlert: true });
      expect(tabsWithAlert.some((t) => t.id === "alerts")).toBe(true);

      const tabsWithAudit = getAvailableTabs({ canManageAudit: true });
      expect(tabsWithAudit.some((t) => t.id === "alerts")).toBe(true);
    });

    it("agrega 'storage' si puede gestionar archivo o purgar subidas", () => {
      const tabsWithArchive = getAvailableTabs({ canManageArchive: true });
      expect(tabsWithArchive.some((t) => t.id === "storage")).toBe(true);

      const tabsWithPurge = getAvailableTabs({ canPurgeUploads: true });
      expect(tabsWithPurge.some((t) => t.id === "storage")).toBe(true);
    });

    it("agrega 'mail' si puede gestionar correo", () => {
      const tabs = getAvailableTabs({ canManageMail: true });
      expect(tabs.some((t) => t.id === "mail")).toBe(true);
    });

    it("agrega 'data' si puede gestionar datos del taller", () => {
      const tabs = getAvailableTabs({ canManageData: true });
      expect(tabs.some((t) => t.id === "data")).toBe(true);
    });

    it("incluye las 6 pestañas cuando todos los permisos están activos", () => {
      const tabs = getAvailableTabs({
        canManageAlert: true,
        canManageAudit: true,
        canManageArchive: true,
        canPurgeUploads: true,
        canManageMail: true,
        canManageData: true,
      });
      expect(tabs.map((t) => t.id)).toEqual([
        "catalogs",
        "models",
        "alerts",
        "storage",
        "mail",
        "data",
      ]);
    });
  });

  describe("resolveActiveTabId", () => {
    const sampleTabs: WorkshopTabItem[] = [
      { id: "catalogs", label: "Catálogos", icon: Boxes },
      { id: "models", label: "Modelos", icon: Boxes },
      { id: "storage", label: "Almacén", icon: Boxes },
    ];

    it("selecciona currentTab si está disponible", () => {
      expect(resolveActiveTabId(sampleTabs, "models", "storage")).toBe("models");
    });

    it("usa defaultTab si currentTab no está disponible", () => {
      expect(resolveActiveTabId(sampleTabs, "inexistente", "storage")).toBe(
        "storage",
      );
    });

    it("cae al primer tab disponible si ni currentTab ni defaultTab son válidos", () => {
      expect(resolveActiveTabId(sampleTabs, "inexistente", "otro_invalido")).toBe(
        "catalogs",
      );
    });

    it("devuelve 'catalogs' como fallback si la lista está vacía", () => {
      expect(resolveActiveTabId([], "models", "storage")).toBe("catalogs");
    });
  });

  describe("resolveDerivedPermissions", () => {
    it("deriva permisos desde alert y archive si no se definen explícitamente", () => {
      const derived = resolveDerivedPermissions({
        canManageAlert: true,
        canManageArchive: false,
      });
      expect(derived.hasManageIncidents).toBe(true);
      expect(derived.hasDecideRequests).toBe(false);

      const derivedArchive = resolveDerivedPermissions({
        canManageAlert: false,
        canManageArchive: true,
      });
      expect(derivedArchive.hasManageIncidents).toBe(true);
      expect(derivedArchive.hasDecideRequests).toBe(true);
    });

    it("respeta valores explícitos ignorando los fallbacks derivados", () => {
      const derived = resolveDerivedPermissions({
        canManageAlert: true,
        canManageArchive: true,
        canManageIncidents: false,
        canDecideRequests: false,
      });
      expect(derived.hasManageIncidents).toBe(false);
      expect(derived.hasDecideRequests).toBe(false);
    });
  });
});
