import { useState } from "react";
import { useQuery } from "convex/react";
import { BookOpen, Download } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SharedMailSection } from "@/pages/dashboard/shared/SharedMailSection";
import { IncidentLifecycleExtras } from "./IncidentLifecycleExtras";
import { JourneySummary } from "@/components/JourneySummary";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { incidentNeedsDocumentUrls } from "@/lib/incidentFlow";
import { incidentJourney } from "@/lib/incidentJourney";
import {
  MANUAL_KIND_META,
  manualFileName,
  manualsForEquipment,
} from "@/lib/manuals";
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
  canViewManuals?: boolean;
  onOpenRequest?: (id: Id<"partRequests">) => void;
  onOpenManual?: (id: Id<"manuals">) => void;
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
  canViewManuals = false,
  onOpenRequest,
  onOpenManual,
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

  const manualModelRef = linkedEquipment?.model ?? resolvedIncident.model ?? "";
  const shouldLoadManuals =
    canViewManuals &&
    (linkedEquipment !== null || manualModelRef.trim() !== "");
  const allManuals = useQuery(
    api.manuals.list,
    shouldLoadManuals ? {} : "skip",
  );
  const matchingManuals = shouldLoadManuals && allManuals
    ? (() => {
      const grouped = manualsForEquipment(allManuals, {
        _id: linkedEquipment?._id ?? "",
        brand: linkedEquipment?.brand ?? null,
        model: manualModelRef || null,
      });
      return [...grouped.assigned, ...grouped.byModel];
    })()
    : [];

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
          <IncidentHistoryCard
            history={resolvedIncident.history}
            onOpenIncident={onOpenIncident}
          />

          {/* Manuales y notas del modelo */}
          {matchingManuals.length > 0 && (
            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <BookOpen className="size-3.5" />
                Manuales y notas del modelo ({matchingManuals.length})
              </p>
              <ul className="mt-2 divide-y divide-border/60">
                {matchingManuals.map((manual) => {
                  const meta = MANUAL_KIND_META[manual.kind];
                  return (
                    <li
                      key={manual._id}
                      className="flex items-center justify-between gap-2 py-2 first:pt-1 last:pb-0"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className={meta.badgeClassName}>
                            {meta.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {manual.type}
                          </span>
                        </div>
                        {onOpenManual ? (
                          <button
                            type="button"
                            onClick={() => onOpenManual(manual._id)}
                            className="mt-1 block truncate text-left text-sm font-medium text-signal underline-offset-2 hover:underline"
                          >
                            {manual.title}
                          </button>
                        ) : (
                          <p className="mt-1 truncate text-sm font-medium">
                            {manual.title}
                          </p>
                        )}
                      </div>
                      {manual.kind === "file" && manual.url && (
                        <Button asChild variant="ghost" size="icon" className="size-8 shrink-0">
                          <a
                            href={manual.url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Abrir ${manual.title}`}
                            title={manualFileName(manual) ?? "Abrir manual"}
                          >
                            <Download className="size-4" />
                          </a>
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

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

          <IncidentLifecycleExtras
            incident={resolvedIncident}
            canCoordinate={derived.canCoordinate}
            canWork={derived.canWork}
            archived={derived.archived}
            withdrawn={derived.withdrawn}
            onOpenIncident={onOpenIncident}
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
