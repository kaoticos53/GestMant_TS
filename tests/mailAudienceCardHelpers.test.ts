import { describe, expect, it } from "vitest";
import {
  COLUMNAS,
  DESTINO_FIJO,
  LA_MATRIZ,
  filterKnownRoleKeys,
  formatIncidentRolesNotice,
  formatWeeklyRolesNotice,
  toggleRoleInList,
} from "@/pages/dashboard/settings/mailAudience/helpers";

describe("mailAudienceCard helpers", () => {
  describe("constantes", () => {
    it("COLUMNAS define exactamente 4 orígenes en el orden estipulado", () => {
      expect(COLUMNAS.length).toBe(4);
      expect(COLUMNAS.map((c) => c.origin)).toEqual([
        "incidencia",
        "equipo",
        "resumen",
        "prueba",
      ]);
    });

    it("LA_MATRIZ contiene la clase css esperada", () => {
      expect(LA_MATRIZ).toContain("md:grid-cols-");
    });

    it("DESTINO_FIJO explica incidencia y prueba", () => {
      expect(DESTINO_FIJO.incidencia).toContain("quien notificó");
      expect(DESTINO_FIJO.prueba).toContain("Servidor de correo");
    });
  });

  describe("filterKnownRoleKeys", () => {
    it("descarta roles que no están en la lista conocida", () => {
      const keys = ["admin", "deprecated_role", "mechanic"];
      const known = ["admin", "mechanic", "operator"];
      expect(filterKnownRoleKeys(keys, known)).toEqual(["admin", "mechanic"]);
    });

    it("maneja null devolviendo array vacío", () => {
      expect(filterKnownRoleKeys(null, ["admin"])).toEqual([]);
    });
  });

  describe("toggleRoleInList", () => {
    it("agrega un rol si checked es true y no está duplicado", () => {
      expect(toggleRoleInList(["admin"], "mechanic", true)).toEqual([
        "admin",
        "mechanic",
      ]);
      expect(toggleRoleInList(["admin"], "admin", true)).toEqual(["admin"]);
    });

    it("elimina un rol si checked es false", () => {
      expect(toggleRoleInList(["admin", "mechanic"], "mechanic", false)).toEqual([
        "admin",
      ]);
      expect(toggleRoleInList(["admin"], "mechanic", false)).toEqual(["admin"]);
    });

    it("maneja lista null iniciando con la clave si checked es true", () => {
      expect(toggleRoleInList(null, "admin", true)).toEqual(["admin"]);
      expect(toggleRoleInList(null, "admin", false)).toEqual([]);
    });
  });

  describe("formatIncidentRolesNotice", () => {
    const lookup = (key: string) => (key === "admin" ? "Administrador" : key);

    it("informa cuando ningún rol recibe avisos", () => {
      expect(formatIncidentRolesNotice([], lookup)).toContain(
        "Aviso interno de incidencia: nadie por correo",
      );
    });

    it("informa en singular para un solo rol", () => {
      expect(formatIncidentRolesNotice(["admin"], lookup)).toContain(
        "le llega a un rol (Administrador)",
      );
    });

    it("informa en plural para múltiples roles", () => {
      expect(formatIncidentRolesNotice(["admin", "tech"], lookup)).toContain(
        "le llega a 2 roles (Administrador, tech)",
      );
    });
  });

  describe("formatWeeklyRolesNotice", () => {
    const lookup = (key: string) => (key === "admin" ? "Administrador" : key);

    it("informa cuando ningún rol recibe resumen semanal", () => {
      expect(formatWeeklyRolesNotice([], lookup)).toContain(
        "Resumen semanal: sin roles, el resumen no se puede enviar a nadie",
      );
    });

    it("informa en singular para un solo rol", () => {
      expect(formatWeeklyRolesNotice(["admin"], lookup)).toContain(
        "le llega a un rol (Administrador)",
      );
    });

    it("informa en plural para múltiples roles", () => {
      expect(formatWeeklyRolesNotice(["admin", "tech"], lookup)).toContain(
        "le llega a 2 roles (Administrador, tech)",
      );
    });
  });
});
