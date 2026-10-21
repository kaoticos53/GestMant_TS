import { describe, expect, it } from "vitest";
import { validateCreateUserData } from "@/pages/dashboard/users/hooks/useCreateUserForm";
import { validateEditUserData } from "@/pages/dashboard/users/hooks/useEditUserForm";
import type { Member } from "@/pages/dashboard/users/types";

describe("Users Module Validation & Types", () => {
  describe("validateCreateUserData", () => {
    it("acepta datos válidos de alta de usuario", () => {
      const result = validateCreateUserData({
        name: "Sandra Ruiz",
        email: "sandra@taller.es",
        password: "password123",
      });
      expect(result).toBeNull();
    });

    it("rechaza nombres vacíos o solo espacios", () => {
      expect(
        validateCreateUserData({
          name: "   ",
          email: "sandra@taller.es",
          password: "password123",
        }),
      ).toBe("Indica tu nombre y apellidos.");
    });

    it("rechaza formatos de correo inválidos", () => {
      const invalidEmails = ["sandra", "sandra@", "sandra@taller", "@taller.es", "sandra taller.es"];
      for (const email of invalidEmails) {
        expect(
          validateCreateUserData({
            name: "Sandra Ruiz",
            email,
            password: "password123",
          }),
        ).toBe("Indica un correo electrónico válido.");
      }
    });

    it("rechaza contraseñas con menos de 8 caracteres", () => {
      expect(
        validateCreateUserData({
          name: "Sandra Ruiz",
          email: "sandra@taller.es",
          password: "1234567",
        }),
      ).toBe("La contraseña debe tener al menos 8 caracteres.");
    });
  });

  describe("validateEditUserData", () => {
    it("acepta un nombre válido en edición", () => {
      expect(validateEditUserData({ name: "Carlos Soto" })).toBeNull();
    });

    it("rechaza un nombre vacío en edición", () => {
      expect(validateEditUserData({ name: "" })).toBe("Indica tu nombre y apellidos.");
      expect(validateEditUserData({ name: "   " })).toBe("Indica tu nombre y apellidos.");
    });
  });

  describe("Member type structure", () => {
    it("cumple con las propiedades esperadas de la proyección de miembro", () => {
      const sampleMember: Member = {
        _id: "u_1" as never,
        name: "Lucía Gil",
        email: "lucia@taller.es",
        role: "admin",
        position: "Jefa de Taller",
        location: "Central",
        phone: "600111222",
        active: true,
        isAnonymous: false,
      };

      expect(sampleMember.active).toBe(true);
      expect(sampleMember.isAnonymous).toBe(false);
      expect(sampleMember.role).toBe("admin");
    });
  });
});
