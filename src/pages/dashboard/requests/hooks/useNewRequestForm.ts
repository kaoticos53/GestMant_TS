import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import { richDocIsEmpty, richDocToStore } from "@/lib/richDoc";
import {
  equipmentLabel,
  getErrorMessage,
  type Priority,
} from "@/lib/workshop";
import type { EquipmentDoc } from "../types";
import type { PendingRequestFile } from "./useRequestAttachments";
import type { RequestLineItem } from "./useRequestPartsSelection";

export interface ValidateNewRequestParams {
  requesterName: string;
  hasLines: boolean;
  isDescriptionEmpty: boolean;
  hasAttachments: boolean;
  isUploading: boolean;
  failedFileName?: string;
  equipmentChoice: string;
  equipmentText: string;
}

/**
 * Función pura para validar las invariantes requeridas al dar de alta una petición.
 */
export function validateNewRequest(params: ValidateNewRequestParams): string | null {
  if (!params.requesterName.trim()) {
    return "Indica quién solicita el repuesto.";
  }
  if (!params.hasLines && params.isDescriptionEmpty && !params.hasAttachments) {
    return "Añade un repuesto del catálogo o describe lo que necesitas (con fotos o documentos si los tienes).";
  }
  if (params.isUploading) {
    return "Espera a que se suban los archivos adjuntos.";
  }
  if (params.failedFileName) {
    return `No se ha podido subir «${params.failedFileName}». Quítalo o inténtalo de nuevo.`;
  }
  if (params.equipmentChoice === "manual" && !params.equipmentText) {
    return "Escribe el equipo afectado o elige uno del inventario.";
  }
  return null;
}

/**
 * Resuelve la etiqueta textual del equipo, ya sea de inventario o introducido a mano.
 */
export function resolveEquipmentText(
  selectedEquipment: EquipmentDoc | undefined,
  equipmentChoice: string,
  equipmentManual: string,
): string {
  if (selectedEquipment) return equipmentLabel(selectedEquipment);
  if (equipmentChoice === "manual") return equipmentManual.trim();
  return "";
}

/**
 * Transforma los ficheros con storageId confirmado en el formato de adjunto persistible.
 */
export function buildAttachmentsPayload(files: PendingRequestFile[]) {
  return files
    .filter((file): file is PendingRequestFile & { storageId: Id<"_storage"> } =>
      Boolean(file.storageId),
    )
    .map((file) => ({
      storageId: file.storageId,
      name: file.file.name,
      kind: file.file.type.startsWith("image/")
        ? ("image" as const)
        : ("document" as const),
    }));
}

export interface UseNewRequestFormOptions {
  user: { name?: string; position?: string } | null | undefined;
  selectedEquipment: EquipmentDoc | undefined;
  lines: RequestLineItem[];
  files: PendingRequestFile[];
  isUploading: boolean;
  clearFiles: () => void;
  clearLines: () => void;
  onClose: () => void;
  createMutation: (args: {
    requesterName: string;
    requesterTeam?: string;
    equipment?: string;
    equipmentId?: Id<"equipment">;
    priority: Priority;
    description?: string;
    attachments?: Array<{
      storageId: Id<"_storage">;
      name: string;
      kind: "image" | "document";
    }>;
    notes?: string;
    lines: Array<{ sparePartId: Id<"spareParts">; quantity: number }>;
  }) => Promise<string>;
  ensureCatalogItemMutation?: (args: {
    kind: "position";
    name: string;
  }) => Promise<unknown>;
}

export function useNewRequestForm({
  user,
  selectedEquipment,
  lines,
  files,
  isUploading,
  clearFiles,
  clearLines,
  onClose,
  createMutation,
  ensureCatalogItemMutation,
}: UseNewRequestFormOptions) {
  const [requesterName, setRequesterName] = useState<string | null>(null);
  const [requesterTeam, setRequesterTeam] = useState<string | null>(null);
  const [equipmentChoice, setEquipmentChoice] = useState("");
  const [equipmentManual, setEquipmentManual] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requesterNameValue = requesterName ?? user?.name ?? "";
  const requesterTeamValue = requesterTeam ?? user?.position ?? "";

  const reset = useCallback(() => {
    setRequesterName("");
    setRequesterTeam("");
    setEquipmentChoice("");
    setEquipmentManual("");
    setPriority("normal");
    setDescription("");
    setNotes("");
    clearLines();
    clearFiles();
    setError(null);
  }, [clearLines, clearFiles]);

  const handleSubmit = useCallback(async () => {
    setError(null);

    const hasAttachments = files.some((file) => file.storageId);
    const failed = files.find((file) => file.error);
    const equipmentText = resolveEquipmentText(
      selectedEquipment,
      equipmentChoice,
      equipmentManual,
    );

    const validationError = validateNewRequest({
      requesterName: requesterNameValue,
      hasLines: lines.length > 0,
      isDescriptionEmpty: richDocIsEmpty(description),
      hasAttachments,
      isUploading,
      failedFileName: failed?.file.name,
      equipmentChoice,
      equipmentText,
    });

    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    try {
      const descriptionToSend = richDocToStore(description);
      const notesToSend = richDocToStore(notes);
      const attachments = buildAttachmentsPayload(files);

      const reference = await createMutation({
        requesterName: requesterNameValue.trim(),
        ...(requesterTeamValue.trim()
          ? { requesterTeam: requesterTeamValue.trim() }
          : {}),
        ...(equipmentText ? { equipment: equipmentText } : {}),
        ...(selectedEquipment ? { equipmentId: selectedEquipment._id } : {}),
        priority,
        ...(descriptionToSend ? { description: descriptionToSend } : {}),
        ...(attachments.length > 0 ? { attachments } : {}),
        ...(notesToSend ? { notes: notesToSend } : {}),
        lines,
      });

      toast.success(`Petición ${reference} creada`);

      // Registro transparente en catálogo maestro de puestos
      if (requesterTeamValue.trim() && ensureCatalogItemMutation) {
        void ensureCatalogItemMutation({
          kind: "position",
          name: requesterTeamValue.trim(),
        }).catch(() => {});
      }

      reset();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [
    files,
    selectedEquipment,
    equipmentChoice,
    equipmentManual,
    requesterNameValue,
    lines,
    description,
    isUploading,
    notes,
    priority,
    createMutation,
    requesterTeamValue,
    ensureCatalogItemMutation,
    reset,
    onClose,
  ]);

  return {
    requesterName,
    setRequesterName,
    requesterTeam,
    setRequesterTeam,
    requesterNameValue,
    requesterTeamValue,
    equipmentChoice,
    setEquipmentChoice,
    equipmentManual,
    setEquipmentManual,
    priority,
    setPriority,
    description,
    setDescription,
    notes,
    setNotes,
    busy,
    error,
    setError,
    reset,
    handleSubmit,
  };
}
