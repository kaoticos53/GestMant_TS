import { describe, expect, test } from "vitest";
import {
  fromDateInputValue,
  getTodayInputDate,
  toDateInputValue,
  validateReportIncidentForm,
} from "@/pages/reportIncident/helpers";
import type { ReportIncidentFormValues } from "@/pages/reportIncident/types";

describe("reportIncident/helpers", () => {
  describe("conversión de fechas", () => {
    test("toDateInputValue convierte un timestamp a formato YYYY-MM-DD", () => {
      // 2026-05-15 medianoche local
      const d = new Date(2026, 4, 15);
      const str = toDateInputValue(d.getTime());
      expect(str).toBe("2026-05-15");
    });

    test("fromDateInputValue convierte YYYY-MM-DD a timestamp de medianoche local", () => {
      const ts = fromDateInputValue("2026-05-15");
      expect(ts).toBeDefined();
      const reconstructed = toDateInputValue(ts!);
      expect(reconstructed).toBe("2026-05-15");
    });

    test("fromDateInputValue devuelve undefined si el valor es vacío", () => {
      expect(fromDateInputValue("")).toBeUndefined();
    });

    test("getTodayInputDate devuelve una fecha en formato YYYY-MM-DD", () => {
      const today = getTodayInputDate();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("validateReportIncidentForm", () => {
    const validBaseValues: ReportIncidentFormValues = {
      name: "Sandra Ruiz",
      email: "sandra.ruiz@taller.es",
      role: "Realización",
      location: "Plató 2",
      reportedAt: "2026-10-22",
      equipmentKind: "Cámara de estudio",
      model: "HDC-3500",
      serialNumber: "HDC3500-2505-0147",
      description: "El visor de la cámara parpadea intermitentemente al encender.",
    };

    test("formulario válido genera payload completo y normalizado", () => {
      const result = validateReportIncidentForm(validBaseValues);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
      expect(result.payload).toBeDefined();
      expect(result.payload?.reporterName).toBe("Sandra Ruiz");
      expect(result.payload?.reporterEmail).toBe("sandra.ruiz@taller.es");
      expect(result.payload?.reporterRole).toBe("Realización");
      expect(result.payload?.location).toBe("Plató 2");
      expect(result.payload?.equipmentKind).toBe("Cámara de estudio");
      expect(result.payload?.model).toBe("HDC-3500");
      expect(result.payload?.serialNumber).toBe("HDC3500-2505-0147");
      expect(result.payload?.description).toBe(
        "El visor de la cámara parpadea intermitentemente al encender.",
      );
      expect(result.payload?.reportedAt).toBe(
        fromDateInputValue("2026-10-22"),
      );
    });

    test("el correo es opcional: si está vacío se mapea a undefined en payload", () => {
      const values: ReportIncidentFormValues = {
        ...validBaseValues,
        email: "   ",
        role: "  ",
        location: "",
        equipmentKind: "",
        model: "",
        serialNumber: "",
      };
      const result = validateReportIncidentForm(values);
      expect(result.isValid).toBe(true);
      expect(result.payload?.reporterEmail).toBeUndefined();
      expect(result.payload?.reporterRole).toBeUndefined();
      expect(result.payload?.location).toBeUndefined();
      expect(result.payload?.equipmentKind).toBeUndefined();
      expect(result.payload?.model).toBeUndefined();
      expect(result.payload?.serialNumber).toBeUndefined();
    });

    test("falla si el nombre está vacío", () => {
      const values: ReportIncidentFormValues = {
        ...validBaseValues,
        name: "   ",
      };
      const result = validateReportIncidentForm(values);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Indica tu nombre y apellidos.");
      expect(result.payload).toBeUndefined();
    });

    test("falla si el correo tiene formato inválido", () => {
      const values: ReportIncidentFormValues = {
        ...validBaseValues,
        email: "correo-invalido-sin-arroba",
      };
      const result = validateReportIncidentForm(values);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Ese correo no parece una dirección válida");
      expect(result.payload).toBeUndefined();
    });

    test("falla si la descripción tiene menos de 10 caracteres de texto plano", () => {
      const values: ReportIncidentFormValues = {
        ...validBaseValues,
        description: "<p>Fallo</p>", // solo 5 caracteres de texto plano
      };
      const result = validateReportIncidentForm(values);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Describe la incidencia con un poco más de detalle.");
    });

    test("falla si la fecha de notificación es vacía o inválida", () => {
      const values: ReportIncidentFormValues = {
        ...validBaseValues,
        reportedAt: "",
      };
      const result = validateReportIncidentForm(values);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Indica la fecha de notificación.");
    });
  });
});
