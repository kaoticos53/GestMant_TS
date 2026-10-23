import { describe, expect, it } from "vitest";
import { formatOutgoingMailDescription } from "@/pages/dashboard/settings/mail/helpers";

describe("mailServerCard helpers", () => {
  describe("formatOutgoingMailDescription", () => {
    it("devuelve el texto de servicio activo cuando enabled es true", () => {
      const text = formatOutgoingMailDescription(true);
      expect(text).toContain("Encendido: los avisos y el resumen salen");
    });

    it("devuelve el texto de servicio inactivo cuando enabled es false", () => {
      const text = formatOutgoingMailDescription(false);
      expect(text).toContain("Apagado: no se manda ningún correo del taller");
    });
  });
});
