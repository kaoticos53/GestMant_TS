import { describe, expect, it } from "vitest";
import {
  createUserColumns,
  formatActiveUsersDetail,
  getRoleLabel,
} from "@/pages/dashboard/users/helpers";
import type { Member, RoleOption } from "@/pages/dashboard/users/types";
import type { Id } from "@/convex/_generated/dataModel";

describe("users helpers", () => {
  const mockRoleOptions: RoleOption[] = [
    { key: "admin", label: "Administrador Taller" },
    { key: "tecnico", label: "Técnico de Mantenimiento" },
    { key: "custom_role", label: "Auditor Externo" },
  ];

  describe("getRoleLabel", () => {
    it("devuelve la etiqueta del rol encontrada en las opciones", () => {
      expect(getRoleLabel(mockRoleOptions, "custom_role")).toBe("Auditor Externo");
      expect(getRoleLabel(mockRoleOptions, "tecnico")).toBe(
        "Técnico de Mantenimiento",
      );
    });

    it("utiliza el fallback si la clave no está en las opciones", () => {
      // Si el rol es null o vacío
      const emptyLabel = getRoleLabel(mockRoleOptions, null);
      expect(typeof emptyLabel).toBe("string");

      // Si es un rol no presente en la lista pero conocido por fallbackRoleMeta
      const fallbackGestor = getRoleLabel([], "gestor");
      expect(typeof fallbackGestor).toBe("string");
      expect(fallbackGestor.length).toBeGreaterThan(0);
    });
  });

  describe("createUserColumns", () => {
    const columns = createUserColumns(mockRoleOptions);

    const baseMember: Member = {
      _id: "user_123" as Id<"users">,
      name: "Juan Pérez",
      email: "juan@example.com",
      role: "tecnico",
      position: "Mecánico Senior",
      location: "Nave A",
      phone: "+34 600 000 000",
      active: true,
      isAnonymous: false,
    };

    it("extrae el valor de la columna member prefiriendo el nombre", () => {
      expect(columns.member.value(baseMember)).toBe("Juan Pérez");

      const withoutName: Member = { ...baseMember, name: null };
      expect(columns.member.value(withoutName)).toBe("juan@example.com");

      const emptyMember: Member = { ...baseMember, name: null, email: null };
      expect(columns.member.value(emptyMember)).toBe("");
    });

    it("extrae el valor de la columna position", () => {
      expect(columns.position.value(baseMember)).toBe("Mecánico Senior");

      const withoutPosition: Member = { ...baseMember, position: null };
      expect(columns.position.value(withoutPosition)).toBe("");
    });

    it("extrae el valor de la columna role con su etiqueta resuelta", () => {
      expect(columns.role.value(baseMember)).toBe("Técnico de Mantenimiento");
    });

    it("extrae el valor de la columna state distinguiendo activo y de baja", () => {
      expect(columns.state.value(baseMember)).toBe("Activo");

      const inactiveMember: Member = { ...baseMember, active: false };
      expect(columns.state.value(inactiveMember)).toBe("De baja");
    });
  });

  describe("formatActiveUsersDetail", () => {
    it("compone el texto con el contador de usuarios con acceso", () => {
      expect(formatActiveUsersDetail(5)).toBe(
        "5 con acceso · el administrador no puede cambiar su propio rol ni darse de baja",
      );
      expect(formatActiveUsersDetail(0)).toBe(
        "0 con acceso · el administrador no puede cambiar su propio rol ni darse de baja",
      );
    });
  });
});
