import { isIncidentWaitingParts } from "@/lib/incidentFlow";
import type { IncidentStatus } from "@/lib/workshop";
import { canShowSelfAssignAction, getIncidentFootnote } from "../helpers";

interface IncidentActionsFootnoteProps {
  status: IncidentStatus;
  withdrawn: boolean;
  archived: boolean;
  canWork: boolean;
}

export function IncidentActionsFootnote({
  status,
  withdrawn,
  archived,
  canWork,
}: IncidentActionsFootnoteProps) {
  const footnote = getIncidentFootnote({
    withdrawn,
    archived,
    canWork,
    canSelfAssign: canShowSelfAssignAction(status),
    isWaitingParts: isIncidentWaitingParts(status),
  });

  if (!footnote) return null;

  return (
    <p className="mt-2 text-right text-xs text-muted-foreground">{footnote}</p>
  );
}
