import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { richDocToStore } from "@/lib/richDoc";
import { PART_CATEGORIES, getErrorMessage } from "@/lib/workshop";
import type {
  AssociateMode,
  EquipmentDoc,
  NewPartFormData,
  PartDoc,
  RequestDoc,
} from "../types";
import {
  getCompatibleParts,
  parseNumericInput,
  resolveRequestModelId,
  validateNewPartPayload,
} from "../helpers";

export function useAssociateState({
  request,
  parts,
  equipment,
  onClose,
}: {
  request: RequestDoc;
  parts: PartDoc[];
  equipment: EquipmentDoc[];
  onClose: () => void;
}) {
  const associateExisting = useMutation(api.partRequests.associateExisting);
  const associateNew = useMutation(api.partRequests.associateNew);
  const ensureCatalogItem = useMutation(api.catalogs.ensureItem);

  const catalogSuppliers = useQuery(api.catalogs.list, { kind: "supplier" }) ?? [];
  const catalogLocations = useQuery(api.catalogs.list, { kind: "partLocation" }) ?? [];
  const catalogCategories = useQuery(api.catalogs.list, { kind: "partCategory" }) ?? [];
  const catalogModels = useQuery(api.equipmentModels.list) ?? [];

  const [mode, setMode] = useState<AssociateMode>(
    parts.length > 0 ? "existing" : "new",
  );
  const [selectedId, setSelectedId] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onlyCompatible, setOnlyCompatible] = useState(true);

  // Formulario para investigación y alta de nuevo repuesto
  const [form, setForm] = useState<NewPartFormData>({
    code: "",
    name: "",
    category: PART_CATEGORIES[0] as string,
    unit: "ud",
    stockText: "1",
    minStockText: "0",
    location: "",
    supplier: "",
    partNumber: "",
    priceText: "",
    purchaseUrl: "",
    description: "",
  });

  const handleChangeField = <K extends keyof NewPartFormData>(
    field: K,
    value: NewPartFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Resolución de modelo y compatibilidad con el equipo de la petición
  const requestEquipment = equipment.find(
    (item) => item._id === request.equipmentId,
  );
  const requestModelId = resolveRequestModelId(requestEquipment, catalogModels);
  const compatibleParts = getCompatibleParts(parts, requestModelId);
  const showOnly =
    Boolean(requestEquipment) && onlyCompatible && compatibleParts.length > 0;
  const visibleParts = showOnly ? compatibleParts : parts;

  const handleToggleOnlyCompatible = () => {
    setOnlyCompatible((prev) => !prev);
  };

  const handleAssociateExisting = async () => {
    const part = parts.find((candidate) => candidate._id === selectedId);
    if (!part) {
      setError("Selecciona el repuesto del catálogo.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const message = await associateExisting({
        requestId: request._id,
        sparePartId: part._id,
        quantity: Math.max(1, Math.floor(parseNumericInput(quantity, 1))),
      });
      toast.success(message);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleAssociateNew = async () => {
    setError(null);
    const validation = validateNewPartPayload(form);
    if (!validation.valid) {
      setError(validation.error ?? "Datos inválidos.");
      return;
    }

    const { stock, minStock, price } = validation;
    const descriptionToSend = richDocToStore(form.description);
    setBusy(true);

    try {
      const message = await associateNew({
        requestId: request._id,
        quantity: Math.max(1, Math.floor(parseNumericInput(quantity, 1))),
        part: {
          code: form.code.trim(),
          name: form.name.trim(),
          ...(descriptionToSend ? { description: descriptionToSend } : {}),
          category: form.category,
          unit: form.unit.trim() || "ud",
          stock,
          minStock,
          location: form.location.trim(),
          supplier: form.supplier.trim(),
          partNumber: form.partNumber.trim(),
          unitPrice: price,
          purchaseUrl: form.purchaseUrl.trim(),
        },
      });
      toast.success(message);

      // Registro transparente en catálogos
      if (form.supplier.trim()) {
        void ensureCatalogItem({
          kind: "supplier",
          name: form.supplier.trim(),
        }).catch(() => {});
      }
      if (form.location.trim()) {
        void ensureCatalogItem({
          kind: "partLocation",
          name: form.location.trim(),
        }).catch(() => {});
      }
      if (form.category.trim()) {
        void ensureCatalogItem({
          kind: "partCategory",
          name: form.category.trim(),
        }).catch(() => {});
      }

      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return {
    mode,
    setMode,
    selectedId,
    setSelectedId,
    quantity,
    setQuantity,
    busy,
    error,
    form,
    handleChangeField,
    requestEquipment,
    compatiblePartsCount: compatibleParts.length,
    allPartsCount: parts.length,
    showOnlyCompatible: showOnly,
    handleToggleOnlyCompatible,
    visibleParts,
    catalogSuppliers,
    catalogCategories,
    catalogLocations,
    handleAssociateExisting,
    handleAssociateNew,
  };
}
