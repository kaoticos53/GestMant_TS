import { JourneySummary } from "@/components/JourneySummary";
import type { RequestJourneyCardProps } from "./types";

export function RequestJourneyCard({
  stages,
  nowLabel,
  nextLabel,
  nextHint,
  blocked,
}: RequestJourneyCardProps) {
  return (
    <JourneySummary
      label="Recorrido de la petición"
      stages={stages}
      nowLabel={nowLabel}
      nextLabel={nextLabel}
      nextHint={nextHint}
      blocked={blocked}
    />
  );
}
