import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BookOpen, Plus } from "lucide-react";
import { CatalogsKindSelector } from "./catalogs/components/CatalogsKindSelector";
import { CatalogsSearchBar } from "./catalogs/components/CatalogsSearchBar";
import { CatalogsTable } from "./catalogs/components/CatalogsTable";
import { AddCatalogItemDialog } from "./catalogs/dialogs/AddCatalogItemDialog";
import { DeleteCatalogItemDialog } from "./catalogs/dialogs/DeleteCatalogItemDialog";
import { EditCatalogItemDialog } from "./catalogs/dialogs/EditCatalogItemDialog";
import { MergeCatalogItemDialog } from "./catalogs/dialogs/MergeCatalogItemDialog";
import { useCatalogsState } from "./catalogs/hooks/useCatalogsState";

export function CatalogsCard() {
  const {
    selectedKind,
    handleSelectKind,
    search,
    setSearch,
    meta,
    rawItems,
    filteredItems,
    visibleItems,
    areaRef,
    paging,
    newItemName,
    setNewItemName,
    isAddingNew,
    setIsAddingNew,
    handleCreate,
    editingItem,
    setEditingItem,
    handleUpdate,
    mergingItem,
    setMergingItem,
    targetMergeId,
    setTargetMergeId,
    availableMergeTargets,
    handleMerge,
    deletingId,
    setDeletingId,
    handleDelete,
  } = useCatalogsState();

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-signal/10 text-signal">
              <BookOpen className="size-5" />
            </span>
            <div>
              <CardTitle className="text-base sm:text-lg">
                Catálogos Maestros y Autocompletado
              </CardTitle>
              <CardDescription>
                Valores normalizados para autocompletar marcas, ubicaciones,
                proveedores, puestos y categorías, evitando erratas y duplicados.
              </CardDescription>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setIsAddingNew(true)}
            className="gap-1.5"
          >
            <Plus className="size-4" />
            <span>Añadir {meta.singular.toLowerCase()}</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <CatalogsKindSelector
          selectedKind={selectedKind}
          onSelectKind={handleSelectKind}
        />

        <CatalogsSearchBar
          search={search}
          catalogLabel={meta.label}
          totalCount={rawItems.length}
          onSearchChange={setSearch}
        />

        <CatalogsTable
          meta={meta}
          filteredItems={filteredItems}
          visibleItems={visibleItems}
          totalRawCount={rawItems.length}
          search={search}
          selectedKind={selectedKind}
          paging={paging}
          areaRef={areaRef}
          onEditItem={setEditingItem}
          onMergeItem={setMergingItem}
          onDeleteItem={setDeletingId}
        />
      </CardContent>

      {isAddingNew && (
        <AddCatalogItemDialog
          singularLabel={meta.singular}
          placeholder={meta.placeholder}
          name={newItemName}
          onChangeName={setNewItemName}
          onSubmit={handleCreate}
          onClose={() => setIsAddingNew(false)}
        />
      )}

      {editingItem && (
        <EditCatalogItemDialog
          item={editingItem}
          singularLabel={meta.singular}
          onChangeName={(name) => setEditingItem({ ...editingItem, name })}
          onSave={handleUpdate}
          onClose={() => setEditingItem(null)}
        />
      )}

      {mergingItem && (
        <MergeCatalogItemDialog
          item={mergingItem}
          targetMergeId={targetMergeId}
          availableTargets={availableMergeTargets}
          onChangeTargetId={setTargetMergeId}
          onMerge={handleMerge}
          onClose={() => setMergingItem(null)}
        />
      )}

      {deletingId && (
        <DeleteCatalogItemDialog
          onConfirm={() => handleDelete(deletingId)}
          onClose={() => setDeletingId(null)}
        />
      )}
    </Card>
  );
}
