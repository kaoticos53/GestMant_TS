import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getErrorMessage } from "@/lib/workshop";
import { archiveWithUndoToast, unarchiveSuccessToast } from "@/lib/archiveToasts";
import { useIncidentFilters } from "./useIncidentFilters";
import type { IncidentDoc } from "../types";

export function useIncidentsViewState({
  initialDetailId = null,
}: {
  initialDetailId?: Id<"incidents"> | null;
} = {}) {
  const incidents = useQuery(api.incidents.list, {}) ?? [];
  const equipment = useQuery(api.equipment.list, {}) ?? [];
  const requests =
    useQuery(api.partRequests.list, { includeArchived: true }) ?? [];

  const [reportsOpen, setReportsOpen] = useState(false);
  const archiveIncident = useMutation(api.incidents.archive);
  const unarchiveIncident = useMutation(api.incidents.unarchive);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const filterState = useIncidentFilters({
    incidents,
    initialDetailId,
  });

  const handleArchive = async (incident: IncidentDoc) => {
    setArchivingId(incident._id);
    try {
      await archiveIncident({ incidentId: incident._id });
      archiveWithUndoToast({
        reference: incident.reference,
        noun: "incidencia",
        onUndo: async () => {
          try {
            await unarchiveIncident({ incidentId: incident._id });
            unarchiveSuccessToast({ reference: incident.reference });
          } catch (err) {
            toast.error(getErrorMessage(err));
          }
        },
      });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setArchivingId(null);
    }
  };

  return {
    incidents,
    equipment,
    requests,
    reportsOpen,
    setReportsOpen,
    archivingId,
    handleArchive,
    ...filterState,
  };
}
