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
  initialFilter = "all",
  initialSearch = "",
}: {
  initialDetailId?: Id<"incidents"> | null;
  initialFilter?: import("@/lib/workshop").IncidentStatus | "all";
  initialSearch?: string;
} = {}) {
  const rawIncidents = useQuery(api.incidents.list, {});
  const incidents = rawIncidents ?? [];
  const loading = rawIncidents === undefined;
  const equipment = useQuery(api.equipment.list, {}) ?? [];
  const requests =
    useQuery(api.partRequests.list, { includeArchived: true }) ?? [];

  const [reportsOpen, setReportsOpen] = useState(false);
  const archiveIncident = useMutation(api.incidents.archive);
  const unarchiveIncident = useMutation(api.incidents.unarchive);
  const selfAssignIncident = useMutation(api.incidents.selfAssign);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [selfAssigningId, setSelfAssigningId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<Id<"incidents">>>(
    () => new Set(),
  );
  const [bulkArchiving, setBulkArchiving] = useState(false);

  const filterState = useIncidentFilters({
    incidents,
    initialDetailId,
    initialFilter,
    initialSearch,
  });

  const toggleSelect = (id: Id<"incidents">) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleSelfAssign = async (incident: IncidentDoc) => {
    setSelfAssigningId(incident._id);
    try {
      await selfAssignIncident({
        incidentId: incident._id,
        expectedUpdatedAt: incident.updatedAt,
      });
      toast.success(`${incident.reference} asignada a ti`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSelfAssigningId(null);
    }
  };

  const handleArchive = async (incident: IncidentDoc) => {
    setArchivingId(incident._id);
    try {
      await archiveIncident({ incidentId: incident._id });
      setSelectedIds((prev) => {
        if (!prev.has(incident._id)) return prev;
        const next = new Set(prev);
        next.delete(incident._id);
        return next;
      });
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

  const handleBulkArchive = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkArchiving(true);
    try {
      const results = await Promise.allSettled(
        ids.map((incidentId) => archiveIncident({ incidentId })),
      );
      let ok = 0;
      const failedIds = new Set<Id<"incidents">>();
      results.forEach((res, idx) => {
        if (res.status === "fulfilled") {
          ok += 1;
        } else {
          failedIds.add(ids[idx]);
        }
      });
      setSelectedIds(failedIds);
      if (ok > 0) {
        toast.success(
          ok === 1
            ? "1 incidencia archivada"
            : `${ok} incidencias archivadas`,
        );
      }
      if (failedIds.size > 0) {
        toast.error(
          `${failedIds.size} incidencia(s) no se pudieron archivar`,
        );
      }
    } finally {
      setBulkArchiving(false);
    }
  };

  return {
    incidents,
    loading,
    equipment,
    requests,
    reportsOpen,
    setReportsOpen,
    archivingId,
    selfAssigningId,
    selectedIds,
    bulkArchiving,
    toggleSelect,
    clearSelection,
    handleSelfAssign,
    handleArchive,
    handleBulkArchive,
    ...filterState,
  };
}
