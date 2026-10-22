import { describe, expect, it } from "vitest";
import {
  getAriaSort,
  getFlipButtonMeta,
  getSortButtonAriaLabel,
  getSortButtonTitle,
  getSortNextDescription,
} from "@/components/tableSort/helpers";

describe("tableSort UI helpers", () => {
  describe("getSortNextDescription", () => {
    it("describe el paso a ascendente si actualmente no hay orden", () => {
      expect(getSortNextDescription(null)).toBe("de menor a mayor");
    });

    it("describe el paso a descendente si actualmente está ascendente", () => {
      expect(getSortNextDescription("asc")).toBe("de mayor a menor");
    });

    it("describe la vuelta al orden original si actualmente está descendente", () => {
      expect(getSortNextDescription("desc")).toBe("volver al orden original");
    });
  });

  describe("getSortButtonTitle y getSortButtonAriaLabel", () => {
    it("construye el title en minúsculas con el siguiente sentido", () => {
      expect(getSortButtonTitle("Fecha", null)).toBe(
        "Ordenar por fecha: de menor a mayor",
      );
      expect(getSortButtonTitle("Estado", "asc")).toBe(
        "Ordenar por estado: de mayor a menor",
      );
      expect(getSortButtonTitle("Total", "desc")).toBe(
        "Ordenar por total: volver al orden original",
      );
    });

    it("construye el aria-label preservando la mayúscula de la etiqueta", () => {
      expect(getSortButtonAriaLabel("Código", null)).toBe(
        "Ordenar por Código: de menor a mayor",
      );
      expect(getSortButtonAriaLabel("Código", "asc")).toBe(
        "Ordenar por Código: de mayor a menor",
      );
    });
  });

  describe("getAriaSort", () => {
    it("mapea los valores a la especificación aria-sort", () => {
      expect(getAriaSort("asc")).toBe("ascending");
      expect(getAriaSort("desc")).toBe("descending");
      expect(getAriaSort(null)).toBe("none");
    });
  });

  describe("getFlipButtonMeta", () => {
    it("devuelve advertencia cuando no hay columna elegida", () => {
      const meta = getFlipButtonMeta(null);
      expect(meta.ariaLabel).toBe("Invertir el sentido del orden");
      expect(meta.title).toBe(
        "Elige primero una columna para poder invertir el sentido",
      );
    });

    it("devuelve el siguiente sentido cuando hay orden ascendente", () => {
      const meta = getFlipButtonMeta({ column: "date", direction: "asc" });
      expect(meta.ariaLabel).toBe("Ordenar de mayor a menor");
      expect(meta.title).toBe("Invertir el sentido del orden");
    });

    it("devuelve el siguiente sentido cuando hay orden descendente", () => {
      const meta = getFlipButtonMeta({ column: "date", direction: "desc" });
      expect(meta.ariaLabel).toBe("Ordenar de menor a mayor");
      expect(meta.title).toBe("Invertir el sentido del orden");
    });
  });
});
