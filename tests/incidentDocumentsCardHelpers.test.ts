import { describe, expect, test } from "vitest";
import {
  getDocumentDialogDescription,
  getDocumentDialogTitle,
  getDocumentFileHelperText,
  getDocumentSubmitLabel,
} from "@/pages/dashboard/incidents/components/detail/documents/helpers";

describe("incidentDocumentsCard/helpers", () => {
  describe("getDocumentDialogTitle", () => {
    test("devuelve Corregir documento si está editando", () => {
      expect(getDocumentDialogTitle(true)).toBe("Corregir documento");
    });

    test("devuelve Adjuntar documento si es nuevo", () => {
      expect(getDocumentDialogTitle(false)).toBe("Adjuntar documento");
    });
  });

  describe("getDocumentDialogDescription", () => {
    test("incluye la referencia y 설명 de corrección al editar", () => {
      const desc = getDocumentDialogDescription(true, "INC-2026-001");
      expect(desc).toContain("INC-2026-001");
      expect(desc).toContain("Corriges los datos del documento");
    });

    test("incluye la referencia y explicación de adición al crear", () => {
      const desc = getDocumentDialogDescription(false, "INC-2026-001");
      expect(desc).toContain("INC-2026-001");
      expect(desc).toContain("Añade un documento al expediente");
    });
  });

  describe("getDocumentFileHelperText", () => {
    test("avisa del reemplazo y borrado de archivo previo al editar", () => {
      const text = getDocumentFileHelperText(true);
      expect(text).toContain("el archivo anterior se borra del servidor");
    });

    test("explica el guardado con el expediente al adjuntar", () => {
      const text = getDocumentFileHelperText(false);
      expect(text).toContain("el archivo se sube y queda guardado");
    });
  });

  describe("getDocumentSubmitLabel", () => {
    test("muestra Subiendo... si está guardando y hay archivo", () => {
      expect(getDocumentSubmitLabel(true, true, false)).toBe("Subiendo...");
      expect(getDocumentSubmitLabel(true, true, true)).toBe("Subiendo...");
    });

    test("muestra Guardando... si está guardando sin archivo nuevo", () => {
      expect(getDocumentSubmitLabel(true, false, false)).toBe("Guardando...");
      expect(getDocumentSubmitLabel(true, false, true)).toBe("Guardando...");
    });

    test("muestra Guardar cambios si no está guardando y está editando", () => {
      expect(getDocumentSubmitLabel(false, false, true)).toBe("Guardar cambios");
    });

    test("muestra Adjuntar si no está guardando y es nuevo", () => {
      expect(getDocumentSubmitLabel(false, false, false)).toBe("Adjuntar");
    });
  });
});
