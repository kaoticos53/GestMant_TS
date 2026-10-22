import { describe, expect, it } from "vitest";
import {
  formatIncidentEquipmentTitle,
  formatRequestContext,
  formatTrashRetireDetails,
  getTrashDeleteDialogDescription,
} from "@/pages/dashboard/archive/components/trashSection/helpers";

describe("archiveTrashSectionHelpers", () => {
  describe("formatIncidentEquipmentTitle", () => {
    it("combina tipo de equipo y modelo si ambos están presentes", () => {
      expect(formatIncidentEquipmentTitle("Torno", "CNC-200")).toBe(
        "Torno CNC-200",
      );
    });

    it("muestra solo el tipo si no hay modelo", () => {
      expect(formatIncidentEquipmentTitle("Fresadora", null)).toBe("Fresadora");
      expect(formatIncidentEquipmentTitle("Fresadora", "")).toBe("Fresadora");
    });

    it("muestra solo el modelo si no hay tipo", () => {
      expect(formatIncidentEquipmentTitle(null, "ZX-500")).toBe("ZX-500");
    });

    it("devuelve fallback cuando no hay datos", () => {
      expect(formatIncidentEquipmentTitle(null, null)).toBe(
        "Incidencia sin equipo",
      );
      expect(formatIncidentEquipmentTitle("", "")).toBe(
        "Incidencia sin equipo",
      );
    });
  });

  describe("formatRequestContext", () => {
    it("concatena solicitante, equipo y máquina con separador", () => {
      expect(
        formatRequestContext("Ricardo", "Turno Mañana", "Prensa Hidráulica"),
      ).toBe("Ricardo · Turno Mañana · Prensa Hidráulica");
    });

    it("omite campos nulos o vacíos limpiamente", () => {
      expect(formatRequestContext("Marta", null, "Compresor B")).toBe(
        "Marta · Compresor B",
      );
      expect(formatRequestContext(null, "Mantenimiento", null)).toBe(
        "Mantenimiento",
      );
    });

    it("devuelve cadena vacía si no hay ningún valor", () => {
      expect(formatRequestContext(null, null, null)).toBe("");
    });
  });

  describe("formatTrashRetireDetails", () => {
    const timestamp = 1700000000000;

    it("formatea información mínima con solo timestamp", () => {
      const res = formatTrashRetireDetails(timestamp);
      expect(res).toContain("Retirada el");
      expect(res).not.toContain(" por ");
      expect(res).not.toContain("saldrá del archivo");
    });

    it("incluye el usuario que retiró el elemento si existe", () => {
      const res = formatTrashRetireDetails(timestamp, "Elena");
      expect(res).toContain("por Elena");
    });

    it("incluye el motivo de retirada si existe", () => {
      const res = formatTrashRetireDetails(
        timestamp,
        "Elena",
        "Aviso duplicado por error",
      );
      expect(res).toContain("por Elena · Aviso duplicado por error");
    });

    it("indica que saldrá del archivo si archived es true", () => {
      const res = formatTrashRetireDetails(
        timestamp,
        "Elena",
        "Aviso duplicado",
        true,
      );
      expect(res).toContain("· saldrá del archivo al recuperarla");
    });
  });

  describe("getTrashDeleteDialogDescription", () => {
    it("devuelve descripción específica para peticiones", () => {
      const desc = getTrashDeleteDialogDescription("request");
      expect(desc).toContain("la petición y los archivos que adjuntaba");
      expect(desc).toContain("Las compras que se pidieron por ella");
    });

    it("devuelve descripción específica para incidencias", () => {
      const desc = getTrashDeleteDialogDescription("incident");
      expect(desc).toContain("con ella su expediente: sus documentos, sus notas");
    });

    it("usa fallback de incidencia si se omite el tipo", () => {
      const desc = getTrashDeleteDialogDescription();
      expect(desc).toContain("con ella su expediente");
    });
  });
});
