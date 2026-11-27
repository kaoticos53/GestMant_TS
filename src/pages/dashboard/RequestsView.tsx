import type { Id } from "@/convex/_generated/dataModel";
import { ListViewSkeleton } from "@/components/ListViewSkeleton";
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
  currentUserId = null,
  canCreate = true,
  canManage = false,
  canPurchase = false,
  canViewPurchasing = canPurchase,
  initialDetailId = null,
  initialFilter = "all",
  initialMineOnly = false,
  onOpenPurchasing,
  onOpenIncident,
}: {
  /** Modelo del inventario por el que se filtra la cola ("all" = sin filtro). */
  equipmentFilter?: string;
  onEquipmentFilterChange?: (value: string) => void;
  /** Identidad actual para el filtro «Mis peticiones». */
  currentUserId?: Id<"users"> | null;
  /** Puede registrar nuevas peticiones de repuesto. */
  canCreate?: boolean;
  /** Solo responsable de repuestos/admin deciden peticiones (fail-closed). */
  canManage?: boolean;
  /** Puede generar peticiones de compra cuando el almacén no cubre la petición. */
  canPurchase?: boolean;
  /** Puede consultar el historial de compras vinculadas a una petición. */
  canViewPurchasing?: boolean;
  /** Petición abierta al montar (la elige la búsqueda global). */
  initialDetailId?: Id<"partRequests"> | null;
  /** Estado con el que se abre la cola (lo eligen las tarjetas del resumen). */
  initialFilter?: RequestFilterId;
  /** Filtrar inicialmente a peticiones creadas por el usuario actual. */
  initialMineOnly?: boolean;
  /** Navega al módulo de Compras (pendientes u orden concreta). */
  onOpenPurchasing?: (
    section: "pending" | "orders",
    orderId?: Id<"purchaseOrders"> | null,
  ) => void;
  /** Navega a la incidencia vinculada a la petición. */
  onOpenIncident?: (id: Id<"incidents">) => void;
}) {
  const state = useRequestsState({
    currentUserId,
    equipmentFilter,
    initialDetailId,
    initialFilter,
    initialMineOnly,
  });

  if (state.loading) {
    return <ListViewSkeleton />;
  }

  return (
    <div className="flex flex-col gap-5">
      <RequestsHeaderBar
        filter={state.filter}
        onFilterChange={state.setFilter}
        counts={state.counts}
        canFilterMine={Boolean(currentUserId)}
        mineOnly={state.mineOnly}
        onMineOnlyChange={state.setMineOnly}
        mineCount={state.mineCount}
        canCreate={canCreate}
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
          mineOnly={state.mineOnly}
          canCreate={canCreate}
          emptyByEquipment={state.emptyByEquipment}
          filterEquipment={state.filterEquipment}
          onClearSearch={() => state.setSearch("")}
          onClearMineOnly={() => state.setMineOnly(false)}
          onNewRequest={() => state.setNewOpen(true)}
        />
      ) : (
        <RequestsList
          sections={state.sections}
          compact={state.compact}
          archivingId={state.archivingId}
          selectedIds={state.selectedIds}
          bulkArchiving={state.bulkArchiving}
          areaRef={state.areaRef}
          resetKey={`${state.search}|${state.sort}|${state.filter}|${state.mineOnly}|${state.paging.page}`}
          paging={state.paging}
          onOpen={(request) => state.setDetailId(request._id)}
          onAssociate={(request) => state.setAssociateTarget(request)}
          onDecision={state.openDecision}
          onArchive={(request) => void state.handleArchive(request)}
          onToggleSelect={state.toggleSelect}
          onClearSelection={state.clearSelection}
          onBulkArchive={() => void state.handleBulkArchive()}
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
        newOpen={canCreate && state.newOpen}
        onCloseNew={() => state.setNewOpen(false)}
        parts={state.parts}
        equipment={state.equipment}
        canManage={canManage}
        canPurchase={canPurchase}
        canViewPurchasing={canViewPurchasing}
        onOpenPurchasing={onOpenPurchasing}
        onOpenIncident={onOpenIncident}
      />
    </div>
  );
}
