import { useState } from "react";
import type { ManualDoc } from "../../ManualsView";
import type { EquipmentDoc, EquipmentFormDialogProps } from "../types";

/**
 * Hook para centralizar la máquina de estados de apertura y cierre de diálogos
 * y fichas laterales asociados al módulo de equipos y manuales.
 */
export function useEquipmentDialogs() {
  const [detail, setDetail] = useState<{
    item: EquipmentDoc;
    openedAt: number;
  } | null>(null);

  const [formTarget, setFormTarget] = useState<{
    item: EquipmentDoc | null;
    initialValues?: EquipmentFormDialogProps["initialValues"];
  } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<EquipmentDoc | null>(null);

  const [manualForm, setManualForm] = useState<{
    manual: ManualDoc | null;
    equipmentId: string | null;
  } | null>(null);

  const [manualDetail, setManualDetail] = useState<ManualDoc | null>(null);
  const [manualDelete, setManualDelete] = useState<ManualDoc | null>(null);

  const openDetail = (item: EquipmentDoc) => {
    setDetail({ item, openedAt: Date.now() });
  };

  const closeDetail = () => {
    setDetail(null);
  };

  const openNewForm = () => {
    setFormTarget({ item: null });
  };

  const openEditForm = (item: EquipmentDoc) => {
    setFormTarget({ item });
  };

  const openDuplicateForm = (item: EquipmentDoc) => {
    setFormTarget({
      item: null,
      initialValues: {
        model: item.model,
        brand: item.brand,
        name: item.name,
        supplier: item.supplier,
        maintenanceIntervalDays: item.maintenanceIntervalDays,
        description: item.description,
        modelId: item.modelId,
      },
    });
  };

  const closeForm = () => {
    setFormTarget(null);
  };

  return {
    detail,
    setDetail,
    openDetail,
    closeDetail,
    formTarget,
    setFormTarget,
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
  };
}
