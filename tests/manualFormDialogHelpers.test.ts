import { describe, expect, it } from "vitest";
import {
  getUniqueModels,
  suggestBrandForModel,
  validateManualFile,
  validateManualSubmission,
} from "../src/pages/dashboard/manuals/form/helpers";
import type { EquipmentDoc, EquipmentModelDoc } from "../src/pages/dashboard/manuals/form/types";

describe("manualFormDialog helpers", () => {
  describe("getUniqueModels", () => {
    it("deduplica y ordena modelos alfabéticamente en español", () => {
      const catalogModels = [
        { model: "HDC-3500", brand: "Sony" },
        { model: "hdc-4300", brand: "Sony" },
        { model: "  Alpha 7  ", brand: "Sony" },
      ] as EquipmentModelDoc[];

      const equipment = [
        { model: "HDC-3500", brand: "Sony" },
        { model: "BetaCam", brand: "Sony" },
        { model: "   ", brand: "Sony" },
      ] as EquipmentDoc[];

      const result = getUniqueModels(catalogModels, equipment);
      expect(result).toEqual(["Alpha 7", "BetaCam", "HDC-3500", "hdc-4300"]);
    });

    it("retorna arreglo vacío si no hay modelos", () => {
      expect(getUniqueModels([], [])).toEqual([]);
    });
  });

  describe("suggestBrandForModel", () => {
    it("encuentra la marca del modelo ignorando mayúsculas y espacios", () => {
      const catalogModels = [
        { model: "HDC-3500", brand: "Sony" },
        { model: "URSA Mini", brand: "Blackmagic" },
      ] as EquipmentModelDoc[];

      expect(suggestBrandForModel("hdc-3500", catalogModels)).toBe("Sony");
      expect(suggestBrandForModel("  ursa mini  ", catalogModels)).toBe("Blackmagic");
    });

    it("retorna undefined si el modelo no existe o está vacío", () => {
      const catalogModels = [{ model: "HDC-3500", brand: "Sony" }] as EquipmentModelDoc[];
      expect(suggestBrandForModel("", catalogModels)).toBeUndefined();
      expect(suggestBrandForModel("Desconocido", catalogModels)).toBeUndefined();
    });
  });

  describe("validateManualSubmission", () => {
    it("requiere título si no hay archivo ni edición", () => {
      const error = validateManualSubmission({
        title: "  ",
        isFile: false,
        isEdit: false,
        file: null,
        notes: "Contenido",
      });
      expect(error).toBe("Ponle un título al manual.");
    });

    it("permite título vacío en archivo si se sube archivo o es edición existente", () => {
      const file = new File(["%PDF-content"], "manual.pdf", { type: "application/pdf" });
      const error = validateManualSubmission({
        title: "",
        isFile: true,
        isEdit: false,
        file,
        notes: "",
      });
      expect(error).toBeNull();
    });

    it("requiere archivo en modo file al crear un nuevo manual", () => {
      const error = validateManualSubmission({
        title: "Manual Cámara",
        isFile: true,
        isEdit: false,
        file: null,
        notes: "",
      });
      expect(error).toBe("Elige el archivo del manual.");
    });

    it("no exige archivo nuevo al editar un manual de archivo existente", () => {
      const error = validateManualSubmission({
        title: "Manual Cámara",
        isFile: true,
        isEdit: true,
        file: null,
        notes: "",
      });
      expect(error).toBeNull();
    });

    it("requiere contenido de notas al crear o editar un manual tipo nota", () => {
      const error = validateManualSubmission({
        title: "Nota del taller",
        isFile: false,
        isEdit: false,
        file: null,
        notes: "   <p></p>  ",
      });
      expect(error).toBe("Escribe la nota del manual: es su contenido.");
    });

    it("acepta nota válida con texto real", () => {
      const error = validateManualSubmission({
        title: "Nota del taller",
        isFile: false,
        isEdit: false,
        file: null,
        notes: "<p>Instrucciones de calibración</p>",
      });
      expect(error).toBeNull();
    });
  });

  describe("validateManualFile", () => {
    it("retorna valid: false si no se proporciona archivo", async () => {
      const result = await validateManualFile(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it("rechaza archivos con extensiones no PDF", async () => {
      const file = new File(["datos"], "manual.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      const result = await validateManualFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("El manual se sube en");
    });

    it("rechaza archivos que no empiezan con cabecera %PDF-", async () => {
      const file = new File(["NOTAPDF"], "manual.pdf", { type: "application/pdf" });
      const result = await validateManualFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("%PDF-");
    });

    it("acepta un archivo PDF válido con cabecera correcta", async () => {
      const file = new File(["%PDF-1.4 sample content"], "manual.pdf", { type: "application/pdf" });
      const result = await validateManualFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});
