import type { BlockedJourneyStep, JourneyStage } from "@/lib/journey";

export interface BlockedStageGroup {
  stage: JourneyStage;
  index: number;
  steps: BlockedJourneyStep[];
}

export interface StageDotProps {
  state: JourneyStage["state"];
  index: number;
}

export interface JourneyStagesListProps {
  stages: JourneyStage[];
}

export interface JourneyNowNextStatusProps {
  current: number;
  totalStages: number;
  nowLabel: string;
  nextLabel: string | null;
  nextHint: string;
}

export interface JourneyBlockedStepsProps {
  blockedByStage: BlockedStageGroup[];
}

export interface JourneySummaryProps {
  /** Cómo se anuncia el bloque para lectores de pantalla. */
  label: string;
  /** Las etapas, en orden, ya resueltas por la máquina del caso. */
  stages: JourneyStage[];
  /** El estado tal y como se cuenta en la ficha. */
  nowLabel: string;
  /** El paso que toca, si quien mira puede darlo. */
  nextLabel: string | null;
  /** Qué pasa cuando no hay paso: cerrada, no te toca, esperando material. */
  nextHint: string;
  /** Los pasos que la máquina no deja dar, con la etapa a la que pertenecen. */
  blocked: readonly BlockedJourneyStep[];
}
