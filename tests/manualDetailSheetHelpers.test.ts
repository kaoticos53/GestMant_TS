import { describe, expect, it } from "vitest";
import {
  findLinkedEquipment,
  getManualScopeDescription,
  getManualSubtitle,
} from "../src/pages/dashboard/manualDetail/helpers";
import type { EquipmentDoc, ManualDoc } from "../src/pages/dashboard/manualDetail/types";

describe("manualDetailSheetHelpers", () => {
  const mockEquipment: EquipmentDoc[] = [
    {
      _id: "eq_1" as any,
      _creationTime: 1000,
      name: "Torno Paralelo",
      location: "Área de Mecanizado",
      model: "Pinacho L-1/200",
      status: "operational",
    } as unknown as EquipmentDoc,
    {
      _id: "eq_2" as any,
      _creationTime: 2000,
      name: "Fresadora Universal",
      location: "Área de Fresado",
      status: "operational",
    } as unknown as EquipmentDoc,
  ];

  const baseManual: ManualDoc = {
    _id: "man_1" as any,
    _creationTime: 1000,
    title: "Manual de Operación Torno",
    kind: "file",
    type: "manual",
    createdAt: 1000,
    updatedAt: 1000,
    history: [],
  } as unknown as ManualDoc;

  describe("findLinkedEquipment", () => {
    it("encuentra el equipo correspondiente por id", () => {
      const found = findLinkedEquipment(mockEquipment, "eq_1");
      expect(found).toBeDefined();
      expect(found?.name).toBe("Torno Paralelo");
    });

    it("devuelve undefined si el equipo no está en la lista o si no hay equipmentId", () => {
      expect(findLinkedEquipment(mockEquipment, undefined)).toBeUndefined();
      expect(findLinkedEquipment(mockEquipment, "eq_inexistente")).toBeUndefined();
    });
  });

  describe("getManualScopeDescription", () => {
    it("prioriza la asignación concreta al equipo si existe", () => {
      const linked = mockEquipment[0];
      const desc = getManualScopeDescription(baseManual, linked);
      expect(desc).toBe("Asignado a Torno Paralelo Pinacho L-1/200");
    });

    it("indica el alcance cuando no hay equipo vinculado", () => {
      const generalManual: ManualDoc = {
        ...baseManual,
      } as unknown as ManualDoc;
      const desc = getManualScopeDescription(generalManual, undefined);
      expect(desc).toBe("Sin equipo asignado");
    });

    it("indica marca y modelo si el manual los especifica sin equipo directo", () => {
      const modelManual: ManualDoc = {
        ...baseManual,
        brand: "Pinacho",
        model: "L-1/200",
      } as unknown as ManualDoc;
      const desc = getManualScopeDescription(modelManual, undefined);
      expect(desc).toContain("Pinacho L-1/200");
    });
  });

  describe("getManualSubtitle", () => {
    it("incluye el autor si está presente en el manual", () => {
      const manualWithAuthor: ManualDoc = {
        ...baseManual,
        author: "Ricardo Técnico",
      } as unknown as ManualDoc;
      const subtitle = getManualSubtitle(manualWithAuthor, mockEquipment[0]);
      expect(subtitle).toBe("Asignado a Torno Paralelo Pinacho L-1/200 · Ricardo Técnico");
    });

    it("devuelve solo el ámbito si no hay autor", () => {
      const manualWithoutAuthor: ManualDoc = {
        ...baseManual,
        author: undefined,
      } as unknown as ManualDoc;
      const subtitle = getManualSubtitle(manualWithoutAuthor, mockEquipment[0]);
      expect(subtitle).toBe("Asignado a Torno Paralelo Pinacho L-1/200");
      expect(subtitle).not.toContain("·");
    });
  });
});
