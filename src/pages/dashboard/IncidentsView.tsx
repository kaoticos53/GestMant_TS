import { useState } from "react";
import { useQuery } from "convex/react";
import { ListViewSkeleton } from "@/components/ListViewSkeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { IncidentAiAssistantDialog } from "./incidents/components/IncidentAiAssistantDialog";
import { IncidentReportsDialog } from "./IncidentReportsDialog";
import { QueueToolbar } from "./QueueToolbar";
import { SORT_OPTIONS } from "./incidents/types";
import { useIncidentsViewState } from "./incidents/hooks/useIncidentsViewState";
import { IncidentsHeaderBar } from "./incidents/components/IncidentsHeaderBar";
import { IncidentsEmptyState } from "./incidents/components/IncidentsEmptyState";
import { IncidentsList } from "./incidents/components/IncidentsList";
import { IncidentDetailSheet } from "./incidents/components/IncidentDetailSheet";

export function IncidentsView({
  currentUserId,
  currentUserName = "Técnico",
  canAssign = false,
  initialDetailId = null,
  initialFilter = "all",
  initialSearch = "",
  initialMineOnly = false,
  initialPriority = "all",
  canOpenRequests = false,
  canViewManuals = false,
  onOpenRequest,
  onOpenManual,
}: {
  /** Identidad actual (para autoasignación y permisos de atención). */
  currentUserId?: Id<"users"> | null;
  currentUserName?: string;
  /** Coordinador (responsable/admin): asigna a otros técnicos. */
  canAssign?: boolean;
  /** Incidencia abierta al montar (la elige el aviso del panel). */
  initialDetailId?: Id<"incidents"> | null;
  /** Filtro inicial de estado (p. ej. al pulsar una barra en Analítica). */
  initialFilter?: import("@/lib/workshop").IncidentStatus | "all";
  /** Búsqueda inicial (p. ej. al pulsar un modelo en Analítica). */
  initialSearch?: string;
  /** Mostrar solo incidencias asignadas al usuario actual al abrir. */
  initialMineOnly?: boolean;
  /** Prioridad inicial del filtro. */
  initialPriority?: import("@/lib/workshop").IncidentPriority | "all";
  /** Puede ver el módulo de peticiones, así que puede saltar a una. */
  canOpenRequests?: boolean;
  /** Puede consultar manuales técnicos del modelo en la ficha. */
  canViewManuals?: boolean;
  /** Abrir una petición concreta en su módulo. */
  onOpenRequest?: (id: Id<"partRequests">) => void;
  /** Abrir un manual concreto en su módulo. */
  onOpenManual?: (id: Id<"manuals">) => void;
}) {
  const state = useIncidentsViewState({
    currentUserId,
    initialDetailId,
    initialFilter,
    initialSearch,
    initialMineOnly,
    initialPriority,
  });
  const aiAvailability = useQuery(api.ai.availability, {});
  const [aiOpen, setAiOpen] = useState(false);

  const handleOpenCitedIncident = (reference: string) => {
    const match = state.incidents.find((inc) => inc.reference === reference);
    if (!match) return;
    setAiOpen(false);
    state.setDetailId(match._id);
  };

  if (state.loading) {
    return <ListViewSkeleton />;
  }

  return (
    <div className="flex flex-col gap-5">
      <IncidentsHeaderBar
        filter={state.filter}
        onFilterChange={state.setFilter}
        counts={state.counts}
        canFilterMine={Boolean(currentUserId)}
        mineOnly={state.mineOnly}
        onMineOnlyChange={state.setMineOnly}
        mineCount={state.mineCount}
        priority={state.priority}
        onPriorityChange={state.setPriority}
        onOpenReports={() => state.setReportsOpen(true)}
        onOpenAiAssistant={
          aiAvailability?.available ? () => setAiOpen(true) : undefined
        }
      />

      {aiOpen && (
        <IncidentAiAssistantDialog
          open={aiOpen}
          onOpenChange={setAiOpen}
          onOpenIncident={handleOpenCitedIncident}
        />
      )}

      {state.reportsOpen && (
        <IncidentReportsDialog
          open={state.reportsOpen}
          onOpenChange={state.setReportsOpen}
          equipment={state.equipment}
          requests={state.requests}
          canReadTrails={canAssign}
          currentUserName={currentUserName}
        />
      )}

      <QueueToolbar
        search={state.search}
        onSearchChange={state.setSearch}
        placeholder="Buscar por referencia, equipo, nº de serie, descripción, técnico…"
        sort={state.sort}
        onSortChange={state.setSort}
        sortOptions={SORT_OPTIONS}
        compact={state.compact}
        onCompactChange={state.setCompact}
        noun="incidencias"
      />

      {state.ordered.length === 0 ? (
        <IncidentsEmptyState
          search={state.search}
          filter={state.filter}
          hasExtraFilters={state.mineOnly || state.priority !== "all"}
          onClearSearch={() => state.setSearch("")}
          onClearExtraFilters={() => {
            state.setMineOnly(false);
            state.setPriority("all");
          }}
        />
      ) : (
        <IncidentsList
          sections={state.sections}
          compact={state.compact}
          canAssign={canAssign}
          canSelfAssign={Boolean(currentUserId)}
          archivingId={state.archivingId}
          selfAssigningId={state.selfAssigningId}
          selectedIds={state.selectedIds}
          bulkArchiving={state.bulkArchiving}
          areaRef={state.areaRef}
          resetKey={`${state.search}|${state.sort}|${state.filter}|${state.mineOnly}|${state.priority}|${state.paging.page}`}
          paging={state.paging}
          onOpen={(incident) => state.setDetailId(incident._id)}
          onSelfAssign={(incident) => void state.handleSelfAssign(incident)}
          onArchive={(incident) => void state.handleArchive(incident)}
          onToggleSelect={state.toggleSelect}
          onClearSelection={state.clearSelection}
          onBulkArchive={() => void state.handleBulkArchive()}
        />
      )}

      {state.detail && (
        <IncidentDetailSheet
          key={state.detail._id}
          incident={state.detail}
          equipment={state.equipment}
          requests={state.requests}
          currentUserId={currentUserId ?? null}
          currentUserName={currentUserName}
          canAssign={canAssign}
          canOpenRequests={canOpenRequests}
          canViewManuals={canViewManuals}
          onOpenRequest={onOpenRequest}
          onOpenManual={onOpenManual}
          onOpenIncident={(id) => state.setDetailId(id)}
          onClose={() => state.setDetailId(null)}
        />
      )}
    </div>
  );
}
