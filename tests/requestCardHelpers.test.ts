import { describe, expect, it } from "vitest";
import {
  getRequestActionFlags,
  getRequestUnitsCount,
  getRequestUnitsSummary,
} from "@/pages/dashboard/requests/components/card/helpers";

describe("requestCardHelpers", () => {
  describe("getRequestUnitsCount", () => {
    it("devuelve 0 si no hay líneas", () => {
      expect(getRequestUnitsCount([])).toBe(0);
    });

    it("suma las cantidades de todas las líneas", () => {
      const lines = [{ quantity: 2 }, { quantity: 5 }, { quantity: 1 }];
      expect(getRequestUnitsCount(lines)).toBe(8);
    });
  });

  describe("getRequestUnitsSummary", () => {
    it("devuelve texto de sin repuestos cuando está vacío", () => {
      expect(getRequestUnitsSummary([])).toBe("Sin repuestos asociados");
    });

    it("devuelve el conteo de líneas y unidades", () => {
      const lines = [{ quantity: 3 }, { quantity: 2 }];
      expect(getRequestUnitsSummary(lines)).toBe("2 líneas · 5 unidades");
    });
  });

  describe("getRequestActionFlags", () => {
    it("desactiva todas las acciones si canManage es false", () => {
      const flags = getRequestActionFlags("pending", true, false);
      expect(flags).toEqual({
        canReject: false,
        canApprove: false,
        canAssociate: false,
        canIssue: false,
        canArchive: false,
      });
    });

    it("en estado pending con líneas: permite rechazar y aprobar, pero no asociar ni archivar", () => {
      const flags = getRequestActionFlags("pending", true, true);
      expect(flags.canReject).toBe(true);
      expect(flags.canApprove).toBe(true);
      expect(flags.canAssociate).toBe(false);
      expect(flags.canIssue).toBe(false);
      expect(flags.canArchive).toBe(false);
    });

    it("en estado pending sin líneas: ofrece asociar repuesto en vez de aprobar", () => {
      const flags = getRequestActionFlags("pending", false, true);
      expect(flags.canReject).toBe(true);
      expect(flags.canApprove).toBe(false);
      expect(flags.canAssociate).toBe(true);
      expect(flags.canIssue).toBe(false);
      expect(flags.canArchive).toBe(false);
    });

    it("en estado approved: permite entregar material", () => {
      const flags = getRequestActionFlags("approved", true, true);
      expect(flags.canIssue).toBe(true);
      expect(flags.canApprove).toBe(false);
      expect(flags.canReject).toBe(false);
    });

    it("en estado issued o rejected: permite archivar y no avanzar", () => {
      const issuedFlags = getRequestActionFlags("issued", true, true);
      expect(issuedFlags.canArchive).toBe(true);
      expect(issuedFlags.canIssue).toBe(false);
      expect(issuedFlags.canApprove).toBe(false);

      const rejectedFlags = getRequestActionFlags("rejected", true, true);
      expect(rejectedFlags.canArchive).toBe(true);
    });
  });
});
