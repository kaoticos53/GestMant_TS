import { describe, expect, it } from "vitest";
import {
  formatRunDetail,
  formatRunTimestamp,
  formatRunTrigger,
  formatStorageCleanupResultToast,
} from "../src/pages/dashboard/settings/storageCleanup/helpers";
import type {
  ManualCleanupSummary,
  StorageCleanupRun,
} from "../src/pages/dashboard/settings/storageCleanup/types";

describe("storageCleanupCardHelpers", () => {
  describe("formatStorageCleanupResultToast", () => {
    it("informa adecuadamente cuando no había nada que hacer", () => {
      const emptyResult: ManualCleanupSummary = {
        reportUploads: { files: 0, bytes: 0, tickets: 0, unreadable: 0 },
        orphanFiles: { files: 0, bytes: 0, unreadable: 0 },
        trash: { files: 0, bytes: 0 },
      };
      expect(formatStorageCleanupResultToast(emptyResult)).toBe(
        "La limpieza no tenía nada que hacer",
      );
    });

    it("formatea archivos retirados a la papelera", () => {
      const result: ManualCleanupSummary = {
        reportUploads: { files: 2, bytes: 1024, tickets: 1, unreadable: 0 },
        orphanFiles: { files: 1, bytes: 2048, unreadable: 0 },
        trash: { files: 0, bytes: 0 },
      };
      const toast = formatStorageCleanupResultToast(result);
      expect(toast).toContain("2 imágenes y 1 vale sin archivo y 1 archivo a la papelera");
    });

    it("formatea espacio liberado de la papelera", () => {
      const result: ManualCleanupSummary = {
        reportUploads: { files: 0, bytes: 0, tickets: 0, unreadable: 0 },
        orphanFiles: { files: 0, bytes: 0, unreadable: 0 },
        trash: { files: 3, bytes: 5 * 1024 * 1024 },
      };
      const toast = formatStorageCleanupResultToast(result);
      expect(toast).toContain("liberados");
      expect(toast).toContain("3 archivos");
    });

    it("formatea archivos no legibles de cada pasada", () => {
      const result: ManualCleanupSummary = {
        reportUploads: { files: 0, bytes: 0, tickets: 0, unreadable: 1 },
        orphanFiles: { files: 0, bytes: 0, unreadable: 2 },
        trash: { files: 0, bytes: 0 },
      };
      const toast = formatStorageCleanupResultToast(result);
      expect(toast).toContain("sin nada que guardar");
      expect(toast).toContain("sin retirar");
    });

    it("combina retirados, liberados y no legibles separados por punto medio", () => {
      const result: ManualCleanupSummary = {
        reportUploads: { files: 1, bytes: 500, tickets: 0, unreadable: 1 },
        orphanFiles: { files: 0, bytes: 0, unreadable: 0 },
        trash: { files: 1, bytes: 1000 },
      };
      const toast = formatStorageCleanupResultToast(result);
      expect(toast).toMatch(/^Limpieza hecha: .* · .* · .*/);
    });
  });

  describe("formatRunTimestamp", () => {
    it("indica que todavía no ha corrido si ranAt es null", () => {
      expect(formatRunTimestamp(null)).toBe("todavía no ha corrido");
    });

    it("formatea fecha relativa y absoluta si ranAt tiene valor", () => {
      const now = Date.now();
      const text = formatRunTimestamp(now);
      expect(text).toContain("·");
    });
  });

  describe("formatRunDetail", () => {
    it("devuelve 'Nunca ha retirado nada.' si ranAt es null", () => {
      const run: Pick<
        StorageCleanupRun,
        "pass" | "ranAt" | "files" | "bytes" | "tickets" | "unreadable"
      > = {
        pass: "reportUploads",
        ranAt: null,
        files: 0,
        bytes: 0,
        tickets: 0,
        unreadable: 0,
      };
      expect(formatRunDetail(run)).toBe("Nunca ha retirado nada.");
    });

    it("devuelve 'no retiró nada' si files es 0 y ranAt existe", () => {
      const run: Pick<
        StorageCleanupRun,
        "pass" | "ranAt" | "files" | "bytes" | "tickets" | "unreadable"
      > = {
        pass: "orphanFiles",
        ranAt: 1700000000000,
        files: 0,
        bytes: 0,
        tickets: 0,
        unreadable: 0,
      };
      expect(formatRunDetail(run)).toBe("no retiró nada");
    });

    it("muestra cuenta de archivos y tamaño formateado", () => {
      const run: Pick<
        StorageCleanupRun,
        "pass" | "ranAt" | "files" | "bytes" | "tickets" | "unreadable"
      > = {
        pass: "reportUploads",
        ranAt: 1700000000000,
        files: 2,
        bytes: 2048,
        tickets: 1,
        unreadable: 0,
      };
      const detail = formatRunDetail(run);
      expect(detail).toContain("2 imágenes");
      expect(detail).toContain("1 vale sin archivo");
    });

    it("desglosa no legibles para orphanFiles (sin retirar)", () => {
      const run: Pick<
        StorageCleanupRun,
        "pass" | "ranAt" | "files" | "bytes" | "tickets" | "unreadable"
      > = {
        pass: "orphanFiles",
        ranAt: 1700000000000,
        files: 0,
        bytes: 0,
        tickets: 0,
        unreadable: 1,
      };
      expect(formatRunDetail(run)).toContain("sin retirar");
    });

    it("desglosa no legibles para reportUploads (sin nada que guardar)", () => {
      const run: Pick<
        StorageCleanupRun,
        "pass" | "ranAt" | "files" | "bytes" | "tickets" | "unreadable"
      > = {
        pass: "reportUploads",
        ranAt: 1700000000000,
        files: 0,
        bytes: 0,
        tickets: 0,
        unreadable: 2,
      };
      expect(formatRunDetail(run)).toContain("sin nada que guardar");
    });
  });

  describe("formatRunTrigger", () => {
    it("devuelve null si ranAt es null", () => {
      expect(
        formatRunTrigger({
          ranAt: null,
          automatic: false,
          runBy: "Admin",
        }),
      ).toBeNull();
    });

    it("indica limpieza automática si automatic es true", () => {
      expect(
        formatRunTrigger({
          ranAt: 1700000000000,
          automatic: true,
          runBy: null,
        }),
      ).toBe("la lanzó la limpieza automática");
    });

    it("indica el usuario ejecutor si se lanzó a mano", () => {
      expect(
        formatRunTrigger({
          ranAt: 1700000000000,
          automatic: false,
          runBy: "Lucía Pérez",
        }),
      ).toBe("a mano, Lucía Pérez");
    });

    it("usa Coordinación por defecto si runBy es null", () => {
      expect(
        formatRunTrigger({
          ranAt: 1700000000000,
          automatic: false,
          runBy: null,
        }),
      ).toBe("a mano, Coordinación");
    });
  });
});
