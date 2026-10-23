import { describe, expect, it } from "vitest";
import {
  formatArchiveButtonLabel,
  formatConfirmDialogDescription,
  formatPendingDetail,
} from "../src/pages/dashboard/archive/components/bulkArchive/helpers";

describe("bulkArchiveCardHelpers", () => {
  describe("formatPendingDetail", () => {
    it("informa adecuadamente cuando no hay nada que archivar con el corte", () => {
      expect(
        formatPendingDetail({ incidents: 0, requests: 0 }, false),
      ).toBe("no hay nada que archivar con este corte");
    });

    it("formatea singular para una incidencia cerrada y una petición decidida", () => {
      const text = formatPendingDetail({ incidents: 1, requests: 1 }, true);
      expect(text).toBe(
        "1 incidencia cerrada y 1 petición decidida pendientes de archivar",
      );
    });

    it("formatea plural para múltiples incidencias y peticiones", () => {
      const text = formatPendingDetail({ incidents: 3, requests: 5 }, true);
      expect(text).toBe(
        "3 incidencias cerradas y 5 peticiones decididas pendientes de archivar",
      );
    });
  });

  describe("formatArchiveButtonLabel", () => {
    it("formatea etiqueta singular y plural para incidencias", () => {
      expect(formatArchiveButtonLabel("incidents", 1)).toBe(
        "Archivar 1 incidencia",
      );
      expect(formatArchiveButtonLabel("incidents", 4)).toBe(
        "Archivar 4 incidencias",
      );
    });

    it("formatea etiqueta singular y plural para peticiones de repuesto", () => {
      expect(formatArchiveButtonLabel("requests", 1)).toBe(
        "Archivar 1 petición",
      );
      expect(formatArchiveButtonLabel("requests", 7)).toBe(
        "Archivar 7 peticiones",
      );
    });
  });

  describe("formatConfirmDialogDescription", () => {
    const dummyCutoff = 1700000000000;

    it("formatea confirmación para incidencias en singular y plural", () => {
      const singleText = formatConfirmDialogDescription("incidents", 1, dummyCutoff);
      expect(singleText).toContain("1 incidencia cerrada");
      expect(singleText).toContain("No se borra nada");

      const pluralText = formatConfirmDialogDescription("incidents", 5, dummyCutoff);
      expect(pluralText).toContain("5 incidencias cerradas");
    });

    it("formatea confirmación para peticiones en singular y plural", () => {
      const singleText = formatConfirmDialogDescription("requests", 1, dummyCutoff);
      expect(singleText).toContain("1 petición decidida");
      expect(singleText).toContain("No se borra nada");

      const pluralText = formatConfirmDialogDescription("requests", 3, dummyCutoff);
      expect(pluralText).toContain("3 peticiones decididas");
    });
  });
});
