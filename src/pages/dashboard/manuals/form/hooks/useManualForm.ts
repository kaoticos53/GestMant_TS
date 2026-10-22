import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  DEFAULT_MANUAL_TYPE,
  manualClassification,
  manualTitleFromFile,
  type ManualKind,
} from "@/lib/manuals";
import { uploadToStorage } from "@/lib/upload";
import { getErrorMessage } from "@/lib/workshop";
import { useAction, useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getUniqueModels,
  suggestBrandForModel,
  validateManualFile,
  validateManualSubmission,
} from "../helpers";
import type { ManualFormDialogProps } from "../types";

export function useManualForm({
  manual,
  equipment,
  canManage,
  fixedEquipmentId = null,
  onClose,
}: ManualFormDialogProps) {
  const create = useMutation(api.manuals.create);
  const update = useMutation(api.manuals.update);
  const generateUploadUrl = useMutation(api.manuals.generateUploadUrl);
  const verifyManualPdf = useAction(api.manuals.verifyManualPdf);
  const ensureModel = useMutation(api.equipmentModels.ensureModel);
  const catalogModels = useQuery(api.equipmentModels.list) ?? [];

  const isEdit = manual !== null;
  const initialKind: ManualKind = manual?.kind ?? (canManage ? "file" : "note");
  const [kind, setKind] = useState<ManualKind>(initialKind);
  const [title, setTitle] = useState(manual?.title ?? "");
  const [type, setType] = useState<string>(manual?.type ?? DEFAULT_MANUAL_TYPE);
  const [brand, setBrand] = useState(manual?.brand ?? "");
  const [model, setModel] = useState(manual?.model ?? "");
  const [equipmentId, setEquipmentId] = useState<string>(
    manual?.equipmentId ?? fixedEquipmentId ?? "none",
  );
  const [notes, setNotes] = useState(manual?.notes ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFile = kind === "file";

  const uniqueModels = useMemo(() => {
    return getUniqueModels(catalogModels, equipment);
  }, [catalogModels, equipment]);

  const handleModelChange = (value: string) => {
    setModel(value);
    if (!brand.trim()) {
      const suggested = suggestBrandForModel(value, catalogModels);
      if (suggested) {
        setBrand(suggested);
      }
    }
  };

  const classification = manualClassification(equipment, {
    equipmentId,
    brand,
    model,
  });
  const linked = classification.linked;
  const linkedId = linked?._id ?? null;

  const handleEquipmentChange = (value: string) => {
    setEquipmentId(value);
    const item = equipment.find((option) => option._id === value);
    if (!item) return;
    if (!brand.trim()) setBrand(item.brand ?? "");
    if (!model.trim()) setModel(item.model);
  };

  const handleFileChange = async (chosen: File | null) => {
    setError(null);
    if (!chosen) {
      setFile(null);
      return;
    }
    const validation = await validateManualFile(chosen);
    if (!validation.valid) {
      if (validation.error) setError(validation.error);
      setFile(null);
      return;
    }
    setFile(chosen);
    if (!title.trim()) {
      setTitle(manualTitleFromFile(chosen.name));
    }
  };

  const handleClearFile = () => {
    setFile(null);
  };

  const handleSubmit = async () => {
    setError(null);
    const validationError = validateManualSubmission({
      title,
      isFile,
      isEdit,
      file,
      notes,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    try {
      let uploaded: Id<"_storage"> | null = null;
      if (isFile && file) {
        const uploadUrl = await generateUploadUrl();
        uploaded = await uploadToStorage(uploadUrl, file);
        await verifyManualPdf({ storageId: uploaded });
      }

      let resolvedModelId: Id<"equipmentModels"> | undefined = undefined;
      if (classification.model?.trim()) {
        try {
          resolvedModelId = await ensureModel({
            model: classification.model.trim(),
            brand: classification.brand?.trim() || undefined,
          });
        } catch {
          // Si el usuario no tiene permisos de manager de equipos, el backend asociará el modelId si ya existía.
        }
      }

      if (isEdit && manual) {
        await update({
          id: manual._id,
          title: title.trim(),
          type,
          brand: classification.brand,
          model: classification.model,
          modelId: resolvedModelId,
          equipmentId: linkedId,
          ...(uploaded
            ? { storageId: uploaded, fileName: file?.name ?? "" }
            : {}),
          notes,
        });
        toast.success(`«${title.trim()}» actualizado`);
      } else if (isFile) {
        if (!uploaded) {
          setError("Elige el archivo del manual.");
          return;
        }
        await create({
          title: title.trim(),
          kind: "file",
          type,
          brand: classification.brand,
          model: classification.model,
          modelId: resolvedModelId,
          ...(linkedId ? { equipmentId: linkedId } : {}),
          storageId: uploaded,
          fileName: file?.name ?? "",
          notes,
        });
        toast.success(`«${title.trim()}» añadido a los manuales`);
      } else {
        await create({
          title: title.trim(),
          kind: "note",
          type,
          brand: classification.brand,
          model: classification.model,
          modelId: resolvedModelId,
          ...(linkedId ? { equipmentId: linkedId } : {}),
          notes,
        });
        toast.success(`Nota «${title.trim()}» añadida a los manuales`);
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
    kind,
    setKind,
    title,
    setTitle,
    type,
    setType,
    brand,
    setBrand,
    model,
    handleModelChange,
    equipmentId,
    handleEquipmentChange,
    classification,
    linked,
    uniqueModels,
    isFile,
    file,
    handleFileChange,
    handleClearFile,
    notes,
    setNotes,
    busy,
    error,
    handleSubmit,
  };
}
