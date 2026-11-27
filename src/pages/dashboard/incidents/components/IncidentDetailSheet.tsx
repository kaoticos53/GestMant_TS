import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SharedMailSection } from "@/pages/dashboard/shared/SharedMailSection";
import { IncidentLifecycleExtras } from "./IncidentLifecycleExtras";
import { JourneySummary } from "@/components/JourneySummary";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { incidentNeedsDocumentUrls } from "@/lib/incidentFlow";
import { incidentJourney } from "@/lib/incidentJourney";
import { ChangePriorityDialog } from "../dialogs/ChangePriorityDialog";

import type { EquipmentDoc, IncidentDoc } from "../types";
import {
  IncidentActionsBar,
  IncidentDocumentsCard,
  IncidentEquipmentCard,
  IncidentEquipmentModals,
  IncidentHeader,
  IncidentHistoryCard,
  IncidentNotesCard,
  IncidentPartRequestsCard,
  IncidentStatusBanners,
  useIncidentDetailState,
} from "./detail";

export interface IncidentDetailSheetProps {
  incident: IncidentDoc;
  equipment: EquipmentDoc[];
  requests: Doc<"partRequests">[];
  currentUserId: Id<"users"> | null;
  currentUserName: string;
  canAssign: boolean;
  canOpenRequests?: boolean;
  onOpenRequest?: (id: Id<"partRequests">) => void;
  onOpenIncident?: (id: Id<"incidents">) => void;
  onClose: () => void;
}

export function IncidentDetailSheet({
  incident,
  equipment,
  requests,
  currentUserId,
  currentUserName,
  canAssign,
  canOpenRequests = false,
  onOpenRequest,
  onOpenIncident,
  onClose,
}: IncidentDetailSheetProps) {
  const needsDocumentUrls = incidentNeedsDocumentUrls(incident);
  const detailed = useQuery(
    api.incidents.detail,
    needsDocumentUrls ? { incidentId: incident._id } : "skip",
  );
  const resolvedIncident =
    needsDocumentUrls && detailed ? detailed : incident;

  const {
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
    nextLabel,
    nextHint,
    nowLabel,
    trailPending,
  } = useIncidentDetailState({
    incident: resolvedIncident,
    equipment,
    requests,
    currentUserId,
    canAssign,
  });

  const [priorityOpen, setPriorityOpen] = useState(false);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl lg:max-w-2xl">
        <IncidentHeader
          incident={resolvedIncident}
          statusLabel={statusLabel}
          badgeClassName={status.badgeClassName}
          statusDescription={status.description}
          onChangePriority={
            derived.canWork || derived.canCoordinate
              ? () => setPriorityOpen(true)
              : undefined
          }
        />

        <div className="grid min-w-0 gap-4 px-4 pb-4 sm:px-6 [&>*]:min-w-0">
          <JourneySummary
            label="Recorrido de la incidencia"
            stages={incidentJourney(resolvedIncident.status, {
              inWorkshop,
              archived: derived.archived,
            })}
            nowLabel={nowLabel}
            nextLabel={nextLabel}
            nextHint={nextHint}
            blocked={blockedSteps}
          />

          <IncidentStatusBanners
            withdrawnAt={derived.withdrawnAt}
            deletedBy={resolvedIncident.deletedBy}
            deletedReason={resolvedIncident.deletedReason}
            archivedAt={derived.archivedAt}
            withdrawn={derived.withdrawn}
          />

          {/* Datos del equipo, notificación y SAT externo */}
          <IncidentEquipmentCard
            incident={resolvedIncident}
            linkedEquipment={linkedEquipment}
            canWork={derived.canWork}
            inWorkshop={inWorkshop}
            onCorrectEquipment={() => setEquipmentOpen(true)}
            onCreateEquipment={() => setCreateEquipmentOpen(true)}
          />

          {/* Peticiones de material */}
          <IncidentPartRequestsCard
            incident={resolvedIncident}
            linkedRequests={linkedRequests}
            canOpenRequests={canOpenRequests}
            onOpenRequest={onOpenRequest}
          />

          {/* Historial de estados */}
          <IncidentHistoryCard history={resolvedIncident.history} />

          {/* Expediente documental */}
          <IncidentDocumentsCard
            incident={resolvedIncident}
            canAssign={canAssign}
            canCoordinate={derived.canCoordinate}
            trail={trail}
          />

          {/* Cuaderno de bitácora y notas del ciclo de vida */}
          <IncidentNotesCard
            incident={resolvedIncident}
            currentUserId={currentUserId}
            canWork={derived.canWork}
            canAssign={canAssign}
          />

          <SharedMailSection
            destinationType="incident"
            destinationId={resolvedIncident._id}
          />
        </div>

        {/* Barra fija de acciones y modales subordinados */}
        <IncidentActionsBar
          incident={resolvedIncident}
          equipment={equipment}
          linkedEquipment={linkedEquipment}
          linkedRequests={linkedRequests}
          trail={trail}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          canWork={derived.canWork}
          canCoordinate={derived.canCoordinate}
          canReassignWorkshop={canReassignWorkshop}
          inWorkshop={inWorkshop}
          archived={derived.archived}
          withdrawn={derived.withdrawn}
          trailPending={trailPending}
          onClose={onClose}
        />

        <IncidentLifecycleExtras
          incident={resolvedIncident}
          canCoordinate={derived.canCoordinate}
          canWork={derived.canWork}
          archived={derived.archived}
          withdrawn={derived.withdrawn}
          onOpenIncident={onOpenIncident}
        />

        {priorityOpen && (
          <ChangePriorityDialog
            incident={resolvedIncident}
            onClose={() => setPriorityOpen(false)}
          />
        )}

        <IncidentEquipmentModals
          incident={resolvedIncident}
          equipmentOpen={equipmentOpen}
          createEquipmentOpen={createEquipmentOpen}
          onCloseEquipment={() => setEquipmentOpen(false)}
          onCloseCreateEquipment={() => setCreateEquipmentOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
