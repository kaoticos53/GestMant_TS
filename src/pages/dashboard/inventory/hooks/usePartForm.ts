import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PART_CATEGORIES, getErrorMessage } from "@/lib/workshop";
import {
  validatePartForm,
  toPartPayload,
  type PartFormValues,
} from "../domain/partForm";
import type { PartDoc } from "../types";

export interface UsePartFormReturn {
  form: PartFormValues;
  isEdit: boolean;
  busy: boolean;
  error: string | null;
  updateField: <K extends keyof PartFormValues>(
    field: K,
    value: PartFormValues[K],
  ) => void;
  addCompatibleModel: (id: Id<"equipmentModels">) => void;
  removeCompatibleModel: (id: Id<"equipmentModels">) => void;
  save: () => Promise<void>;
}

/**
 * Hook de aplicación que encapsula el estado, validación y mutaciones de persistencia
 * para el alta y edición de repuestos.
 */
export function usePartForm(
  part: PartDoc | null,
  onClose: () => void,
): UsePartFormReturn {
  const create = useMutation(api.spareParts.create);
  const update = useMutation(api.spareParts.update);
  const ensureCatalogItem = useMutation(api.catalogs.ensureItem);

  const isEdit = part !== null;

  const [form, setForm] = useState<PartFormValues>(() => ({
    code: part?.code ?? "",
    name: part?.name ?? "",
    description: part?.description ?? "",
    category: part?.category ?? (PART_CATEGORIES[0] as string),
    unit: part?.unit ?? "ud",
    stockText: String(part?.stock ?? 0),
    minStockText: String(part?.minStock ?? 0),
    location: part?.location ?? "",
    supplier: part?.supplier ?? "",
    partNumber: part?.partNumber ?? "",
    priceText: part?.unitPrice ? String(part.unitPrice) : "",
    purchaseUrl: part?.purchaseUrl ?? "",
    compatibleModelIds: part?.compatibleModels ?? [],
  }));

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = useCallback(
    <K extends keyof PartFormValues>(field: K, value: PartFormValues[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const addCompatibleModel = useCallback((id: Id<"equipmentModels">) => {
    setForm((prev) => ({
      ...prev,
      compatibleModelIds: prev.compatibleModelIds.includes(id)
        ? prev.compatibleModelIds
        : [...prev.compatibleModelIds, id],
    }));
  }, []);

  const removeCompatibleModel = useCallback((id: Id<"equipmentModels">) => {
    setForm((prev) => ({
      ...prev,
      compatibleModelIds: prev.compatibleModelIds.filter((item) => item !== id),
    }));
  }, []);

  const save = async () => {
    setError(null);
    const validation = validatePartForm(form);
    if (!validation.isValid) {
      setError(validation.error ?? "Por favor revise los campos del formulario.");
      return;
    }

    setBusy(true);
    try {
      const payload = toPartPayload(form);
      const codeUpper = payload.code.toUpperCase();

      if (isEdit && part) {
        await update({
          id: part._id,
          ...payload,
        });
        toast.success(`${codeUpper} actualizado`);
      } else {
        await create(payload);
        toast.success(`${codeUpper} añadido al catálogo`);
      }

      // Registro resiliente en catálogos auxiliares sin bloquear la UI
      const catalogTasks = [
        form.location.trim()
          ? { kind: "partLocation" as const, name: form.location.trim() }
          : null,
        form.supplier.trim()
          ? { kind: "supplier" as const, name: form.supplier.trim() }
          : null,
        form.category.trim()
          ? { kind: "partCategory" as const, name: form.category.trim() }
          : null,
      ].filter((item): item is NonNullable<typeof item> => item !== null);

      if (catalogTasks.length > 0) {
        await Promise.allSettled(
          catalogTasks.map((task) => ensureCatalogItem(task)),
        );
      }

      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return {
    form,
    isEdit,
    busy,
    error,
    updateField,
    addCompatibleModel,
    removeCompatibleModel,
    save,
  };
}
