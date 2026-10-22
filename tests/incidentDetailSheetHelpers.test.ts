import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  filterAndSortIncidentRequests,
  getIncidentNextHint,
  getJourneyNowLabel,
  resolveIncidentDerivedState,
} from "@/pages/dashboard/incidents/components/detail/helpers";

const fakeIncidentId = "inc_1" as Id<"incidents">;
const fakeOtherIncidentId = "inc_2" as Id<"incidents">;
const fakeUserId = "usr_1" as Id<"users">;
const fakeOtherUserId = "usr_2" as Id<"users">;

describe("incidentDetailSheetHelpers", () => {
  describe("getIncidentNextHint", () => {
    it("devuelve mensaje de papelera si está retirada", () => {
      const hint = getIncidentNextHint({
        status: "assigned",
        withdrawn: true,
        archived: false,
        canWork: true,
        canAssign: true,
      });
      expect(hint).toContain("Retirada a la papelera");
    });

    it("devuelve mensaje de archivo si está archivada y no retirada", () => {
      const hint = getIncidentNextHint({
        status: "assigned",
        withdrawn: false,
        archived: true,
        canWork: true,
        canAssign: true,
      });
      expect(hint).toContain("En el archivo");
    });

    it("devuelve mensaje de caso cerrado si el estado es final", () => {
      const hintResolved = getIncidentNextHint({
        status: "resolved",
        withdrawn: false,
        archived: false,
        canWork: true,
        canAssign: true,
      });
      expect(hintResolved).toContain("El caso está cerrado");

      const hintUnresolved = getIncidentNextHint({
        status: "unresolved",
        withdrawn: false,
        archived: false,
        canWork: true,
        canAssign: true,
      });
      expect(hintUnresolved).toContain("El caso está cerrado");
    });

    it("devuelve mensaje de espera de material si está en waitingParts", () => {
      const hint = getIncidentNextHint({
        status: "waitingParts",
        withdrawn: false,
        archived: false,
        canWork: true,
        canAssign: true,
      });
      expect(hint).toContain("Esperando material");
    });

    it("indica el nombre del responsable asignado cuando no puede trabajarla ni coordinarla", () => {
      const hint = getIncidentNextHint({
        status: "assigned",
        withdrawn: false,
        archived: false,
        canWork: false,
        canAssign: false,
        assigneeName: "Carlos Pérez",
      });
      expect(hint).toBe("No la llevas tú: la siguiente acción es de Carlos Pérez.");
    });

    it("indica el técnico de taller si no hay assigneeName", () => {
      const hint = getIncidentNextHint({
        status: "workshop",
        withdrawn: false,
        archived: false,
        canWork: false,
        canAssign: false,
        assigneeName: null,
        workshopAssigneeName: "Lucía Taller",
      });
      expect(hint).toBe("No la llevas tú: la siguiente acción es de Lucía Taller.");
    });

    it("usa el fallback de coordinador si no hay ningún técnico asignado", () => {
      const hint = getIncidentNextHint({
        status: "reported",
        withdrawn: false,
        archived: false,
        canWork: false,
        canAssign: false,
      });
      expect(hint).toBe(
        "No la llevas tú: la siguiente acción es de quien coordina las incidencias.",
      );
    });

    it("devuelve mensaje por defecto cuando puede trabajarla pero no hay paso", () => {
      const hint = getIncidentNextHint({
        status: "assigned",
        withdrawn: false,
        archived: false,
        canWork: true,
        canAssign: true,
      });
      expect(hint).toBe("Sin pasos disponibles ahora mismo.");
    });
  });

  describe("getJourneyNowLabel", () => {
    it("anexa retirada si está borrada", () => {
      expect(
        getJourneyNowLabel("En taller", { withdrawn: true, archived: false }),
      ).toBe("En taller · retirada");
    });

    it("anexa en el archivo si está archivada y no retirada", () => {
      expect(
        getJourneyNowLabel("En taller", { withdrawn: false, archived: true }),
      ).toBe("En taller · en el archivo");
    });

    it("mantiene la etiqueta limpia si está activa", () => {
      expect(
        getJourneyNowLabel("En taller", { withdrawn: false, archived: false }),
      ).toBe("En taller");
    });
  });

  describe("resolveIncidentDerivedState", () => {
    it("resuelve flags de archivo y retirada", () => {
      const state = resolveIncidentDerivedState(
        {
          archivedAt: 123456,
          deletedAt: 789012,
        },
        fakeUserId,
        true,
      );

      expect(state.archived).toBe(true);
      expect(state.withdrawn).toBe(true);
      expect(state.canWork).toBe(false);
      expect(state.canCoordinate).toBe(false);
    });

    it("permite trabajar y coordinar a quien tiene canAssign", () => {
      const state = resolveIncidentDerivedState(
        {
          assigneeId: fakeOtherUserId,
        },
        fakeUserId,
        true,
      );

      expect(state.isAssignee).toBe(false);
      expect(state.canWork).toBe(true);
      expect(state.canCoordinate).toBe(true);
    });

    it("permite trabajar al técnico asignado en planta", () => {
      const state = resolveIncidentDerivedState(
        {
          assigneeId: fakeUserId,
        },
        fakeUserId,
        false,
      );

      expect(state.isAssignee).toBe(true);
      expect(state.canWork).toBe(true);
      expect(state.canCoordinate).toBe(false);
    });

    it("permite trabajar al técnico asignado en taller", () => {
      const state = resolveIncidentDerivedState(
        {
          workshopAssigneeId: fakeUserId,
        },
        fakeUserId,
        false,
      );

      expect(state.isAssignee).toBe(true);
      expect(state.canWork).toBe(true);
      expect(state.canCoordinate).toBe(false);
    });

    it("no permite trabajar ni coordinar a un usuario ajeno sin permiso", () => {
      const state = resolveIncidentDerivedState(
        {
          assigneeId: fakeOtherUserId,
        },
        fakeUserId,
        false,
      );

      expect(state.isAssignee).toBe(false);
      expect(state.canWork).toBe(false);
      expect(state.canCoordinate).toBe(false);
    });
  });

  describe("filterAndSortIncidentRequests", () => {
    it("filtra solo las peticiones de la incidencia y las ordena por fecha ascendente", () => {
      const requests = [
        { id: "r3", incidentId: fakeIncidentId, createdAt: 300 },
        { id: "r1", incidentId: fakeIncidentId, createdAt: 100 },
        { id: "r_other", incidentId: fakeOtherIncidentId, createdAt: 50 },
        { id: "r2", incidentId: fakeIncidentId, createdAt: 200 },
      ];

      const result = filterAndSortIncidentRequests(requests, fakeIncidentId);

      expect(result.map((r) => r.id)).toEqual(["r1", "r2", "r3"]);
    });

    it("devuelve arreglo vacío si no hay peticiones para la incidencia", () => {
      const requests = [
        { id: "r_other", incidentId: fakeOtherIncidentId, createdAt: 50 },
      ];

      const result = filterAndSortIncidentRequests(requests, fakeIncidentId);
      expect(result).toEqual([]);
    });
  });
});
