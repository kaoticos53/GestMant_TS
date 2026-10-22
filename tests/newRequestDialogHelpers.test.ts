import { describe, expect, it } from "vitest";
import {
  getSubmitButtonLabel,
  isSubmitDisabled,
  shouldShowSubmitIcon,
} from "../src/pages/dashboard/requests/dialogs/newRequest/helpers";

describe("newRequestDialog helpers", () => {
  describe("getSubmitButtonLabel", () => {
    it("muestra 'Enviando...' si busy es true", () => {
      expect(getSubmitButtonLabel(true, false)).toBe("Enviando...");
      expect(getSubmitButtonLabel(true, true)).toBe("Enviando...");
    });

    it("muestra 'Subiendo archivos...' si isUploading es true y no está busy", () => {
      expect(getSubmitButtonLabel(false, true)).toBe("Subiendo archivos...");
    });

    it("muestra 'Crear petición' si no está ocupado ni subiendo", () => {
      expect(getSubmitButtonLabel(false, false)).toBe("Crear petición");
    });
  });

  describe("isSubmitDisabled", () => {
    it("está deshabilitado si busy o isUploading son verdaderos", () => {
      expect(isSubmitDisabled(true, false)).toBe(true);
      expect(isSubmitDisabled(false, true)).toBe(true);
      expect(isSubmitDisabled(true, true)).toBe(true);
    });

    it("está habilitado si busy e isUploading son falsos", () => {
      expect(isSubmitDisabled(false, false)).toBe(false);
    });
  });

  describe("shouldShowSubmitIcon", () => {
    it("muestra icono solo cuando no está ocupado ni subiendo", () => {
      expect(shouldShowSubmitIcon(false, false)).toBe(true);
      expect(shouldShowSubmitIcon(true, false)).toBe(false);
      expect(shouldShowSubmitIcon(false, true)).toBe(false);
      expect(shouldShowSubmitIcon(true, true)).toBe(false);
    });
  });
});
