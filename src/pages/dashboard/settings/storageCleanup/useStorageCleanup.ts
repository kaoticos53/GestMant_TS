import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { getErrorMessage } from "@/lib/workshop";
import { formatStorageCleanupResultToast } from "./helpers";
import type { StorageCleanupRun } from "./types";

export function useStorageCleanup() {
  const runs = useQuery(api.cleanupLog.lastRuns) as StorageCleanupRun[] | undefined;
  // Acción y no mutación: cada pasada del almacén va en su propia transacción.
  const runNow = useAction(api.storageCleanup.runNow);
  const [running, setRunning] = useState(false);

  const handleRunNow = async () => {
    setRunning(true);
    try {
      const result = await runNow();
      toast.success(formatStorageCleanupResultToast(result));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRunning(false);
    }
  };

  return {
    runs,
    running,
    handleRunNow,
  };
}
