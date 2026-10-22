import { describe, expect, it } from "vitest";
import {
  canShowArchiveAction,
  canShowCloseResolvedAction,
  canShowPartRequestsAction,
  canShowReturnExternalAction,
  canShowSelfAssignAction,
  canShowSendExternalAction,
  canShowVerifyAction,
  getIncidentFootnote,
} from "../src/pages/dashboard/incidents/components/detail/actions/helpers";

describe("incidentActionsBar helpers", () => {
  describe("getIncidentFootnote", () => {
    it("retorna texto explicativo si está en papelera", () => {
      const footnote = getIncidentFootnote({
        withdrawn: true,
        archived: false,
        canWork: true,
        canSelfAssign: true,
        isWaitingParts: false,
      });
      expect(footnote).toContain("En la papelera");
    });

    it("retorna texto de archivo si está archivada y no en papelera", () => {
      const footnote = getIncidentFootnote({
        withdrawn: false,
        archived: true,
        canWork: true,
        canSelfAssign: true,
        isWaitingParts: false,
      });
      expect(footnote).toContain("En el archivo");
    });

    it("retorna aviso de permisos si no puede actuar ni autoasignarse", () => {
      const footnote = getIncidentFootnote({
        withdrawn: false,
        archived: false,
        canWork: false,
        canSelfAssign: false,
        isWaitingParts: false,
      });
      expect(footnote).toContain("Solo el técnico asignado o el coordinador");
    });

    it("retorna aviso de espera de material si canWork y está esperando piezas", () => {
      const footnote = getIncidentFootnote({
        withdrawn: false,
        archived: false,
        canWork: true,
        canSelfAssign: false,
        isWaitingParts: true,
      });
      expect(footnote).toContain("Esperando el material de la petición");
    });

    it("retorna null si es una incidencia activa normal con técnico asignado", () => {
      const footnote = getIncidentFootnote({
        withdrawn: false,
        archived: false,
        canWork: true,
        canSelfAssign: false,
        isWaitingParts: false,
      });
      expect(footnote).toBeNull();
    });
  });

  describe("action visibility predicates", () => {
    it("canShowSelfAssignAction se activa en estado reported", () => {
      expect(canShowSelfAssignAction("reported")).toBe(true);
      expect(canShowSelfAssignAction("in_progress")).toBe(false);
    });

    it("canShowVerifyAction requiere canWork y no estar en el taller todavía", () => {
      expect(canShowVerifyAction("reported", true, false)).toBe(false);
      expect(canShowVerifyAction("assigned", true, false)).toBe(true);
      expect(canShowVerifyAction("assigned", true, true)).toBe(false);
      expect(canShowVerifyAction("assigned", false, false)).toBe(false);
    });

    it("canShowPartRequestsAction requiere canWork y estado que admita peticiones", () => {
      expect(canShowPartRequestsAction("repairing", true)).toBe(true);
      expect(canShowPartRequestsAction("repairing", false)).toBe(false);
      expect(canShowPartRequestsAction("resolved", true)).toBe(false);
    });

    it("canShowArchiveAction solo permite archivar incidencias cerradas si puede coordinar", () => {
      expect(canShowArchiveAction("resolved", true)).toBe(true);
      expect(canShowArchiveAction("unresolved", true)).toBe(true);
      expect(canShowArchiveAction("repairing", true)).toBe(false);
      expect(canShowArchiveAction("resolved", false)).toBe(false);
    });

    it("canShowSendExternalAction y canShowReturnExternalAction validan permisos y máquina de estados", () => {
      expect(canShowSendExternalAction("assigned", true)).toBe(true);
      expect(canShowSendExternalAction("assigned", false)).toBe(false);
      expect(canShowReturnExternalAction("externalRepair", true)).toBe(true);
      expect(canShowReturnExternalAction("externalRepair", false)).toBe(false);
    });

    it("canShowCloseResolvedAction requiere canWork y que esté en el taller", () => {
      expect(canShowCloseResolvedAction("workshop", true, true)).toBe(true);
      expect(canShowCloseResolvedAction("workshop", true, false)).toBe(false);
      expect(canShowCloseResolvedAction("workshop", false, true)).toBe(false);
    });
  });
});

