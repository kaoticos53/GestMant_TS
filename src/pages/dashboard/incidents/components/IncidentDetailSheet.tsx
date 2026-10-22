import { Sheet, SheetContent } from "@/components/ui/sheet";
import { JourneySummary } from "@/components/JourneySummary";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { incidentJourney } from "@/lib/incidentJourney";

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
  onClose,
}: IncidentDetailSheetProps) {
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
    incident,
    equipment,
    requests,
    currentUserId,
    canAssign,
  });

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl lg:max-w-2xl">
        <IncidentHeader
          incident={incident}
          statusLabel={statusLabel}
          badgeClassName={status.badgeClassName}
          statusDescription={status.description}
        />

        <div className="grid gap-4 px-4 pb-4 sm:px-6">
          <JourneySummary
            label="Recorrido de la incidencia"
            stages={incidentJourney(incident.status, {
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
            deletedBy={incident.deletedBy}
            deletedReason={incident.deletedReason}
            archivedAt={derived.archivedAt}
            withdrawn={derived.withdrawn}
          />

          {/* Datos del equipo, notificación y SAT externo */}
          <IncidentEquipmentCard
            incident={incident}
            linkedEquipment={linkedEquipment}
            canWork={derived.canWork}
            inWorkshop={inWorkshop}
            onCorrectEquipment={() => setEquipmentOpen(true)}
            onCreateEquipment={() => setCreateEquipmentOpen(true)}
          />

          {/* Peticiones de material */}
          <IncidentPartRequestsCard
            incident={incident}
            linkedRequests={linkedRequests}
            canOpenRequests={canOpenRequests}
            onOpenRequest={onOpenRequest}
          />

          {/* Historial de estados */}
          <IncidentHistoryCard history={incident.history} />

          {/* Expediente documental */}
          <IncidentDocumentsCard
            incident={incident}
            canAssign={canAssign}
            canCoordinate={derived.canCoordinate}
            trail={trail}
          />

          {/* Cuaderno de bitácora y notas del ciclo de vida */}
          <IncidentNotesCard
            incident={incident}
            currentUserId={currentUserId}
            canWork={derived.canWork}
            canAssign={canAssign}
          />
        </div>

        {/* Barra fija de acciones y modales subordinados */}
        <IncidentActionsBar
          incident={incident}
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

        <IncidentEquipmentModals
          incident={incident}
          equipmentOpen={equipmentOpen}
          createEquipmentOpen={createEquipmentOpen}
          onCloseEquipment={() => setEquipmentOpen(false)}
          onCloseCreateEquipment={() => setCreateEquipmentOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
