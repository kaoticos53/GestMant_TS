import { describe, expect, it } from "vitest";
import {
  formatDocumentTitle,
  getDisplayName,
  getDisplayNameInitial,
  isAccountDeactivated,
} from "@/pages/dashboard/helpers/dashboardHelpers";

describe("dashboardHelpers", () => {
  describe("getDisplayName", () => {
    it("devuelve el nombre del usuario si existe", () => {
      expect(getDisplayName({ name: "Lucía Méndez", email: "lucia@taller.es" })).toBe(
        "Lucía Méndez",
      );
    });

    it("devuelve el correo si no hay nombre", () => {
      expect(getDisplayName({ name: null, email: "mecanico@taller.es" })).toBe(
        "mecanico@taller.es",
      );
      expect(getDisplayName({ name: "", email: "mecanico@taller.es" })).toBe(
        "mecanico@taller.es",
      );
    });

    it("devuelve 'Invitado' si es usuario anónimo", () => {
      expect(getDisplayName({ isAnonymous: true })).toBe("Invitado");
    });

    it("devuelve 'Responsable de repuestos' como fallback para usuarios del taller sin datos", () => {
      expect(getDisplayName(null)).toBe("Responsable de repuestos");
      expect(getDisplayName(undefined)).toBe("Responsable de repuestos");
      expect(getDisplayName({})).toBe("Responsable de repuestos");
    });
  });

  describe("getDisplayNameInitial", () => {
    it("devuelve la primera letra en mayúscula", () => {
      expect(getDisplayNameInitial("carlos")).toBe("C");
      expect(getDisplayNameInitial("  ana  ")).toBe("A");
    });

    it("usa 'R' como fallback para cadenas vacías", () => {
      expect(getDisplayNameInitial("")).toBe("R");
      expect(getDisplayNameInitial("   ")).toBe("R");
    });
  });

  describe("isAccountDeactivated", () => {
    it("devuelve true únicamente si active es explícitamente false", () => {
      expect(isAccountDeactivated({ active: false })).toBe(true);
    });

    it("devuelve false si active es true, undefined o el usuario no existe", () => {
      expect(isAccountDeactivated({ active: true })).toBe(false);
      expect(isAccountDeactivated({})).toBe(false);
      expect(isAccountDeactivated(null)).toBe(false);
      expect(isAccountDeactivated(undefined)).toBe(false);
    });
  });

  describe("formatDocumentTitle", () => {
    it("formatea el título con el sufijo oficial '· Pulso Taller'", () => {
      expect(formatDocumentTitle("Incidencias")).toBe(
        "Incidencias · Pulso Taller",
      );
      expect(formatDocumentTitle("Peticiones de material")).toBe(
        "Peticiones de material · Pulso Taller",
      );
    });
  });
});
