import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTableToolbar } from "@/components/DataTableToolbar";
import { ListViewSkeleton } from "@/components/ListViewSkeleton";
import { PrintLabelDialog } from "@/components/PrintLabelDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TablePagination } from "@/components/TablePagination";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { equipmentLabel as buildEquipmentLabel } from "@/lib/labelGenerator";
import {
  EQUIPMENT_OPERATIONAL_META,
  type EquipmentOperationalState,
} from "@/lib/movements";
import { FileDown, Plus } from "lucide-react";
import {
  EquipmentEmptyState,
  EquipmentModals,
  EquipmentTable,
} from "./equipment/components";
import { canAddManualNotes, getManualRights } from "./equipment/helpers";
import { useEquipmentDialogs } from "./equipment/hooks/useEquipmentDialogs";
import {
  exportEquipmentCsv,
  useEquipmentListState,
  type EquipmentOperationalFilter,
  type EquipmentReviewFilter,
} from "./equipment/hooks/useEquipmentListState";

export function EquipmentView({
  canManage = false,
  canWriteManuals = false,
  canManageManuals = false,
  currentUserId = null,
  onViewRequests = () => {},
  onOpenIncident,
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
  /** Navega a una incidencia desde la ficha del equipo. */
  onOpenIncident?: (incidentId: Id<"incidents">) => void;
  /** Texto con el que se abre la vista (viene de la búsqueda global). */
  initialSearch?: string;
}) {
  const [labelTarget, setLabelTarget] = useState<
    Parameters<typeof buildEquipmentLabel>[0] | null
  >(null);
  const origin =
    typeof window === "undefined" ? "" : window.location.origin;

  const rawEquipment = useQuery(api.equipment.list, {});
  const equipment = rawEquipment ?? [];
  const parts = useQuery(api.spareParts.list) ?? [];
  const catalogModels = useQuery(api.equipmentModels.list) ?? [];
  const requests =
    useQuery(api.partRequests.list, { includeArchived: true }) ?? [];
  const maintenance = useQuery(api.maintenance.list) ?? [];
  const manuals = useQuery(api.manuals.list, {}) ?? [];

  const {
    search,
    setSearch,
    operationalFilter,
    setOperationalFilter,
    hideDecommissioned,
    setHideDecommissioned,
    reviewFilter,
    setReviewFilter,
    locationFilter,
    setLocationFilter,
    locations,
    hasActiveFilters,
    clearFilters,
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

  const handleExport = () => {
    const count = exportEquipmentCsv(
      filtered,
      (item) => reviewOf(item).state === "overdue",
    );
    toast.success(`Equipos exportados: ${count}`);
  };

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

  if (rawEquipment === undefined) {
    return <ListViewSkeleton />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border/70 bg-card shadow-sm">
        <DataTableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar por marca, modelo o nº de serie..."
          searchAriaLabel="Buscar equipo"
          hasActiveFilters={hasActiveFilters}
          onResetFilters={clearFilters}
          resetFiltersLabel="Limpiar filtros"
          filters={
            <>
              <Select
                value={operationalFilter}
                onValueChange={(val) =>
                  setOperationalFilter(val as EquipmentOperationalFilter)
                }
              >
                <SelectTrigger
                  aria-label="Filtrar por estado operativo"
                  className="w-full sm:w-44"
                >
                  <SelectValue placeholder="Estado operativo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {(
                    Object.keys(
                      EQUIPMENT_OPERATIONAL_META,
                    ) as EquipmentOperationalState[]
                  ).map((key) => (
                    <SelectItem key={key} value={key}>
                      {EQUIPMENT_OPERATIONAL_META[key].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {locations.length > 0 && (
                <Select
                  value={locationFilter}
                  onValueChange={setLocationFilter}
                >
                  <SelectTrigger
                    aria-label="Filtrar por ubicación"
                    className="w-full sm:w-40"
                  >
                    <SelectValue placeholder="Ubicación" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las ubicaciones</SelectItem>
                    {locations.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button
                type="button"
                variant={reviewFilter === "overdue" ? "default" : "outline"}
                size="sm"
                aria-pressed={reviewFilter === "overdue"}
                onClick={() =>
                  setReviewFilter((prev: EquipmentReviewFilter) =>
                    prev === "overdue" ? "all" : "overdue",
                  )
                }
              >
                Preventivo vencido
              </Button>

              <Button
                type="button"
                variant={hideDecommissioned ? "default" : "outline"}
                size="sm"
                aria-pressed={hideDecommissioned}
                onClick={() => setHideDecommissioned((prev) => !prev)}
              >
                Ocultar bajas
              </Button>
            </>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={handleExport}
                disabled={filtered.length === 0}
              >
                <FileDown className="size-4" />
                Exportar CSV ({filtered.length})
              </Button>
              {canManage && (
                <Button
                  type="button"
                  className="gap-2"
                  onClick={openNewForm}
                >
                  <Plus className="size-4" />
                  Nuevo equipo
                </Button>
              )}
            </div>
          }
        />

        {equipment.length === 0 || filtered.length === 0 ? (
          <EquipmentEmptyState
            isEmpty={equipment.length === 0}
            search={search}
            hasActiveFilters={hasActiveFilters}
            canManage={canManage}
            onNewEquipment={openNewForm}
            onClearSearch={clearFilters}
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
            onPrintLabel={setLabelTarget}
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
        onEdit={(item) => {
          closeDetail();
          openEditForm(item);
        }}
        onPrintLabel={setLabelTarget}
        onOpenIncident={onOpenIncident}
        onViewRequests={onViewRequests}
        setManualForm={setManualForm}
        setManualDetail={setManualDetail}
        setManualDelete={setManualDelete}
        closeForm={closeForm}
        setDeleteTarget={setDeleteTarget}
      />

      <PrintLabelDialog
        label={
          labelTarget === null
            ? null
            : buildEquipmentLabel(labelTarget, origin)
        }
        onClose={() => setLabelTarget(null)}
      />
    </div>
  );
}
