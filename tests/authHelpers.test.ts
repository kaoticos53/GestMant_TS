import { describe, expect, it } from "vitest";
import { resolveRedirectAfterAuth } from "../src/pages/auth/helpers";

describe("auth helpers", () => {
  describe("resolveRedirectAfterAuth", () => {
    it("permite rutas relativas seguras dentro de la aplicación", () => {
      expect(resolveRedirectAfterAuth("/dashboard")).toBe("/dashboard");
      expect(resolveRedirectAfterAuth("/perfil")).toBe("/perfil");
      expect(resolveRedirectAfterAuth("/peticiones?id=123")).toBe("/peticiones?id=123");
      expect(resolveRedirectAfterAuth("/ajustes/correo")).toBe("/ajustes/correo");
    });

    it("previene Open Redirect bloqueando URLs de protocolo relativo que empiezan con //", () => {
      expect(resolveRedirectAfterAuth("//malicious-site.com")).toBe("/dashboard");
      expect(resolveRedirectAfterAuth("//phishing.org/login", "/fallback")).toBe("/fallback");
    });

    it("previene URLs absolutas externas y esquemas no permitidos", () => {
      expect(resolveRedirectAfterAuth("https://external.com")).toBe("/dashboard");
      expect(resolveRedirectAfterAuth("http://external.com")).toBe("/dashboard");
      expect(resolveRedirectAfterAuth("javascript:alert(1)")).toBe("/dashboard");
    });

    it("utiliza el fallback predeterminado cuando returnTo es nulo o vacío", () => {
      expect(resolveRedirectAfterAuth(null)).toBe("/dashboard");
      expect(resolveRedirectAfterAuth("")).toBe("/dashboard");
    });

    it("utiliza el fallback personalizado provisto", () => {
      expect(resolveRedirectAfterAuth(null, "/custom-home")).toBe("/custom-home");
      expect(resolveRedirectAfterAuth("", "/custom-home")).toBe("/custom-home");
    });
  });
});
