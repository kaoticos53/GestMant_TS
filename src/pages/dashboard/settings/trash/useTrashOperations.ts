import { api } from "@/convex/_generated/api";
import type { WithdrawnIncidentItem } from "@/convex/_incidents/trash";
import type { WithdrawnRequestItem } from "@/convex/_partRequests/trash";
import type { TrashItem } from "@/convex/trash";
import { formatFileSize, getErrorMessage } from "@/lib/workshop";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import type { DeletingEntity, TrashFilter } from "./types";

interface UseTrashOperationsOptions {
  canManageIncidents?: boolean;
  canDecideRequests?: boolean;
}

/**
 * Hook para centralizar las queries, mutaciones y operaciones de recuperación y purga
 * definitiva en la papelera del taller.
 */
export function useTrashOperations({
  canManageIncidents = true,
  canDecideRequests = true,
}: UseTrashOperationsOptions = {}) {
  // Papelera de archivos del almacén
  const trash = useQuery(api.trash.list);
  const restoreStorage = useMutation(api.trash.restore);
  const deleteStorageNow = useMutation(api.trash.deleteNow);

  // Papelera de incidencias retiradas
  const incidentTrash = useQuery(
    api.incidents.trash,
    canManageIncidents ? {} : "skip",
  );
  const restoreIncident = useMutation(api.incidents.restore);
  const deleteIncidentNow = useMutation(api.incidents.deleteNow);

  // Papelera de peticiones de repuestos retiradas
  const requestTrash = useQuery(
    api.partRequests.trash,
    canDecideRequests ? {} : "skip",
  );
  const restoreRequest = useMutation(api.partRequests.restore);
  const deleteRequestNow = useMutation(api.partRequests.deleteNow);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [deletingEntity, setDeletingEntity] = useState<DeletingEntity | null>(
    null,
  );
  const [filter, setFilter] = useState<TrashFilter>("all");

  const trashedIncidents = incidentTrash?.items ?? [];
  const trashedRequests = requestTrash?.items ?? [];
  const storagePending = trash?.pending ?? [];
  const storageKept = trash?.kept ?? [];
  const storageTotal = storagePending.length + storageKept.length;

  const totalItems =
    trashedIncidents.length + trashedRequests.length + storageTotal;

  const isLoading =
    trash === undefined ||
    (canManageIncidents && incidentTrash === undefined) ||
    (canDecideRequests && requestTrash === undefined);

  /** Recuperar una incidencia de la papelera. */
  const handleRestoreIncident = async (item: WithdrawnIncidentItem) => {
    setBusyId(item.id);
    try {
      await restoreIncident({ incidentId: item.id });
      toast.success(
        `Incidencia ${item.reference} recuperada de la papelera`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  /** Recuperar una petición de la papelera. */
  const handleRestoreRequest = async (item: WithdrawnRequestItem) => {
    setBusyId(item.id);
    try {
      await restoreRequest({ requestId: item.id });
      toast.success(
        `Petición ${item.reference} recuperada de la papelera`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  /** Recuperar o conservar un archivo del almacén. */
  const handleRestoreStorage = async (item: TrashItem) => {
    setBusyId(item.id);
    try {
      const result = await restoreStorage({ id: item.id });
      toast.success(
        result.kept
          ? "Rescatado: se queda en la papelera y ya no se borra solo"
          : "Recuperada: vuelve al formulario, con la ventana nueva",
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  /** Ejecutar el borrado definitivo de la entidad confirmada. */
  const handleConfirmDelete = async () => {
    if (!deletingEntity) return;
    const target = deletingEntity;
    setBusyId(target.item.id);
    try {
      if (target.type === "incident") {
        await deleteIncidentNow({ incidentId: target.item.id });
        toast.success(
          `Incidencia ${target.item.reference} borrada para siempre`,
        );
      } else if (target.type === "request") {
        await deleteRequestNow({ requestId: target.item.id });
        toast.success(
          `Petición ${target.item.reference} borrada para siempre`,
        );
      } else {
        const result = await deleteStorageNow({ id: target.item.id });
        toast.success(
          `Archivo borrado para siempre · ${formatFileSize(result.bytes)}`,
        );
      }
      setDeletingEntity(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  return {
    trash,
    trashedIncidents,
    trashedRequests,
    storagePending,
    storageKept,
    storageTotal,
    totalItems,
    isLoading,
    busyId,
    deletingEntity,
    setDeletingEntity,
    filter,
    setFilter,
    handleRestoreIncident,
    handleRestoreRequest,
    handleRestoreStorage,
    handleConfirmDelete,
  };
}
