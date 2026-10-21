import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getErrorMessage } from "@/lib/workshop";
import { toast } from "sonner";
import type { ArchiveEntry, TrashRow } from "../types";

export function useTrashOperations() {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [trashBusyId, setTrashBusyId] = useState<string | null>(null);
  const [trashDeleting, setTrashDeleting] = useState<TrashRow | null>(null);
  const [trashOpen, setTrashOpen] = useState<TrashRow | null>(null);

  const unarchiveIncident = useMutation(api.incidents.unarchive);
  const unarchiveRequest = useMutation(api.partRequests.unarchive);
  const restoreIncident = useMutation(api.incidents.restore);
  const deleteIncident = useMutation(api.incidents.deleteNow);
  const restoreRequest = useMutation(api.partRequests.restore);
  const deleteRequest = useMutation(api.partRequests.deleteNow);

  const handleRestore = async (entry: ArchiveEntry) => {
    setBusyId(entry.id);
    try {
      if (entry.kind === "incident") {
        await unarchiveIncident({ incidentId: entry.id });
      } else {
        await unarchiveRequest({ requestId: entry.id });
      }
      toast.success(
        `${entry.reference} vuelve a la cola de ${entry.kind === "incident" ? "incidencias" : "peticiones"}`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const handleTrashRestore = async (row: TrashRow) => {
    setTrashBusyId(row.item.id);
    try {
      if (row.kind === "incident") {
        await restoreIncident({ incidentId: row.item.id });
        toast.success(
          row.item.archived
            ? `${row.item.reference} vuelve al archivo`
            : `${row.item.reference} vuelve a la cola de incidencias`,
        );
      } else {
        await restoreRequest({ requestId: row.item.id });
        toast.success(
          row.item.archived
            ? `${row.item.reference} vuelve al archivo`
            : `${row.item.reference} vuelve a la cola de peticiones`,
        );
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setTrashBusyId(null);
    }
  };

  const handleTrashDelete = async () => {
    if (!trashDeleting) return;
    setTrashBusyId(trashDeleting.item.id);
    try {
      if (trashDeleting.kind === "incident") {
        await deleteIncident({ incidentId: trashDeleting.item.id });
      } else {
        await deleteRequest({ requestId: trashDeleting.item.id });
      }
      toast.success(`${trashDeleting.item.reference} borrada definitivamente`);
      setTrashDeleting(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setTrashBusyId(null);
    }
  };

  return {
    busyId,
    trashBusyId,
    trashDeleting,
    setTrashDeleting,
    trashOpen,
    setTrashOpen,
    handleRestore,
    handleTrashRestore,
    handleTrashDelete,
  };
}
