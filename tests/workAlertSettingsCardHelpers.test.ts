import { describe, expect, it } from "vitest";
import {
  MAX_WORK_WITHOUT_TRACE_DAYS,
  MIN_WORK_WITHOUT_TRACE_DAYS,
} from "../src/lib/workshop";
import {
  filterKnownAudience,
  formatAudienceSummary,
  formatDaysHelpText,
  toggleRoleKey,
  validateDays,
} from "../src/pages/dashboard/settings/workAlertSettings/helpers";
import type { RoleOption } from "../src/pages/dashboard/settings/workAlertSettings/types";

describe("workAlertSettingsCardHelpers", () => {
  const dummyRoleOptions: RoleOption[] = [
    { key: "admin", label: "Administrador", description: "Control total" },
    { key: "coordinator", label: "Coordinador", description: "Gestión de taller" },
    { key: "mechanic", label: "Técnico", description: "Operaciones" },
  ];

  describe("validateDays", () => {
    it("valida correctamente enteros dentro del rango permitido", () => {
      const minRes = validateDays(String(MIN_WORK_WITHOUT_TRACE_DAYS));
      expect(minRes.isValid).toBe(true);
      expect(minRes.value).toBe(MIN_WORK_WITHOUT_TRACE_DAYS);

      const maxRes = validateDays(String(MAX_WORK_WITHOUT_TRACE_DAYS));
      expect(maxRes.isValid).toBe(true);
      expect(maxRes.value).toBe(MAX_WORK_WITHOUT_TRACE_DAYS);
    });

    it("invalida números por debajo del mínimo", () => {
      const res = validateDays(String(MIN_WORK_WITHOUT_TRACE_DAYS - 1));
      expect(res.isValid).toBe(false);
    });

    it("invalida números por encima del máximo", () => {
      const res = validateDays(String(MAX_WORK_WITHOUT_TRACE_DAYS + 1));
      expect(res.isValid).toBe(false);
    });

    it("invalida decimales", () => {
      const res = validateDays("2.5");
      expect(res.isValid).toBe(false);
    });

    it("invalida cadenas vacías o texto no numérico", () => {
      expect(validateDays("").isValid).toBe(false);
      expect(validateDays("   ").isValid).toBe(false);
      expect(validateDays("abc").isValid).toBe(false);
    });
  });

  describe("formatDaysHelpText", () => {
    it("formatea singular '1 día' cuando value es 1", () => {
      const text = formatDaysHelpText(true, 1);
      expect(text).toContain("1 día");
      expect(text).not.toContain("1 días");
    });

    it("formatea plural cuando value es mayor que 1", () => {
      const text = formatDaysHelpText(true, 5);
      expect(text).toContain("5 días");
    });

    it("informa del rango permitido cuando isValid es false", () => {
      const text = formatDaysHelpText(false, 0);
      expect(text).toContain(String(MIN_WORK_WITHOUT_TRACE_DAYS));
      expect(text).toContain(String(MAX_WORK_WITHOUT_TRACE_DAYS));
    });
  });

  describe("filterKnownAudience", () => {
    it("filtra y descarta roles que ya no existen en el catálogo", () => {
      const knownKeys = ["admin", "coordinator"];
      const savedKeys = ["admin", "deleted_role", "coordinator"];
      expect(filterKnownAudience(savedKeys, knownKeys)).toEqual([
        "admin",
        "coordinator",
      ]);
    });
  });

  describe("toggleRoleKey", () => {
    it("añade una clave si no estaba presente", () => {
      const next = toggleRoleKey(["admin"], "coordinator", true);
      expect(next).toEqual(["admin", "coordinator"]);
    });

    it("no duplica la clave si ya estaba presente", () => {
      const next = toggleRoleKey(["admin", "coordinator"], "admin", true);
      expect(next).toEqual(["admin", "coordinator"]);
    });

    it("elimina una clave si checked es false", () => {
      const next = toggleRoleKey(["admin", "coordinator"], "admin", false);
      expect(next).toEqual(["coordinator"]);
    });
  });

  describe("formatAudienceSummary", () => {
    it("avisa cuando no hay ningún rol seleccionado", () => {
      expect(formatAudienceSummary([], dummyRoleOptions)).toBe(
        "Sin ningún rol marcado el aviso no se lo enseña a nadie.",
      );
    });

    it("formatea singular para un solo rol", () => {
      const text = formatAudienceSummary(["admin"], dummyRoleOptions);
      expect(text).toBe("Le llega a un rol: Administrador.");
    });

    it("formatea plural para varios roles", () => {
      const text = formatAudienceSummary(
        ["admin", "coordinator"],
        dummyRoleOptions,
      );
      expect(text).toBe("Le llega a 2 roles: Administrador, Coordinador.");
    });

    it("usa la propia clave si no encuentra etiqueta en roleOptions", () => {
      const text = formatAudienceSummary(["custom_role"], dummyRoleOptions);
      expect(text).toBe("Le llega a un rol: custom_role.");
    });
  });
});
