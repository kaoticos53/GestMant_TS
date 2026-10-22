import type { BlockedJourneyStep, JourneyStage } from "@/lib/journey";
import type { BlockedStageGroup } from "./types";

/**
 * Agrupa los pasos bloqueados por su etapa correspondiente, preservando el orden del recorrido.
 */
export function groupBlockedByStage(
  stages: JourneyStage[],
  blocked: readonly BlockedJourneyStep[],
): BlockedStageGroup[] {
  return stages
    .map((stage, index) => ({
      stage,
      index,
      steps: blocked.filter((step) => step.stage === stage.key),
    }))
    .filter((group) => group.steps.length > 0);
}

/**
 * Devuelve la etiqueta descriptiva para lectores de pantalla según el estado de la etapa.
 */
export function getStageAccessibilityLabel(
  state: JourneyStage["state"],
): string {
  switch (state) {
    case "current":
      return "Etapa actual";
    case "done":
      return "Etapa completada";
    case "skipped":
      return "Etapa que no se pasó";
    default:
      return "Etapa pendiente";
  }
}

/**
 * Formatea el sufijo de progreso "(paso X de Y)" para el estado actual.
 */
export function formatNowStepLabel(current: number, total: number): string {
  return current >= 0 ? ` (paso ${current + 1} de ${total})` : "";
}
