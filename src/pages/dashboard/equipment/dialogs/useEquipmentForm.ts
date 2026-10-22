import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { getErrorMessage } from "@/lib/workshop";
import { dateToInput } from "../helpers";
import type { EquipmentFormDialogProps } from "../types";
import {
  buildEquipmentPayload,
  findModelTemplate,
  firstFilled,
  getUniqueModelSuggestions,
  validateEquipmentForm,
  type MatchedTemplate,
} from "./equipmentFormLogic";

export function useEquipmentForm({
  item,
  initialValues,
  onSuccess,
  onClose,
}: EquipmentFormDialogProps) {
  const create = useMutation(api.equipment.create);
  const update = useMutation(api.equipment.update);
  const catalogModels = useQuery(api.equipmentModels.list) ?? [];
  const inventoryModels = useQuery(api.equipment.uniqueModels, {}) ?? [];
  const allEquipment = useQuery(api.equipment.list, {}) ?? [];
  const autoCode = useQuery(api.equipment.nextCode);
  const catalogBrands = useQuery(api.catalogs.list, { kind: "brand" }) ?? [];
  const catalogLocations =
    useQuery(api.catalogs.list, { kind: "equipmentLocation" }) ?? [];
  const catalogSuppliers =
    useQuery(api.catalogs.list, { kind: "supplier" }) ?? [];
  const ensureCatalogItem = useMutation(api.catalogs.ensureItem);

  const isEdit = item !== null;
  const initialTemplate = isEdit
    ? null
    : findModelTemplate(
        initialValues?.model ?? "",
        catalogModels,
        allEquipment,
      );

  const [code, setCode] = useState<string | null>(item?.code ?? null);
  const codeValue = isEdit ? (code ?? "") : (code ?? autoCode ?? "");
  const [brand, setBrand] = useState(
    firstFilled(item?.brand, initialValues?.brand, initialTemplate?.brand),
  );
  const [name, setName] = useState(
    firstFilled(item?.name, initialValues?.name, initialTemplate?.name),
  );
  const [model, setModel] = useState(item?.model ?? initialValues?.model ?? "");
  const [location, setLocation] = useState(
    item?.location ?? initialValues?.location ?? "",
  );
  const [description, setDescription] = useState(
    firstFilled(
      item?.description,
      initialValues?.description,
      initialTemplate?.description,
    ),
  );
  const [serialNumber, setSerialNumber] = useState(
    item?.serialNumber ?? initialValues?.serialNumber ?? "",
  );
  const [supplier, setSupplier] = useState(
    firstFilled(
      item?.supplier,
      initialValues?.supplier,
      initialTemplate?.supplier,
    ),
  );
  const [purchaseDate, setPurchaseDate] = useState(
    dateToInput(item?.purchaseDate),
  );
  const [warrantyEndDate, setWarrantyEndDate] = useState(
    dateToInput(item?.warrantyEndDate),
  );
  const [decommissionDate, setDecommissionDate] = useState(
    dateToInput(item?.decommissionDate),
  );
  const [intervalDays, setIntervalDays] = useState(() => {
    const days =
      item?.maintenanceIntervalDays ??
      initialValues?.maintenanceIntervalDays ??
      initialTemplate?.maintenanceIntervalDays;
    return days !== undefined ? String(days) : "";
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allSuggestedModels = useMemo(
    () =>
      getUniqueModelSuggestions(catalogModels, allEquipment, inventoryModels),
    [catalogModels, allEquipment, inventoryModels],
  );

  const matchedTemplate = useMemo(
    () => findModelTemplate(model, catalogModels, allEquipment),
    [model, catalogModels, allEquipment],
  );

  const matchedCatalogModel = useMemo(
    () =>
      catalogModels.find(
        (cm) => cm.model.trim().toLowerCase() === model.trim().toLowerCase(),
      ) ?? null,
    [catalogModels, model],
  );

  const applyModelTemplate = (
    template: MatchedTemplate | null,
    force = false,
  ) => {
    if (!template) return;
    if (template.brand && (force || !brand.trim())) {
      setBrand(template.brand);
    }
    if (template.name && (force || !name.trim())) {
      setName(template.name);
    }
    if (template.supplier && (force || !supplier.trim())) {
      setSupplier(template.supplier);
    }
    if (
      template.maintenanceIntervalDays !== undefined &&
      (force || !intervalDays.trim())
    ) {
      setIntervalDays(String(template.maintenanceIntervalDays));
    }
    if (template.description && (force || !description.trim())) {
      setDescription(template.description);
    }
  };

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    applyModelTemplate(
      findModelTemplate(newModel, catalogModels, allEquipment),
      false,
    );
  };

  const handleSubmit = async () => {
    setError(null);
    const finalCode = (
      (code ?? "").trim() || (!isEdit ? (autoCode ?? "") : "")
    ).trim();

    const validation = validateEquipmentForm(
      {
        finalCode,
        name,
        model,
        purchaseDate,
        warrantyEndDate,
        decommissionDate,
        intervalDays,
      },
      isEdit,
    );

    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setBusy(true);
    try {
      const payload = buildEquipmentPayload(
        {
          finalCode,
          brand,
          name,
          model,
          location,
          description,
          serialNumber,
          supplier,
          modelId: matchedCatalogModel?._id ?? initialValues?.modelId,
        },
        validation,
      );

      if (isEdit && item) {
        await update({ id: item._id, ...payload });
        toast.success(`${payload.model} actualizado`);
      } else {
        const createdId = await create(payload);
        toast.success(`${payload.model} añadido al inventario`);
        if (createdId && onSuccess) {
          onSuccess(createdId);
        }
      }

      // Registro transparente en los catálogos maestros para futuros autocompletados
      if (brand.trim()) {
        void ensureCatalogItem({ kind: "brand", name: brand.trim() }).catch(() => {});
      }
      if (location.trim()) {
        void ensureCatalogItem({ kind: "equipmentLocation", name: location.trim() }).catch(() => {});
      }
      if (supplier.trim()) {
        void ensureCatalogItem({ kind: "supplier", name: supplier.trim() }).catch(() => {});
      }

      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return {
    isEdit,
    busy,
    error,
    codeValue,
    autoCode,
    brand,
    name,
    model,
    location,
    description,
    serialNumber,
    supplier,
    purchaseDate,
    warrantyEndDate,
    decommissionDate,
    intervalDays,
    matchedTemplate,
    allSuggestedModels,
    catalogBrands,
    catalogLocations,
    catalogSuppliers,
    setCode,
    setBrand,
    setName,
    setLocation,
    setDescription,
    setSerialNumber,
    setSupplier,
    setPurchaseDate,
    setWarrantyEndDate,
    setDecommissionDate,
    setIntervalDays,
    handleModelChange,
    applyModelTemplate,
    handleSubmit,
  };
}
