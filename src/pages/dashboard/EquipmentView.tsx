import { Button } from "@/components/ui/button";
import { DataTableToolbar } from "@/components/DataTableToolbar";
import { TablePagination } from "@/components/TablePagination";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { Plus } from "lucide-react";
import {
  EquipmentEmptyState,
  EquipmentModals,
  EquipmentTable,
} from "./equipment/components";
import { canAddManualNotes, getManualRights } from "./equipment/helpers";
import { useEquipmentDialogs } from "./equipment/hooks/useEquipmentDialogs";
import { useEquipmentListState } from "./equipment/hooks/useEquipmentListState";

export function EquipmentView({
  canManage = false,
  canWriteManuals = false,
  canManageManuals = false,
  currentUserId = null,
  onViewRequests = () => {},
  initialSearch = "",
}: {
  /** Solo responsable de repuestos/admin escriben en el inventario (fail-closed). */
  canManage?: boolean;
  /** Puede escribir notas del taller desde la ficha del equipo. */
  canWriteManuals?: boolean;
  /** Puede subir archivos y gestionar los manuales (responsable/admin). */
  canManageManuals?: boolean;
  /** Quién mira: es lo que permite corregir su propia nota del taller. */
  currentUserId?: string | null;
  /** Lleva a la cola de peticiones filtrada por este equipo. */
  onViewRequests?: (equipmentId: string) => void;
  /** Texto con el que se abre la vista (viene de la búsqueda global). */
  initialSearch?: string;
}) {
  const equipment = useQuery(api.equipment.list, {}) ?? [];
  const parts = useQuery(api.spareParts.list) ?? [];
  const catalogModels = useQuery(api.equipmentModels.list) ?? [];
  const requests =
    useQuery(api.partRequests.list, { includeArchived: true }) ?? [];
  const maintenance = useQuery(api.maintenance.list) ?? [];
  const manuals = useQuery(api.manuals.list) ?? [];

  const {
    search,
    setSearch,
    filtered,
    columns,
    sort,
    setSort,
    areaRef,
    paging,
    visible,
    recordsFor,
    compatibleCount,
    reviewOf,
    manualsOf,
  } = useEquipmentListState({
    equipment,
    parts,
    catalogModels,
    maintenance,
    manuals,
    currentUserId,
    initialSearch,
  });

  const {
    detail,
    openDetail,
    closeDetail,
    formTarget,
    openNewForm,
    openEditForm,
    openDuplicateForm,
    closeForm,
    deleteTarget,
    setDeleteTarget,
    manualForm,
    setManualForm,
    manualDetail,
    setManualDetail,
    manualDelete,
    setManualDelete,
  } = useEquipmentDialogs();

  const canAddManual = canAddManualNotes(canWriteManuals, canManageManuals);
  const rights = getManualRights(canManageManuals, currentUserId);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border/70 bg-card shadow-sm">
        <DataTableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar por marca, modelo o nº de serie..."
          searchAriaLabel="Buscar equipo"
          hasActiveFilters={search.trim() !== ""}
          onResetFilters={() => setSearch("")}
          resetFiltersLabel="Limpiar búsqueda"
          actions={
            canManage ? (
              <Button
                type="button"
                className="gap-2"
                onClick={openNewForm}
              >
                <Plus className="size-4" />
                Nuevo equipo
              </Button>
            ) : null
          }
        />

        {equipment.length === 0 || filtered.length === 0 ? (
          <EquipmentEmptyState
            isEmpty={equipment.length === 0}
            search={search}
            canManage={canManage}
            onNewEquipment={openNewForm}
            onClearSearch={() => setSearch("")}
          />
        ) : (
          <EquipmentTable
            columns={columns}
            sort={sort}
            onSortChange={setSort}
            areaRef={areaRef}
            resetKey={paging.page}
            visible={visible}
            canManage={canManage}
            reviewOf={reviewOf}
            manualsOf={manualsOf}
            compatibleCount={compatibleCount}
            onViewDetail={openDetail}
            onDuplicate={openDuplicateForm}
            onEdit={openEditForm}
            onDelete={setDeleteTarget}
          />
        )}

        {filtered.length > 0 && (
          <TablePagination
            paging={paging}
            singular="equipo"
            plural="equipos"
            detail={
              filtered.length < equipment.length
                ? `${equipment.length} en el inventario`
                : undefined
            }
          />
        )}
      </div>

      <EquipmentModals
        detail={detail}
        parts={parts}
        requests={requests}
        equipment={equipment}
        maintenanceRecordsFor={recordsFor}
        manualsOf={manualsOf}
        canManage={canManage}
        canAddManual={canAddManual}
        canManageManuals={canManageManuals}
        rights={rights}
        formTarget={formTarget}
        deleteTarget={deleteTarget}
        manualForm={manualForm}
        manualDetail={manualDetail}
        manualDelete={manualDelete}
        onCloseDetail={closeDetail}
        onViewRequests={onViewRequests}
        setManualForm={setManualForm}
        setManualDetail={setManualDetail}
        setManualDelete={setManualDelete}
        closeForm={closeForm}
        setDeleteTarget={setDeleteTarget}
      />
    </div>
  );
}
