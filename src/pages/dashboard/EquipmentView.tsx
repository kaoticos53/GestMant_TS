import { Button } from "@/components/ui/button";
import { DataTableToolbar } from "@/components/DataTableToolbar";
import { ListArea } from "@/components/ListArea";
import { TablePagination } from "@/components/TablePagination";
import { SortableTableHead, TableSortBar } from "@/components/TableSort";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import type { ManualRights } from "@/lib/manuals";
import { useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { EquipmentDetailSheet } from "./equipment/components/EquipmentDetailSheet";
import { EquipmentEmptyState } from "./equipment/components/EquipmentEmptyState";
import { EquipmentTableRow } from "./equipment/components/EquipmentTableRow";
import { DeleteEquipmentDialog } from "./equipment/dialogs/DeleteEquipmentDialog";
import { EquipmentFormDialog } from "./equipment/dialogs/EquipmentFormDialog";
import { useEquipmentDialogs } from "./equipment/hooks/useEquipmentDialogs";
import { useEquipmentListState } from "./equipment/hooks/useEquipmentListState";
import { ManualDeleteDialog } from "./ManualDeleteDialog";
import { ManualDetailSheet } from "./ManualDetailSheet";
import { ManualFormDialog } from "./ManualFormDialog";

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

  const canAddManual = canWriteManuals || canManageManuals;
  const rights: ManualRights = {
    manage: canManageManuals,
    userId: currentUserId,
  };

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
          <>
            <TableSortBar
              columns={columns}
              sort={sort}
              onSortChange={setSort}
            />
            <ListArea ref={areaRef} resetKey={paging.page}>
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <SortableTableHead
                      column="equipment"
                      label="Equipo"
                      sort={sort}
                      onSortChange={setSort}
                    />
                    <SortableTableHead
                      column="brand"
                      label="Marca"
                      sort={sort}
                      onSortChange={setSort}
                      className="hidden md:table-cell"
                    />
                    <SortableTableHead
                      column="serial"
                      label="Nº de serie"
                      sort={sort}
                      onSortChange={setSort}
                      className="hidden xl:table-cell"
                    />
                    <SortableTableHead
                      column="location"
                      label="Ubicación"
                      sort={sort}
                      onSortChange={setSort}
                      className="hidden lg:table-cell"
                    />
                    <SortableTableHead
                      column="manuals"
                      label="Manuales"
                      sort={sort}
                      onSortChange={setSort}
                      align="right"
                      className="text-right"
                    />
                    <SortableTableHead
                      column="parts"
                      label="Repuestos compatibles"
                      sort={sort}
                      onSortChange={setSort}
                      align="right"
                      className="text-right"
                    />
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((item) => {
                    const review = reviewOf(item);
                    const docs = manualsOf(item);
                    return (
                      <EquipmentTableRow
                        key={item._id}
                        item={item}
                        canManage={canManage}
                        reviewOverdue={review.state === "overdue"}
                        manualsCount={{
                          assigned: docs.assigned.length,
                          byModel: docs.byModel.length,
                          total: docs.assigned.length + docs.byModel.length,
                        }}
                        compatibleCount={compatibleCount(item)}
                        onViewDetail={openDetail}
                        onDuplicate={openDuplicateForm}
                        onEdit={openEditForm}
                        onDelete={setDeleteTarget}
                      />
                    );
                  })}
                </TableBody>
              </Table>
            </ListArea>
          </>
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

      {detail && (
        <EquipmentDetailSheet
          item={detail.item}
          openedAt={detail.openedAt}
          parts={parts}
          requests={requests}
          maintenance={recordsFor(detail.item)}
          manuals={manualsOf(detail.item)}
          canManage={canManage}
          canAddManual={canAddManual}
          rights={rights}
          onAddManual={(item) =>
            setManualForm({ manual: null, equipmentId: item._id })
          }
          onViewManual={setManualDetail}
          onEditManual={(manual) =>
            setManualForm({ manual, equipmentId: null })
          }
          onDeleteManual={setManualDelete}
          onClose={closeDetail}
          onViewRequests={(equipmentId) => {
            closeDetail();
            onViewRequests(equipmentId);
          }}
        >
          {manualDetail && (
            <ManualDetailSheet
              manual={manualDetail}
              equipment={equipment}
              onClose={() => setManualDetail(null)}
            />
          )}

          {manualForm && (
            <ManualFormDialog
              key={manualForm.manual?._id ?? `manual-${manualForm.equipmentId}`}
              manual={manualForm.manual}
              equipment={equipment}
              canManage={canManageManuals}
              fixedEquipmentId={manualForm.equipmentId}
              onClose={() => setManualForm(null)}
            />
          )}

          {manualDelete && (
            <ManualDeleteDialog
              manual={manualDelete}
              onClose={() => setManualDelete(null)}
              onDeleted={() => setManualDetail(null)}
            />
          )}
        </EquipmentDetailSheet>
      )}

      {formTarget && (
        <EquipmentFormDialog
          key={formTarget.item?._id ?? formTarget.initialValues?.model ?? "new"}
          item={formTarget.item}
          initialValues={formTarget.initialValues}
          onClose={closeForm}
        />
      )}

      {deleteTarget && (
        <DeleteEquipmentDialog
          item={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
