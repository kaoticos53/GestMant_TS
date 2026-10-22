import { describe, expect, test } from "vitest";
import {
  buildPurgeSuccessMessage,
  buildUnusedSummary,
} from "@/pages/dashboard/settings/unusedUploads/helpers";
import type {
  PurgeResult,
  UnusedPendingData,
} from "@/pages/dashboard/settings/unusedUploads/types";

describe("unusedUploads/helpers", () => {
  describe("buildUnusedSummary", () => {
    test("devuelve cadena vacía si no hay datos de pendientes", () => {
      expect(buildUnusedSummary(null)).toBe("");
      expect(buildUnusedSummary(undefined)).toBe("");
    });

    test("formatea singular y plural correctamente para imágenes", () => {
      const single: UnusedPendingData = {
        images: [{ id: "1", url: "http://test", size: 1024, uploadedAt: 1000 }],
        tickets: 0,
        unreadable: 0,
        totalBytes: 1024,
      };
      expect(buildUnusedSummary(single)).toContain("1 imagen (1 KB)");

      const multiple: UnusedPendingData = {
        images: [
          { id: "1", url: "http://test1", size: 1024, uploadedAt: 1000 },
          { id: "2", url: "http://test2", size: 2048, uploadedAt: 2000 },
        ],
        tickets: 0,
        unreadable: 0,
        totalBytes: 3072,
      };
      expect(buildUnusedSummary(multiple)).toContain("2 imágenes (3 KB)");
    });

    test("incluye vales sin archivo e ilegibles si existen", () => {
      const data: UnusedPendingData = {
        images: [{ id: "1", url: "http://test", size: 2048, uploadedAt: 1000 }],
        tickets: 2,
        unreadable: 1,
        totalBytes: 2048,
        partial: true,
      };
      const summary = buildUnusedSummary(data);
      expect(summary).toContain("1 imagen (2 KB)");
      expect(summary).toContain("2 vales sin archivo");
      expect(summary).toContain("la limpieza va por tandas");
    });
  });

  describe("buildPurgeSuccessMessage", () => {
    test("devuelve mensaje informativo si no se purgó nada", () => {
      const result: PurgeResult = {
        images: 0,
        tickets: 0,
        bytes: 0,
        unreadable: 0,
      };
      expect(buildPurgeSuccessMessage(result)).toBe("No había nada que purgar");
    });

    test("construye mensaje con imágenes enviadas a papelera", () => {
      const result: PurgeResult = {
        images: 2,
        tickets: 0,
        bytes: 2048,
        unreadable: 0,
      };
      const message = buildPurgeSuccessMessage(result);
      expect(message).toContain("A la papelera:");
      expect(message).toContain("(2 KB)");
    });

    test("construye mensaje con vales ilegibles que no dejan rastro", () => {
      const result: PurgeResult = {
        images: 1,
        tickets: 1,
        bytes: 1024,
        unreadable: 2,
      };
      const message = buildPurgeSuccessMessage(result);
      expect(message).toContain("A la papelera:");
      expect(message).toContain("que no dejan nada");
    });
  });
});
