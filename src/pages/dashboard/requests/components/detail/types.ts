import type { BlockedJourneyStep, JourneyStage } from "@/lib/journey";

export interface RequestStatusBannersProps {
  withdrawnAt?: number;
  deletedBy?: string;
  deletedReason?: string;
  archivedAt?: number;
}

export interface RequestNotesSectionProps {
  description?: string;
  notes?: string;
}

export interface RequestJourneyCardProps {
  stages: JourneyStage[];
  nowLabel: string;
  nextLabel: string | null;
  nextHint: string;
  blocked: BlockedJourneyStep[];
}
