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
  canOpenRequests = false,
  onOpenRequest,
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
  /** Puede ver el módulo de peticiones, así que puede saltar a una. */
  canOpenRequests?: boolean;
  /** Abrir una petición concreta en su módulo. */
  onOpenRequest?: (id: Id<"partRequests">) => void;
}) {
  const state = useIncidentsViewState({ initialDetailId, initialFilter });
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
          onClearSearch={() => state.setSearch("")}
        />
      ) : (
        <IncidentsList
          sections={state.sections}
          compact={state.compact}
          canAssign={canAssign}
          archivingId={state.archivingId}
          areaRef={state.areaRef}
          resetKey={`${state.search}|${state.sort}|${state.filter}|${state.paging.page}`}
          paging={state.paging}
          onOpen={(incident) => state.setDetailId(incident._id)}
          onArchive={(incident) => void state.handleArchive(incident)}
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
          onOpenRequest={onOpenRequest}
          onClose={() => state.setDetailId(null)}
        />
      )}
    </div>
  );
}
