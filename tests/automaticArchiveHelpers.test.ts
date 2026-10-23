import { describe, expect, it } from "vitest";
import {
  formatArchiveFooter,
  formatRunNowResultToast,
  resolveAutoOptions,
} from "@/pages/dashboard/settings/automaticArchive/helpers";

describe("automaticArchive helpers", () => {
  describe("resolveAutoOptions", () => {
    it("retorna las opciones por defecto si el valor está incluido", () => {
      const options = resolveAutoOptions(6);
      expect(options.some((o) => o.months === 6)).toBe(true);
      expect(options.filter((o) => o.months === 6)).toHaveLength(1);
    });

    it("prepende la opción personalizada si el valor no está en las opciones habituales", () => {
      const options = resolveAutoOptions(9);
      expect(options[0].months).toBe(9);
      expect(options[0].label).toContain("9 meses");
    });
  });

  describe("formatRunNowResultToast", () => {
    it("devuelve mensaje informativo cuando no hay nada para archivar", () => {
      expect(
        formatRunNowResultToast({ total: 0, incidents: 0, requests: 0 }),
      ).toBe("No había nada terminado tan antiguo");
    });

    it("formatea en singular", () => {
      expect(
        formatRunNowResultToast({ total: 2, incidents: 1, requests: 1 }),
      ).toBe("1 incidencia y 1 petición al archivo");
    });

    it("formatea en plural", () => {
      expect(
        formatRunNowResultToast({ total: 7, incidents: 4, requests: 3 }),
      ).toBe("4 incidencias y 3 peticiones al archivo");
    });
  });

  describe("formatArchiveFooter", () => {
    const fixedCutoff = new Date("2025-01-15T00:00:00Z").getTime();
    const fixedRunAt = new Date("2025-01-20T10:30:00Z").getTime();

    it("muestra corte activo y mensaje de sin limpiezas previas", () => {
      const text = formatArchiveFooter(true, fixedCutoff);
      expect(text).toContain("Corte automático: anterior al");
      expect(text).toContain("sin limpiezas automáticas todavía");
    });

    it("muestra mensaje de automático apagado y última limpieza", () => {
      const text = formatArchiveFooter(false, fixedCutoff, fixedRunAt, 1);
      expect(text).toContain("El automático está apagado");
      expect(text).toContain("última limpieza automática");
      expect(text).toContain("1 ficha");
    });

    it("muestra plural en el conteo de fichas archivadas", () => {
      const text = formatArchiveFooter(true, fixedCutoff, fixedRunAt, 5);
      expect(text).toContain("5 fichas");
    });
  });
});
