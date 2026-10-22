import { Card, CardContent } from "@/components/ui/card";
import { TablePagination } from "@/components/TablePagination";
import { EquipmentModelDialog } from "./EquipmentModelDialog";
import { EquipmentModelsHeader } from "./equipmentModels/components/EquipmentModelsHeader";
import { EquipmentModelsSearchBar } from "./equipmentModels/components/EquipmentModelsSearchBar";
import { EquipmentModelsEmptyState } from "./equipmentModels/components/EquipmentModelsEmptyState";
import { EquipmentModelsTable } from "./equipmentModels/components/EquipmentModelsTable";
import { DeleteEquipmentModelDialog } from "./equipmentModels/components/DeleteEquipmentModelDialog";
import { useEquipmentModelsState } from "./equipmentModels/hooks/useEquipmentModelsState";

export function EquipmentModelsCard() {
  const {
    models,
    search,
    setSearch,
    dialogOpen,
    setDialogOpen,
    dialogSession,
    editingModel,
    deletingModel,
    setDeletingModel,
    isDeleting,
    usageStats,
    filteredModels,
    areaRef,
    paging,
    visible,
    cannotDeleteReason,
    handleOpenCreate,
    handleOpenEdit,
    handleConfirmDelete,
  } = useEquipmentModelsState();

  return (
    <Card className="border-border/70 shadow-xs">
      <EquipmentModelsHeader onOpenCreate={handleOpenCreate} />

      <CardContent className="space-y-4">
        <EquipmentModelsSearchBar
          search={search}
          onSearchChange={setSearch}
          totalModels={models.length}
        />

        {filteredModels.length === 0 ? (
          <EquipmentModelsEmptyState hasSearch={Boolean(search.trim())} />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/70">
            <EquipmentModelsTable
              visibleModels={visible}
              usageStats={usageStats}
              areaRef={areaRef}
              page={paging.page}
              onOpenEdit={handleOpenEdit}
              onOpenDelete={setDeletingModel}
            />

            <TablePagination
              paging={paging}
              singular="modelo"
              plural="modelos"
              detail={
                search.trim() ? `${models.length} en el catálogo` : undefined
              }
            />
          </div>
        )}
      </CardContent>

      {/* Diálogo de alta / edición */}
      <EquipmentModelDialog
        key={dialogSession}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        model={editingModel}
      />

      {/* Confirmación o bloqueo de eliminación */}
      <DeleteEquipmentModelDialog
        model={deletingModel}
        cannotDeleteReason={cannotDeleteReason}
        isDeleting={isDeleting}
        onClose={() => setDeletingModel(null)}
        onConfirm={handleConfirmDelete}
      />
    </Card>
  );
}
