import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useRowsThatFit } from "@/hooks/use-rows-that-fit";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { CATALOG_KIND_LABELS, type CatalogKind } from "@/lib/catalogs";
import { getErrorMessage } from "@/lib/workshop";
import {
  filterCatalogItems,
  getAvailableMergeTargets,
  validateCatalogItemName,
} from "../helpers";
import type { EditingCatalogItem, MergingCatalogItem } from "../types";

export function useCatalogsState() {
  const [selectedKind, setSelectedKind] = useState<CatalogKind>("brand");
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<EditingCatalogItem | null>(
    null,
  );
  const [mergingItem, setMergingItem] = useState<MergingCatalogItem | null>(
    null,
  );
  const [targetMergeId, setTargetMergeId] = useState<string>("");
  const [newItemName, setNewItemName] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [deletingId, setDeletingId] = useState<Id<"catalogs"> | null>(null);

  const rawItemsQuery = useQuery(api.catalogs.list, { kind: selectedKind });
  // El filtrado y los destinos de fusión se recalculan con esta lista: si el
  // respaldo fuera un `[]` nuevo en cada render, se reharían siempre.
  const rawItems = useMemo(() => rawItemsQuery ?? [], [rawItemsQuery]);
  const ensureItem = useMutation(api.catalogs.ensureItem);
  const updateItem = useMutation(api.catalogs.update);
  const removeItem = useMutation(api.catalogs.remove);
  const mergeDuplicates = useMutation(api.catalogs.mergeDuplicates);
  const migrateLegacy = useMutation(api.catalogs.migrateLegacyLocations);

  useEffect(() => {
    void migrateLegacy().catch(() => {});
  }, [migrateLegacy]);

  const meta = CATALOG_KIND_LABELS[selectedKind];

  const filteredItems = useMemo(() => {
    return filterCatalogItems(rawItems, search);
  }, [rawItems, search]);

  const { areaRef, rowsFit } = useRowsThatFit();
  const paging = useTablePagination({
    total: filteredItems.length,
    rowsFit,
    resetKey: `${selectedKind}|${search}`,
  });
  const visibleItems = filteredItems.slice(paging.from - 1, paging.to);

  const availableMergeTargets = useMemo(() => {
    if (!mergingItem) return [];
    return getAvailableMergeTargets(rawItems, mergingItem.id);
  }, [rawItems, mergingItem]);

  const handleSelectKind = (kind: CatalogKind) => {
    setSelectedKind(kind);
    setSearch("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateCatalogItemName(newItemName);
    if (!validation.valid) return;
    try {
      await ensureItem({ kind: selectedKind, name: validation.cleaned });
      toast.success(`${meta.singular} añadida al catálogo`);
      setNewItemName("");
      setIsAddingNew(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleUpdate = async () => {
    if (!editingItem) return;
    const validation = validateCatalogItemName(editingItem.name);
    if (!validation.valid) return;
    try {
      await updateItem({ id: editingItem.id, name: validation.cleaned });
      toast.success(`${meta.singular} actualizada`);
      setEditingItem(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async (id: Id<"catalogs">) => {
    try {
      await removeItem({ id });
      toast.success(`${meta.singular} eliminada del catálogo`);
      setDeletingId(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleMerge = async () => {
    if (!mergingItem || !targetMergeId) return;
    try {
      await mergeDuplicates({
        sourceId: mergingItem.id,
        targetId: targetMergeId as Id<"catalogs">,
      });
      toast.success("Elementos fusionados correctamente");
      setMergingItem(null);
      setTargetMergeId("");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return {
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
  };
}
