import { describe, expect, it } from "vitest";
import {
  PREVIEW_LIMIT,
  buildReferencePreview,
  buildReportsCountLabel,
  getLinkedEquipmentName,
  groupRequestsByIncident,
  groupTrailsByIncident,
} from "@/pages/dashboard/incidentReports/helpers";
import type { EquipmentDoc } from "@/pages/dashboard/incidentReports/types";

describe("incidentReports helpers", () => {
  describe("buildReferencePreview", () => {
    it("devuelve string vacío si la lista de referencias está vacía", () => {
      expect(buildReferencePreview([])).toBe("");
    });

    it("muestra todas las referencias si no exceden el límite", () => {
      const refs = ["INC-001", "INC-002", "INC-003"];
      expect(buildReferencePreview(refs)).toBe("INC-001 · INC-002 · INC-003");
    });

    it("trunca con 'y N más' cuando supera el límite", () => {
      const refs = [
        "INC-001",
        "INC-002",
        "INC-003",
        "INC-004",
        "INC-005",
        "INC-006",
        "INC-007",
        "INC-008",
      ];
      expect(buildReferencePreview(refs, PREVIEW_LIMIT)).toBe(
        "INC-001 · INC-002 · INC-003 · INC-004 · INC-005 · INC-006 y 2 más",
      );
    });
  });

  describe("buildReportsCountLabel", () => {
    it("usa singular para 1 incidencia sin breakdown", () => {
      expect(buildReportsCountLabel(1, [])).toBe("1 incidencia");
    });

    it("usa plural para múltiples incidencias sin breakdown", () => {
      expect(buildReportsCountLabel(5, [])).toBe("5 incidencias");
    });

    it("concatena el desglose por estado cuando está presente", () => {
      const breakdown = ["3 resueltas", "2 en taller"];
      expect(buildReportsCountLabel(5, breakdown)).toBe(
        "5 incidencias · 3 resueltas · 2 en taller",
      );
    });
  });

  describe("groupTrailsByIncident", () => {
    it("devuelve un mapa vacío si trails es undefined", () => {
      const map = groupTrailsByIncident(undefined, ["id-1", "id-2"]);
      expect(map.size).toBe(0);
    });

    it("agrupa las entradas de rastro por cada ID de incidencia solicitado", () => {
      const trails = [
        { incidentId: "inc-1", action: "attach", name: "manual.pdf" },
        { incidentId: "inc-1", action: "remove", name: "foto.png" },
        { incidentId: "inc-2", action: "attach", name: "albaran.pdf" },
      ];
      const map = groupTrailsByIncident(trails, ["inc-1", "inc-2", "inc-3"]);

      expect(map.get("inc-1")?.length).toBe(2);
      expect(map.get("inc-2")?.length).toBe(1);
      expect(map.get("inc-3")?.length).toBe(0);
    });
  });

  describe("groupRequestsByIncident", () => {
    it("agrupa peticiones por su incidentId omitiendo las que no tengan uno", () => {
      const requests = [
        { incidentId: "inc-A", code: "P-1" },
        { incidentId: "inc-A", code: "P-2" },
        { incidentId: "inc-B", code: "P-3" },
        { incidentId: undefined, code: "P-4" },
      ];
      const map = groupRequestsByIncident(requests);

      expect(map.get("inc-A")?.length).toBe(2);
      expect(map.get("inc-B")?.length).toBe(1);
      expect(map.has("undefined")).toBe(false);
    });
  });

  describe("getLinkedEquipmentName", () => {
    it("devuelve undefined si la incidencia no tiene equipmentId", () => {
      expect(getLinkedEquipmentName({}, [])).toBeUndefined();
    });

    it("devuelve undefined si el equipo no se encuentra en la lista", () => {
      expect(
        getLinkedEquipmentName({ equipmentId: "eq-unknown" }, []),
      ).toBeUndefined();
    });

    it("devuelve la etiqueta del equipo cuando existe en la lista", () => {
      const equipmentList = [
        {
          _id: "eq-1",
          name: "Torno CNC 01",
          code: "CNC-01",
        } as unknown as EquipmentDoc,
      ];
      const result = getLinkedEquipmentName(
        { equipmentId: "eq-1" },
        equipmentList,
      );
      expect(result).toBeDefined();
      expect(result).toContain("Torno CNC 01");
    });
  });
});
