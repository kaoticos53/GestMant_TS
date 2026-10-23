import { describe, expect, it, vi } from "vitest";
import {
  MODULE_META,
  buildDashboardStats,
  buildHeaderActions,
  buildNavItems,
  computeNavBadges,
  getHeadingInfo,
  isSummaryHidden,
  type WorkshopSummaryData,
} from "../src/pages/dashboard/constants/navConfig";

describe("navConfig", () => {
  it("MODULE_META contiene información válida para todos los NavId", () => {
    expect(MODULE_META.incidents.title).toBe("Incidencias");
    expect(MODULE_META.requests.title).toBe("Peticiones de repuesto");
    expect(MODULE_META.inventory.title).toBe("Repuestos");
    expect(MODULE_META.equipment.title).toBe("Equipos");
  });

  describe("buildNavItems", () => {
    it("filtra items según capacidades del usuario y modo invitado", () => {
      const allCan = () => true;
      const navAll = buildNavItems({
        can: allCan,
        adminOk: true,
        isGuest: false,
        canSeePurchasing: true,
      });
      const idsAll = navAll.map((item) => item.id);
      expect(idsAll).toContain("incidents");
      expect(idsAll).toContain("requests");
      expect(idsAll).toContain("purchasing");
      expect(idsAll).toContain("inventory");
      expect(idsAll).toContain("equipment");
      expect(idsAll).toContain("manuals");
      expect(idsAll).toContain("machines");
      expect(idsAll).toContain("archive");
      expect(idsAll).toContain("audit");
      expect(idsAll).toContain("users");
      expect(idsAll).toContain("permissions");
      expect(idsAll).toContain("settings");

      // Para un usuario invitado o con permisos restringidos
      const guestCan = (cap: string) => cap === "viewIncidents";
      const navGuest = buildNavItems({
        can: guestCan,
        adminOk: false,
        isGuest: true,
        canSeePurchasing: false,
      });
      const idsGuest = navGuest.map((item) => item.id);
      expect(idsGuest).toContain("incidents");
      expect(idsGuest).not.toContain("manuals");
      expect(idsGuest).not.toContain("machines");
      expect(idsGuest).not.toContain("users");
      expect(idsGuest).not.toContain("purchasing");
    });
  });

  describe("computeNavBadges", () => {
    it("calcula badges numéricos con summary presente", () => {
      const summary = {
        incidents: { reported: 5 },
        requests: { pending: 3, urgent: 1, withoutReference: 0, issued: 10, active: 4 },
        purchasing: { pending: 2 },
        equipment: 12,
        manuals: 7,
        parts: { total: 40, lowStock: 3 },
      } as unknown as WorkshopSummaryData;

      const badges = computeNavBadges(summary);
      expect(badges.incidents).toBe(5);
      expect(badges.requests).toBe(3);
      expect(badges.purchasing).toBe(2);
      expect(badges.equipment).toBe(12);
      expect(badges.manuals).toBe(7);
      expect(badges.inventory).toBe(40);
    });

    it("devuelve ceros cuando el summary es undefined", () => {
      const badges = computeNavBadges(undefined);
      expect(badges.incidents).toBe(0);
      expect(badges.requests).toBe(0);
      expect(badges.equipment).toBe(0);
    });
  });

  describe("buildDashboardStats e isSummaryHidden", () => {
    it("genera métricas solo para las capacidades concedidas", () => {
      const summary = {
        requests: { pending: 2, urgent: 1, withoutReference: 1, issued: 4, active: 2 },
        parts: { lowStock: 2, total: 20 },
      } as unknown as WorkshopSummaryData;

      const openRequests = vi.fn();
      const openInventory = vi.fn();

      const stats = buildDashboardStats({
        summary,
        can: (cap) => cap === "viewRequests" || cap === "viewInventory",
        openRequests,
        openInventory,
      });

      expect(stats.length).toBe(4);
      expect(stats[0].label).toBe("Peticiones pendientes");
      expect(stats[0].value).toBe(2);
      stats[0].go();
      expect(openRequests).toHaveBeenCalledWith("pending");

      stats[1].go();
      expect(openInventory).toHaveBeenCalledWith(true);
    });

    it("detecta pestañas donde el summary debe ocultarse", () => {
      expect(isSummaryHidden("profile", 4)).toBe(true);
      expect(isSummaryHidden("settings", 4)).toBe(true);
      expect(isSummaryHidden("permissions", 4)).toBe(true);
      expect(isSummaryHidden("incidents", 0)).toBe(true);
      expect(isSummaryHidden("incidents", 4)).toBe(false);
      expect(isSummaryHidden("requests", 2)).toBe(false);
    });
  });

  describe("getHeadingInfo y buildHeaderActions", () => {
    it("devuelve encabezado adaptado a invitados o usuarios con sesión", () => {
      const guestHeading = getHeadingInfo("incidents", true, undefined);
      expect(guestHeading.title).toBe("Sesión de invitado");
      expect(guestHeading.count).toBeNull();

      const userHeading = getHeadingInfo("incidents", false, {
        incidents: { reported: 8 },
      } as unknown as WorkshopSummaryData);
      expect(userHeading.title).toBe("Incidencias");
      expect(userHeading.count).toBe(8);
    });

    it("construye acciones de cabecera contextuales", () => {
      const onOpenWeeklyReport = vi.fn();
      const onRestoreAlert = vi.fn();
      const onSeedMore = vi.fn();

      const actions = buildHeaderActions({
        canConfigureReport: true,
        onOpenWeeklyReport,
        seesAlert: true,
        hasStaleWork: true,
        alertDismissed: true,
        onRestoreAlert,
        canManageInventory: true,
        isEmpty: false,
        isSeedingMore: false,
        loading: false,
        onSeedMore,
      });

      expect(actions.length).toBe(3);
      actions[0].onSelect();
      expect(onOpenWeeklyReport).toHaveBeenCalled();
      actions[1].onSelect();
      expect(onRestoreAlert).toHaveBeenCalled();
      actions[2].onSelect();
      expect(onSeedMore).toHaveBeenCalled();
    });
  });
});
