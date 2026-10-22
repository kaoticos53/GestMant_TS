import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useRowsThatFit } from "@/hooks/use-rows-that-fit";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { sortRows } from "@/lib/tableSort";
import { getErrorMessage } from "@/lib/workshop";
import type { InventoryViewProps, PartDoc } from "../types";
import {
  INVENTORY_SORT_COLUMNS,
  countLowStockParts,
  exportInventoryCsv,
  filterInventoryParts,
} from "../helpers";

export function useInventoryState({
  currentUserId = null,
  initialSearch = "",
  initialLowStockOnly = false,
}: Pick<
  InventoryViewProps,
  "currentUserId" | "initialSearch" | "initialLowStockOnly"
>) {
  const parts = useQuery(api.spareParts.list) ?? [];
  const equipment = useQuery(api.equipment.list, {}) ?? [];
  const catalogModels = useQuery(api.equipmentModels.list) ?? [];
  const adjustStock = useMutation(api.spareParts.adjustStock);
  const removePart = useMutation(api.spareParts.remove);

  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState<string>("all");
  const [equipmentFilter, setEquipmentFilter] = useState<string>("all");
  const [lowStockOnly, setLowStockOnly] = useState(initialLowStockOnly);
  const [formTarget, setFormTarget] = useState<{ part: PartDoc | null } | null>(
    null,
  );
  const [stockTarget, setStockTarget] = useState<PartDoc | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PartDoc | null>(null);

  const lowStockCount = countLowStockParts(parts);

  const filtered = filterInventoryParts({
    parts,
    equipment,
    catalogModels,
    category,
    equipmentFilter,
    lowStockOnly,
    search,
  });

  const [sort, setSort] = useTableSort({
    table: "inventory",
    columns: INVENTORY_SORT_COLUMNS,
    userId: currentUserId,
  });

  const rows = sortRows(
    filtered,
    (part, column) => INVENTORY_SORT_COLUMNS[column].value(part),
    sort,
  );

  const { areaRef, rowsFit } = useRowsThatFit();
  const paging = useTablePagination({
    total: rows.length,
    rowsFit,
    resetKey: `${search}|${category}|${equipmentFilter}|${lowStockOnly}`,
  });
  const visible = rows.slice(paging.from - 1, paging.to);

  const filtering =
    search.trim() !== "" ||
    category !== "all" ||
    equipmentFilter !== "all" ||
    lowStockOnly;

  const handleQuickAdjust = async (part: PartDoc, delta: number) => {
    try {
      await adjustStock({ id: part._id, delta });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleDelete = async (part: PartDoc) => {
    try {
      await removePart({ id: part._id });
      toast.success(`${part.code} borrado del catálogo`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleExport = () => {
    const exportedCount = exportInventoryCsv(rows, catalogModels);
    toast.success(`Catálogo exportado: ${exportedCount} repuestos`);
  };

  const handleResetFilters = () => {
    setSearch("");
    setCategory("all");
    setEquipmentFilter("all");
    setLowStockOnly(false);
  };

  const handleToggleLowStockOnly = () => {
    setLowStockOnly((value) => !value);
  };

  return {
    parts,
    equipment,
    catalogModels,
    search,
    setSearch,
    category,
    setCategory,
    equipmentFilter,
    setEquipmentFilter,
    lowStockOnly,
    handleToggleLowStockOnly,
    lowStockCount,
    filtered,
    filtering,
    columns: INVENTORY_SORT_COLUMNS,
    sort,
    setSort,
    areaRef,
    paging,
    visible,
    formTarget,
    setFormTarget,
    stockTarget,
    setStockTarget,
    deleteTarget,
    setDeleteTarget,
    handleQuickAdjust,
    handleDelete,
    handleExport,
    handleResetFilters,
  };
}
