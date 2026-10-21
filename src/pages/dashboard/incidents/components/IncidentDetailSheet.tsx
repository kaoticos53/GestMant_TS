import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { JourneySummary } from "@/components/JourneySummary";
import { RichText } from "@/components/RichText";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  INCIDENT_STEP_LABELS,
  canChangeWorkshopTechnician,
  isClosedIncident,
  isIncidentInWorkshop,
  isIncidentWaitingParts,
} from "@/lib/incidentFlow";
import {
  NEXT_STEP_LABELS,
  blockedJourneySteps,
  incidentJourney,
  nextIncidentAction,
} from "@/lib/incidentJourney";
import {
  INCIDENT_STATUS_META,
  formatDateTime,
  getErrorMessage,
  incidentStatusLabel,
} from "@/lib/workshop";

import type { EquipmentDoc, IncidentDoc } from "../types";
import { CorrectEquipmentDialog } from "../dialogs/CorrectEquipmentDialog";
import { EquipmentFormDialog } from "../../equipment/dialogs/EquipmentFormDialog";
import { IncidentHeader } from "./detail/IncidentHeader";
import { IncidentEquipmentCard } from "./detail/IncidentEquipmentCard";
import { IncidentPartRequestsCard } from "./detail/IncidentPartRequestsCard";
import { IncidentDocumentsCard } from "./detail/IncidentDocumentsCard";
import { IncidentNotesCard } from "./detail/IncidentNotesCard";
import { IncidentActionsBar } from "./detail/IncidentActionsBar";

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
}: {
  incident: IncidentDoc;
  equipment: EquipmentDoc[];
  requests: Doc<"partRequests">[];
  currentUserId: Id<"users"> | null;
  currentUserName: string;
  canAssign: boolean;
  canOpenRequests?: boolean;
  onOpenRequest?: (id: Id<"partRequests">) => void;
  onClose: () => void;
}) {
  const updateEquipment = useMutation(api.incidents.updateEquipment);

  const trail = useQuery(
    api.incidents.documentTrail,
    canAssign ? { incidentId: incident._id } : "skip",
  );

  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [createEquipmentOpen, setCreateEquipmentOpen] = useState(false);

  const status = INCIDENT_STATUS_META[incident.status];
  const inWorkshop = isIncidentInWorkshop(incident);
  const statusLabel = incidentStatusLabel(incident.status, inWorkshop);

  const linkedEquipment = incident.equipmentId
    ? (equipment.find((item) => item._id === incident.equipmentId) ?? null)
    : null;

  const linkedRequests = requests
    .filter((request) => request.incidentId === incident._id)
    .sort((a, b) => a.createdAt - b.createdAt);

  const isAssignee =
    currentUserId !== null &&
    (incident.assigneeId === currentUserId ||
      incident.workshopAssigneeId === currentUserId);

  const archivedAt = incident.archivedAt;
  const archived = archivedAt !== undefined;
  const withdrawnAt = incident.deletedAt;
  const withdrawn = withdrawnAt !== undefined;

  const canWork = !archived && !withdrawn && (canAssign || isAssignee);
  const canCoordinate = canAssign && !archived && !withdrawn;

  const canReassignWorkshop = canChangeWorkshopTechnician(incident, {
    id: currentUserId,
    coordinates: canCoordinate,
  });

  const blockedSteps =
    canWork && !isClosedIncident(incident.status)
      ? blockedJourneySteps(incident.status)
      : [];

  const nextAction = nextIncidentAction(incident.status, {
    canWork,
    canAssign: canCoordinate,
    inWorkshop,
  });

  const nextLabel = nextAction
    ? (NEXT_STEP_LABELS[nextAction] ?? INCIDENT_STEP_LABELS[nextAction])
    : null;

  const nextHint = withdrawn
    ? "Retirada a la papelera: se consulta en solo lectura hasta recuperarla o borrarla."
    : archived
      ? "En el archivo: la incidencia se consulta en solo lectura."
      : isClosedIncident(incident.status)
        ? "El caso está cerrado: se archiva cuando toque desde el pie."
        : isIncidentWaitingParts(incident.status)
          ? "Esperando material: el caso sigue cuando se entregue la petición."
          : !canWork && !canAssign
            ? `No la llevas tú: la siguiente acción es de ${
                incident.assigneeName ??
                incident.workshopAssigneeName ??
                "quien coordina las incidencias"
              }.`
            : "Sin pasos disponibles ahora mismo.";

  const trailPending = canAssign && trail === undefined;

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
            stages={incidentJourney(incident.status, { inWorkshop, archived })}
            nowLabel={
              withdrawn
                ? `${statusLabel} · retirada`
                : archived
                  ? `${statusLabel} · en el archivo`
                  : statusLabel
            }
            nextLabel={nextLabel}
            nextHint={nextHint}
            blocked={blockedSteps}
          />

          {withdrawnAt !== undefined && (
            <p className="rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-3 text-xs leading-5 text-muted-foreground">
              Retirada el {formatDateTime(withdrawnAt)}
              {incident.deletedBy ? ` por ${incident.deletedBy}` : ""}
              {incident.deletedReason ? ` · ${incident.deletedReason}` : ""}.
              Mientras esté en la papelera se consulta en solo lectura; se
              recupera o se borra desde el módulo Archivo.
            </p>
          )}

          {archivedAt !== undefined && !withdrawn && (
            <p className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
              En el archivo desde el {formatDateTime(archivedAt)}: la incidencia
              se consulta en solo lectura y no se trabaja desde la cola. Para
              volver a tramitarla, recupérala desde el módulo Archivo.
            </p>
          )}

          {/* Datos del equipo, notificación y SAT externo */}
          <IncidentEquipmentCard
            incident={incident}
            linkedEquipment={linkedEquipment}
            canWork={canWork}
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
          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Historial de estados
            </p>
            <ol className="mt-3 space-y-3">
              {incident.history.map((entry, index) => {
                const meta = INCIDENT_STATUS_META[entry.status];
                return (
                  <li
                    key={`${entry.status}-${entry.at}-${index}`}
                    className="flex gap-3"
                  >
                    <span className="mt-1 size-2 shrink-0 rounded-full bg-signal" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={meta.badgeClassName}
                        >
                          {meta.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(entry.at)}
                        </span>
                        {entry.by && (
                          <span className="text-xs text-muted-foreground">
                            · {entry.by}
                          </span>
                        )}
                      </div>
                      {entry.note && (
                        <RichText
                          value={entry.note}
                          className="mt-0.5 text-muted-foreground"
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Expediente documental */}
          <IncidentDocumentsCard
            incident={incident}
            canAssign={canAssign}
            canCoordinate={canCoordinate}
            trail={trail}
          />

          {/* Cuaderno de bitácora y notas del ciclo de vida */}
          <IncidentNotesCard
            incident={incident}
            currentUserId={currentUserId}
            canWork={canWork}
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
          canWork={canWork}
          canCoordinate={canCoordinate}
          canReassignWorkshop={canReassignWorkshop}
          inWorkshop={inWorkshop}
          archived={archived}
          withdrawn={withdrawn}
          trailPending={trailPending}
          onClose={onClose}
        />

        {equipmentOpen && (
          <CorrectEquipmentDialog
            incident={incident}
            onClose={() => setEquipmentOpen(false)}
          />
        )}

        {createEquipmentOpen && (
          <EquipmentFormDialog
            item={null}
            initialValues={{
              model: incident.model,
              serialNumber: incident.serialNumber,
              location: incident.location,
            }}
            onSuccess={async (createdId) => {
              try {
                await updateEquipment({
                  incidentId: incident._id,
                  equipmentId: createdId,
                  model: incident.model,
                  serialNumber: incident.serialNumber,
                  expectedUpdatedAt: incident.updatedAt,
                });
                toast.success(
                  `Equipo vinculado a la incidencia ${incident.reference}`,
                );
              } catch (err) {
                toast.error(getErrorMessage(err));
              }
            }}
            onClose={() => setCreateEquipmentOpen(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
