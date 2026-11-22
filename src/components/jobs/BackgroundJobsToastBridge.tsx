import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { isActiveJobStatus } from "@/lib/backgroundJobs";

/**
 * Observa los trabajos en segundo plano del usuario y lanza un toast global
 * cuando alguno pasa de activo a completado o con error, sin importar la ruta.
 */
export function BackgroundJobsToastBridge() {
  const jobs = useQuery(api.backgroundJobs.listMine, {});
  const prevStatusRef = useRef<Map<string, string>>(new Map());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!jobs) return;
    if (!initializedRef.current) {
      for (const job of jobs) {
        prevStatusRef.current.set(job._id, job.status);
      }
      initializedRef.current = true;
      return;
    }

    const nextMap = new Map<string, string>();
    for (const job of jobs) {
      nextMap.set(job._id, job.status);
      const prev = prevStatusRef.current.get(job._id);
      if (prev && isActiveJobStatus(prev) && !isActiveJobStatus(job.status)) {
        if (job.status === "completed") {
          toast.success(`${job.title}: ${job.detail ?? "completado."}`);
        } else if (job.status === "failed") {
          toast.error(`${job.title}: ${job.error ?? "ha fallado."}`);
        }
      }
    }
    prevStatusRef.current = nextMap;
  }, [jobs]);

  return null;
}
