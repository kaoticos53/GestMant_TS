import { describe, expect, it } from "vitest";
import {
  getMaintenanceDialogTitle,
  getMaintenanceSubmitLabel,
  validateMaintenanceForm,
} from "../src/pages/dashboard/equipment/dialogs/maintenance/helpers";

describe("maintenanceDialog helpers", () => {
  describe("validateMaintenanceForm", () => {
    it("falla si el título está vacío o solo contiene espacios", () => {
      const resEmpty = validateMaintenanceForm("", "2026-10-22");
      expect(resEmpty.isValid).toBe(false);
      expect(resEmpty.error).toBe(
        "El resumen de la intervención es obligatorio.",
      );

      const resSpaces = validateMaintenanceForm("   ", "2026-10-22");
      expect(resSpaces.isValid).toBe(false);
      expect(resSpaces.error).toBe(
        "El resumen de la intervención es obligatorio.",
      );
    });

    it("falla si la fecha es inválida o no se indica", () => {
      const resNoDate = validateMaintenanceForm("Reparación de óptica", "");
      expect(resNoDate.isValid).toBe(false);
      expect(resNoDate.error).toBe("Indica la fecha de la intervención.");

      const resBadDate = validateMaintenanceForm(
        "Reparación de óptica",
        "fecha-invalida",
      );
      expect(resBadDate.isValid).toBe(false);
      expect(resBadDate.error).toBe("Indica la fecha de la intervención.");
    });

    it("valida correctamente con título y fecha válidos", () => {
      const res = validateMaintenanceForm(
        "Sustitución de batería",
        "2026-10-22",
      );
      expect(res.isValid).toBe(true);
      expect(res.error).toBeUndefined();
      expect(typeof res.performedAt).toBe("number");
    });
  });

  describe("getMaintenanceDialogTitle", () => {
    it("devuelve 'Editar intervención' para modo edición", () => {
      expect(getMaintenanceDialogTitle(true)).toBe("Editar intervención");
    });

    it("devuelve 'Registrar intervención' para modo creación", () => {
      expect(getMaintenanceDialogTitle(false)).toBe("Registrar intervención");
    });
  });

  describe("getMaintenanceSubmitLabel", () => {
    it("muestra 'Guardando...' cuando busy es true", () => {
      expect(getMaintenanceSubmitLabel(true, true)).toBe("Guardando...");
      expect(getMaintenanceSubmitLabel(true, false)).toBe("Guardando...");
    });

    it("muestra 'Guardar cambios' para edición no ocupada", () => {
      expect(getMaintenanceSubmitLabel(false, true)).toBe("Guardar cambios");
    });

    it("muestra 'Registrar' para creación no ocupada", () => {
      expect(getMaintenanceSubmitLabel(false, false)).toBe("Registrar");
    });
  });
});
