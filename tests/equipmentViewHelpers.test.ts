import { describe, expect, it } from "vitest";
import {
  canAddManualNotes,
  dateToInput,
  getManualRights,
  inputToDate,
} from "@/pages/dashboard/equipment/helpers";

describe("equipmentViewHelpers", () => {
  describe("getManualRights", () => {
    it("asigna manage y userId correctamente cuando están definidos", () => {
      const rights = getManualRights(true, "user_abc");
      expect(rights).toEqual({
        manage: true,
        userId: "user_abc",
      });
    });

    it("convierte undefined en null para userId", () => {
      const rights = getManualRights(false, undefined);
      expect(rights).toEqual({
        manage: false,
        userId: null,
      });
    });

    it("conserva null si se pasa explícitamente", () => {
      const rights = getManualRights(true, null);
      expect(rights).toEqual({
        manage: true,
        userId: null,
      });
    });
  });

  describe("canAddManualNotes", () => {
    it("devuelve true si el usuario puede escribir notas", () => {
      expect(canAddManualNotes(true, false)).toBe(true);
    });

    it("devuelve true si el usuario puede gestionar manuales", () => {
      expect(canAddManualNotes(false, true)).toBe(true);
    });

    it("devuelve true si tiene ambos permisos", () => {
      expect(canAddManualNotes(true, true)).toBe(true);
    });

    it("devuelve false si no tiene ningún permiso", () => {
      expect(canAddManualNotes(false, false)).toBe(false);
    });
  });

  describe("dateToInput e inputToDate", () => {
    it("devuelve cadena vacía cuando dateToInput recibe undefined", () => {
      expect(dateToInput(undefined)).toBe("");
    });

    it("formatea correctamente una fecha a AAAA-MM-DD", () => {
      // 2026-10-22 en tiempo local
      const d = new Date(2026, 9, 22, 12, 0, 0);
      const res = dateToInput(d.getTime());
      expect(res).toBe("2026-10-22");
    });

    it("convierte cadena AAAA-MM-DD a timestamp de medianoche", () => {
      const ts = inputToDate("2026-10-22");
      expect(ts).toBeDefined();
      const d = new Date(ts!);
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(9);
      expect(d.getDate()).toBe(22);
    });

    it("devuelve undefined cuando inputToDate recibe cadena vacía", () => {
      expect(inputToDate("")).toBeUndefined();
    });
  });
});
