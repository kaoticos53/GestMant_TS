import { describe, expect, it } from "vitest";
import type { BlockedJourneyStep, JourneyStage } from "../src/lib/journey";
import {
  formatNowStepLabel,
  getStageAccessibilityLabel,
  groupBlockedByStage,
} from "../src/components/journeySummary/helpers";

describe("journeySummary helpers", () => {
  describe("groupBlockedByStage", () => {
    const sampleStages: JourneyStage[] = [
      { key: "reported", label: "Reportada", state: "done" },
      { key: "in_progress", label: "En curso", state: "current" },
      { key: "verify", label: "Verificar", state: "pending" },
      { key: "closed", label: "Cerrada", state: "pending" },
    ];

    it("agrupa los pasos bloqueados bajo sus respectivas etapas en orden", () => {
      const blocked: BlockedJourneyStep[] = [
        {
          stage: "verify",
          action: "verify",
          label: "Verificar trabajo",
          reason: "Requiere completar la intervención",
        },
        {
          stage: "closed",
          action: "close",
          label: "Cerrar",
          reason: "Debe estar verificada",
        },
      ];

      const grouped = groupBlockedByStage(sampleStages, blocked);
      expect(grouped).toHaveLength(2);
      expect(grouped[0].stage.key).toBe("verify");
      expect(grouped[0].index).toBe(2);
      expect(grouped[0].steps).toHaveLength(1);
      expect(grouped[0].steps[0].action).toBe("verify");
      expect(grouped[1].stage.key).toBe("closed");
      expect(grouped[1].index).toBe(3);
    });

    it("ignora etapas que no tienen pasos bloqueados", () => {
      const blocked: BlockedJourneyStep[] = [
        {
          stage: "verify",
          action: "verify",
          label: "Verificar trabajo",
          reason: "En espera",
        },
      ];

      const grouped = groupBlockedByStage(sampleStages, blocked);
      expect(grouped).toHaveLength(1);
      expect(grouped[0].stage.key).toBe("verify");
    });

    it("devuelve array vacío si no hay bloqueos", () => {
      expect(groupBlockedByStage(sampleStages, [])).toEqual([]);
    });
  });

  describe("getStageAccessibilityLabel", () => {
    it("devuelve la etiqueta correspondiente a cada estado", () => {
      expect(getStageAccessibilityLabel("current")).toBe("Etapa actual");
      expect(getStageAccessibilityLabel("done")).toBe("Etapa completada");
      expect(getStageAccessibilityLabel("skipped")).toBe("Etapa que no se pasó");
      expect(getStageAccessibilityLabel("pending")).toBe("Etapa pendiente");
    });
  });

  describe("formatNowStepLabel", () => {
    it("formatea el paso actual en base a 1", () => {
      expect(formatNowStepLabel(1, 4)).toBe(" (paso 2 de 4)");
      expect(formatNowStepLabel(0, 5)).toBe(" (paso 1 de 5)");
    });

    it("devuelve string vacío si current es negativo", () => {
      expect(formatNowStepLabel(-1, 4)).toBe("");
    });
  });
});
