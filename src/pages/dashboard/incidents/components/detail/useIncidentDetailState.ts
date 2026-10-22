import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  INCIDENT_STEP_LABELS,
  canChangeWorkshopTechnician,
  isClosedIncident,
  isIncidentInWorkshop,
} from "@/lib/incidentFlow";
import {
  NEXT_STEP_LABELS,
  blockedJourneySteps,
  nextIncidentAction,
} from "@/lib/incidentJourney";
import { INCIDENT_STATUS_META, incidentStatusLabel } from "@/lib/workshop";
import type { EquipmentDoc, IncidentDoc } from "../../types";
import {
  filterAndSortIncidentRequests,
  getIncidentNextHint,
  getJourneyNowLabel,
  resolveIncidentDerivedState,
} from "./helpers";

export interface UseIncidentDetailStateParams {
  incident: IncidentDoc;
  equipment: EquipmentDoc[];
  requests: Doc<"partRequests">[];
  currentUserId: Id<"users"> | null;
  canAssign: boolean;
}

export function useIncidentDetailState({
  incident,
  equipment,
  requests,
  currentUserId,
  canAssign,
}: UseIncidentDetailStateParams) {
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [createEquipmentOpen, setCreateEquipmentOpen] = useState(false);

  const trail = useQuery(
    api.incidents.documentTrail,
    canAssign ? { incidentId: incident._id } : "skip",
  );

  const status = INCIDENT_STATUS_META[incident.status];
  const inWorkshop = isIncidentInWorkshop(incident);
  const statusLabel = incidentStatusLabel(incident.status, inWorkshop);

  const linkedEquipment = incident.equipmentId
    ? (equipment.find((item) => item._id === incident.equipmentId) ?? null)
    : null;

  const linkedRequests = filterAndSortIncidentRequests(requests, incident._id);

  const derived = resolveIncidentDerivedState(incident, currentUserId, canAssign);

  const canReassignWorkshop = canChangeWorkshopTechnician(incident, {
    id: currentUserId,
    coordinates: derived.canCoordinate,
  });

  const blockedSteps =
    derived.canWork && !isClosedIncident(incident.status)
      ? blockedJourneySteps(incident.status)
      : [];

  const nextAction = nextIncidentAction(incident.status, {
    canWork: derived.canWork,
    canAssign: derived.canCoordinate,
    inWorkshop,
  });

  const nextLabel = nextAction
    ? (NEXT_STEP_LABELS[nextAction] ?? INCIDENT_STEP_LABELS[nextAction])
    : null;

  const nextHint = getIncidentNextHint({
    status: incident.status,
    withdrawn: derived.withdrawn,
    archived: derived.archived,
    canWork: derived.canWork,
    canAssign,
    assigneeName: incident.assigneeName,
    workshopAssigneeName: incident.workshopAssigneeName,
  });

  const nowLabel = getJourneyNowLabel(statusLabel, {
    withdrawn: derived.withdrawn,
    archived: derived.archived,
  });

  const trailPending = canAssign && trail === undefined;

  return {
    equipmentOpen,
    setEquipmentOpen,
    createEquipmentOpen,
    setCreateEquipmentOpen,
    trail,
    status,
    inWorkshop,
    statusLabel,
    linkedEquipment,
    linkedRequests,
    derived,
    canReassignWorkshop,
    blockedSteps,
    nextAction,
    nextLabel,
    nextHint,
    nowLabel,
    trailPending,
  };
}
