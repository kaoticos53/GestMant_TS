import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useRowsThatFit } from "@/hooks/use-rows-that-fit";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { getErrorMessage } from "@/lib/workshop";
import type { EquipmentModelDoc } from "../types";
import {
  computeModelUsageStats,
  filterEquipmentModels,
  getCannotDeleteReason,
} from "../helpers";

export function useEquipmentModelsState() {
  // Los respaldos, estables: las cuentas de uso de cada modelo dependen de las
  // cuatro listas y no pueden rehacerse por un array vacío nuevo.
  const modelsQuery = useQuery(api.equipmentModels.list);
  const models = useMemo(() => modelsQuery ?? [], [modelsQuery]);
  const equipmentQuery = useQuery(api.equipment.list);
  const equipment = useMemo(() => equipmentQuery ?? [], [equipmentQuery]);
  const partsQuery = useQuery(api.spareParts.list);
  const parts = useMemo(() => partsQuery ?? [], [partsQuery]);
  const manualsQuery = useQuery(api.manuals.list);
  const manuals = useMemo(() => manualsQuery ?? [], [manualsQuery]);

  const removeModel = useMutation(api.equipmentModels.remove);

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogSession, setDialogSession] = useState(0);
  const [editingModel, setEditingModel] = useState<EquipmentModelDoc | null>(
    null,
  );
  const [deletingModel, setDeletingModel] = useState<EquipmentModelDoc | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  // Mapeos de conteo de uso por modelo
  const usageStats = useMemo(
    () => computeModelUsageStats(equipment, parts, manuals),
    [equipment, parts, manuals],
  );

  const filteredModels = useMemo(
    () => filterEquipmentModels(models, search),
    [models, search],
  );

  const { areaRef, rowsFit } = useRowsThatFit();
  const paging = useTablePagination({
    total: filteredModels.length,
    rowsFit,
    resetKey: search,
  });
  const visible = filteredModels.slice(paging.from - 1, paging.to);

  const handleOpenCreate = () => {
    setEditingModel(null);
    setDialogSession((session) => session + 1);
    setDialogOpen(true);
  };

  const handleOpenEdit = (m: EquipmentModelDoc) => {
    setEditingModel(m);
    setDialogSession((session) => session + 1);
    setDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingModel) return;
    setIsDeleting(true);
    try {
      await removeModel({ id: deletingModel._id });
      toast.success(`Modelo «${deletingModel.model}» eliminado del catálogo`);
      setDeletingModel(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const cannotDeleteReason = getCannotDeleteReason(
    deletingModel?._id,
    usageStats,
  );

  return {
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
  };
}
