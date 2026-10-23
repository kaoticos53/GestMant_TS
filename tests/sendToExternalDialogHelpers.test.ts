import { describe, expect, it } from "vitest";
import {
  buildSendToExternalArgs,
  validateSendToExternalForm,
} from "@/pages/dashboard/incidents/dialogs/sendToExternal/helpers";
import type { Id } from "@/convex/_generated/dataModel";

describe("sendToExternalDialog helpers", () => {
  describe("validateSendToExternalForm", () => {
    it("exige el nombre de la empresa externa", () => {
      expect(
        validateSendToExternalForm({ companyName: "", defectNotes: "Fallo motor" }),
      ).toBe("Indica el nombre de la empresa externa o SAT.");

      expect(
        validateSendToExternalForm({ companyName: "   ", defectNotes: "Fallo motor" }),
      ).toBe("Indica el nombre de la empresa externa o SAT.");
    });

    it("exige la descripción del defecto o avería", () => {
      expect(
        validateSendToExternalForm({ companyName: "SAT Central", defectNotes: "" }),
      ).toBe("Describe la avería o el motivo del envío.");

      expect(
        validateSendToExternalForm({ companyName: "SAT Central", defectNotes: "   " }),
      ).toBe("Describe la avería o el motivo del envío.");
    });

    it("retorna null si ambos campos obligatorios tienen contenido", () => {
      expect(
        validateSendToExternalForm({
          companyName: "Reparaciones Norte",
          defectNotes: "No enciende tras corte eléctrico",
        }),
      ).toBeNull();
    });
  });

  describe("buildSendToExternalArgs", () => {
    const dummyId = "incident_123" as Id<"incidents">;

    it("limpia espacios en blanco y omite campos opcionales vacíos", () => {
      const args = buildSendToExternalArgs(dummyId, {
        companyName: "  SAT Oficial  ",
        contactName: "  ",
        contactPhone: "",
        includedAccessories: "  Cable de alimentación  ",
        defectNotes: "  Placa quemada  ",
        dispatchNotes: "   ",
      });

      expect(args).toEqual({
        incidentId: dummyId,
        companyName: "SAT Oficial",
        contactName: undefined,
        contactPhone: undefined,
        includedAccessories: "Cable de alimentación",
        defectNotes: "Placa quemada",
        dispatchNotes: undefined,
      });
    });

    it("incluye campos opcionales cuando tienen contenido", () => {
      const args = buildSendToExternalArgs(dummyId, {
        companyName: "Taller Hermanos García",
        contactName: "Carlos",
        contactPhone: "600123456",
        includedAccessories: "Manual y llave",
        defectNotes: "Holgura en eje",
        dispatchNotes: "Urgente antes del viernes",
      });

      expect(args).toEqual({
        incidentId: dummyId,
        companyName: "Taller Hermanos García",
        contactName: "Carlos",
        contactPhone: "600123456",
        includedAccessories: "Manual y llave",
        defectNotes: "Holgura en eje",
        dispatchNotes: "Urgente antes del viernes",
      });
    });
  });
});
