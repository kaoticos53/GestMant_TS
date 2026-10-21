import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { archivableBefore } from "@/lib/archive";
import { monthsAgo } from "@/lib/browse";
import { getErrorMessage } from "@/lib/workshop";
import { toast } from "sonner";
import type { IncidentDoc, RequestDoc } from "../types";

export interface UseBulkArchiveOptions {
  activeIncidents: IncidentDoc[];
  activeRequests: RequestDoc[];
  canArchiveIncidents: boolean;
  canArchiveRequests: boolean;
}

export function useBulkArchive({
  activeIncidents,
  activeRequests,
  canArchiveIncidents,
  canArchiveRequests,
}: UseBulkArchiveOptions) {
  const [cutoffMonths, setCutoffMonths] = useState("12");
  const [bulkTarget, setBulkTarget] = useState<"incidents" | "requests" | null>(
    null,
  );
  const [bulkBusy, setBulkBusy] = useState(false);

  const archiveIncidents = useMutation(api.incidents.archiveClosedBefore);
  const archiveRequests = useMutation(api.partRequests.archiveDecidedBefore);

  const cutoff = monthsAgo(Number(cutoffMonths));
  const pending = archivableBefore({
    incidents: activeIncidents,
    requests: activeRequests,
    before: cutoff,
  });

  const canArchiveSomething =
    (canArchiveIncidents && pending.incidents > 0) ||
    (canArchiveRequests && pending.requests > 0);

  const handleBulkArchive = async () => {
    if (!bulkTarget) return;
    setBulkBusy(true);
    try {
      if (bulkTarget === "incidents") {
        const archived = await archiveIncidents({ before: cutoff });
        toast.success(
          archived === 0
            ? "No había incidencias cerradas anteriores a esa fecha"
            : `${archived} ${archived === 1 ? "incidencia archivada" : "incidencias archivadas"}`,
        );
      } else {
        const archived = await archiveRequests({ before: cutoff });
        toast.success(
          archived === 0
            ? "No había peticiones decididas anteriores a esa fecha"
            : `${archived} ${archived === 1 ? "petición archivada" : "peticiones archivadas"}`,
        );
      }
      setBulkTarget(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBulkBusy(false);
    }
  };

  return {
    cutoffMonths,
    setCutoffMonths,
    cutoff,
    pending,
    canArchiveSomething,
    bulkTarget,
    setBulkTarget,
    bulkBusy,
    handleBulkArchive,
  };
}
