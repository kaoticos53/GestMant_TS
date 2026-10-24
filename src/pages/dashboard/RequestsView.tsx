import type { Id } from "@/convex/_generated/dataModel";
import { QueueToolbar } from "./QueueToolbar";
import { SORT_OPTIONS, type RequestFilterId } from "./requests/types";
import { useRequestsState } from "./requests/hooks/useRequestsState";
import { RequestsHeaderBar } from "./requests/components/RequestsHeaderBar";
import { RequestsEmptyState } from "./requests/components/RequestsEmptyState";
import { RequestsList } from "./requests/components/RequestsList";
import { RequestsDialogs } from "./requests/components/RequestsDialogs";

export function RequestsView({
  equipmentFilter = "all",
  onEquipmentFilterChange = () => {},
  canManage = false,
  canPurchase = false,
  initialDetailId = null,
  initialFilter = "all",
}: {
  /** Modelo del inventario por el que se filtra la cola ("all" = sin filtro). */
  equipmentFilter?: string;
  onEquipmentFilterChange?: (value: string) => void;
  /** Solo responsable de repuestos/admin deciden peticiones (fail-closed). */
  canManage?: boolean;
  /** Puede generar peticiones de compra cuando el almacén no cubre la petición. */
  canPurchase?: boolean;
  /** Petición abierta al montar (la elige la búsqueda global). */
  initialDetailId?: Id<"partRequests"> | null;
  /** Estado con el que se abre la cola (lo eligen las tarjetas del resumen). */
  initialFilter?: RequestFilterId;
}) {
  const state = useRequestsState({
    equipmentFilter,
    initialDetailId,
    initialFilter,
  });

  return (
    <div className="flex flex-col gap-5">
      <RequestsHeaderBar
        filter={state.filter}
        onFilterChange={state.setFilter}
        counts={state.counts}
        equipmentFilter={equipmentFilter}
        onEquipmentFilterChange={onEquipmentFilterChange}
        equipment={state.equipment}
        filteredCount={state.filtered.length}
        onExport={state.handleExport}
        onNewRequest={() => state.setNewOpen(true)}
      />

      <QueueToolbar
        search={state.search}
        onSearchChange={state.setSearch}
        placeholder="Buscar por referencia, solicitante, repuesto, equipo…"
        sort={state.sort}
        onSortChange={state.setSort}
        sortOptions={SORT_OPTIONS}
        compact={state.compact}
        onCompactChange={state.setCompact}
        noun="peticiones"
      />

      {state.filtered.length === 0 ? (
        <RequestsEmptyState
          search={state.search}
          filter={state.filter}
          emptyByEquipment={state.emptyByEquipment}
          filterEquipment={state.filterEquipment}
          onClearSearch={() => state.setSearch("")}
          onNewRequest={() => state.setNewOpen(true)}
        />
      ) : (
        <RequestsList
          sections={state.sections}
          compact={state.compact}
          archivingId={state.archivingId}
          areaRef={state.areaRef}
          resetKey={`${state.search}|${state.sort}|${state.filter}|${state.paging.page}`}
          paging={state.paging}
          onOpen={(request) => state.setDetailId(request._id)}
          onAssociate={(request) => state.setAssociateTarget(request)}
          onDecision={state.openDecision}
          onArchive={(request) => void state.handleArchive(request)}
        />
      )}

      <RequestsDialogs
        decision={state.decision}
        onCloseDecision={() => state.setDecision(null)}
        associateTarget={state.associateTarget}
        onCloseAssociate={() => state.setAssociateTarget(null)}
        openRequest={state.openRequest}
        onCloseDetail={() => state.setDetailId(null)}
        onOpenAssociate={(request) => state.setAssociateTarget(request)}
        onOpenDecision={state.openDecision}
        onResumeRequest={(request) => void state.handleResume(request)}
        resumingId={state.resumingId}
        newOpen={state.newOpen}
        onCloseNew={() => state.setNewOpen(false)}
        parts={state.parts}
        equipment={state.equipment}
        canManage={canManage}
        canPurchase={canPurchase}
      />
    </div>
  );
}
