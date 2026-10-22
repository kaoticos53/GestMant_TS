import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getErrorMessage } from "@/lib/workshop";
import { toast } from "sonner";
import {
  getInitialModelFormValues,
  validateEquipmentModelForm,
} from "./helpers";
import type { EquipmentModelDoc } from "./types";

interface UseEquipmentModelFormParams {
  model: EquipmentModelDoc | null;
  onOpenChange: (open: boolean) => void;
}

export function useEquipmentModelForm({
  model,
  onOpenChange,
}: UseEquipmentModelFormParams) {
  const isEdit = model !== null;
  const createModel = useMutation(api.equipmentModels.create);
  const updateModel = useMutation(api.equipmentModels.update);

  const catalogBrands = useQuery(api.catalogs.list, { kind: "brand" }) ?? [];
  const catalogSuppliers =
    useQuery(api.catalogs.list, { kind: "supplier" }) ?? [];

  const initialValues = getInitialModelFormValues(model);
  const [modelCode, setModelCode] = useState(initialValues.modelCode);
  const [name, setName] = useState(initialValues.name);
  const [brand, setBrand] = useState(initialValues.brand);
  const [category, setCategory] = useState(initialValues.category);
  const [defaultSupplier, setDefaultSupplier] = useState(
    initialValues.defaultSupplier
  );
  const [maintenanceInterval, setMaintenanceInterval] = useState(
    initialValues.maintenanceInterval
  );
  const [description, setDescription] = useState(initialValues.description);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = validateEquipmentModelForm({
      modelCode,
      name,
      brand,
      category,
      defaultSupplier,
      maintenanceInterval,
      description,
    });

    if (!validation.success) {
      setError(validation.error);
      return;
    }

    setBusy(true);
    try {
      if (isEdit && model) {
        await updateModel({
          id: model._id,
          ...validation.payload,
        });
        toast.success(`Modelo «${validation.payload.model}» actualizado`);
      } else {
        await createModel(validation.payload);
        toast.success(
          `Modelo «${validation.payload.model}» registrado en el catálogo maestro`
        );
      }
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return {
    isEdit,
    modelCode,
    setModelCode,
    name,
    setName,
    brand,
    setBrand,
    category,
    setCategory,
    defaultSupplier,
    setDefaultSupplier,
    maintenanceInterval,
    setMaintenanceInterval,
    description,
    setDescription,
    busy,
    error,
    catalogBrands,
    catalogSuppliers,
    handleSubmit,
  };
}
