import { describe, expect, it } from "vitest";
import {
  countUnread,
  formatBadgeCount,
  getTriggerAriaLabel,
} from "@/components/notificationBell/helpers";
import type { NotificationRow } from "@/components/notificationBell/types";
import type { Id } from "@/convex/_generated/dataModel";

describe("notificationBell helpers", () => {
  const dummyRow = (id: string, read: boolean): NotificationRow => ({
    _id: id as Id<"notifications">,
    text: `Aviso ${id}`,
    read,
    createdAt: 1000,
  });

  describe("countUnread", () => {
    it("devuelve 0 si la lista es nula o vacía", () => {
      expect(countUnread(undefined)).toBe(0);
      expect(countUnread([])).toBe(0);
    });

    it("cuenta correctamente solo las no leídas", () => {
      const items = [
        dummyRow("1", false),
        dummyRow("2", true),
        dummyRow("3", false),
      ];
      expect(countUnread(items)).toBe(2);
    });

    it("devuelve 0 si todas están leídas", () => {
      const items = [dummyRow("1", true), dummyRow("2", true)];
      expect(countUnread(items)).toBe(0);
    });
  });

  describe("formatBadgeCount", () => {
    it("devuelve el número como texto para valores de 1 a 9", () => {
      expect(formatBadgeCount(1)).toBe("1");
      expect(formatBadgeCount(5)).toBe("5");
      expect(formatBadgeCount(9)).toBe("9");
    });

    it("devuelve '9+' cuando supera 9", () => {
      expect(formatBadgeCount(10)).toBe("9+");
      expect(formatBadgeCount(42)).toBe("9+");
    });
  });

  describe("getTriggerAriaLabel", () => {
    it("indica el número de sin leer si unread > 0", () => {
      expect(getTriggerAriaLabel(1)).toBe("Notificaciones: 1 sin leer");
      expect(getTriggerAriaLabel(7)).toBe("Notificaciones: 7 sin leer");
    });

    it("muestra solo 'Notificaciones' si no hay sin leer", () => {
      expect(getTriggerAriaLabel(0)).toBe("Notificaciones");
    });
  });
});
