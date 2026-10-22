import { describe, expect, test } from "vitest";
import {
  getBccHelpText,
  getSenderHelpText,
  getSmtpConnectionHelpText,
} from "@/pages/dashboard/settings/mail/components/providerFields/helpers";

describe("mailProviderFields/helpers", () => {
  describe("getSenderHelpText", () => {
    test("para vly explica que la pasarela firma con su propio remitente", () => {
      const text = getSenderHelpText("vly");
      expect(text).toContain("La pasarela firma con su propio remitente");
    });

    test("para proveedores propios exige dirección verificada", () => {
      expect(getSenderHelpText("resend")).toContain(
        "exigen que el remitente sea una dirección verificada",
      );
      expect(getSenderHelpText("gmail")).toContain(
        "exigen que el remitente sea una dirección verificada",
      );
      expect(getSenderHelpText("smtp")).toContain(
        "exigen que el remitente sea una dirección verificada",
      );
    });
  });

  describe("getBccHelpText", () => {
    test("cadena vacía o con espacios indica que no hay copia oculta", () => {
      expect(getBccHelpText("")).toBe(
        "Sin copia oculta: cada correo va solo a sus destinatarios.",
      );
      expect(getBccHelpText("   ")).toBe(
        "Sin copia oculta: cada correo va solo a sus destinatarios.",
      );
    });

    test("correo válido incluye la dirección en minúsculas", () => {
      const text = getBccHelpText("Copia@Taller.ES");
      expect(text).toContain("copia@taller.es");
      expect(text).toContain("Es una sola dirección.");
    });
  });

  describe("getSmtpConnectionHelpText", () => {
    test("null devuelve null", () => {
      expect(getSmtpConnectionHelpText(null)).toBeNull();
    });

    test("formatea TLS directo (ssl)", () => {
      const text = getSmtpConnectionHelpText({
        host: "smtp.empresa.es",
        port: 465,
        tls: "ssl",
      });
      expect(text).toBe(
        "Sale por smtp.empresa.es:465 con TLS directo, a través del relevo.",
      );
    });

    test("formatea STARTTLS", () => {
      const text = getSmtpConnectionHelpText({
        host: "smtp.empresa.es",
        port: 587,
        tls: "starttls",
      });
      expect(text).toBe(
        "Sale por smtp.empresa.es:587 cifrado con STARTTLS, a través del relevo.",
      );
    });

    test("formatea sin cifrar", () => {
      const text = getSmtpConnectionHelpText({
        host: "localhost",
        port: 25,
        tls: "none",
      });
      expect(text).toBe("Sale por localhost:25 sin cifrar, a través del relevo.");
    });
  });
});
