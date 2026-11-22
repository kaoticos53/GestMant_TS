import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { isActiveJobStatus } from "@/lib/backgroundJobs";
import { getErrorMessage } from "@/lib/workshop";
import type { StorageCleanupRun } from "./types";

export function useStorageCleanup() {
  const runs = useQuery(api.cleanupLog.lastRuns) as StorageCleanupRun[] | undefined;
  const jobs = useQuery(api.backgroundJobs.listMine, {}) ?? [];
  const startRunNow = useMutation(api.storageCleanup.startRunNow);
  const [starting, setStarting] = useState(false);

  const running =
    starting ||
    jobs.some((j) => j.type === "storage_cleanup" && isActiveJobStatus(j.status));

  const handleRunNow = async () => {
    setStarting(true);
    try {
      const res = await startRunNow({});
      toast.info(
        res.reused
          ? "Ya hay una limpieza de almacenamiento en curso."
          : "Limpieza de almacenamiento iniciada en segundo plano.",
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setStarting(false);
    }
  };

  return {
    runs,
    running,
    handleRunNow,
  };
}
