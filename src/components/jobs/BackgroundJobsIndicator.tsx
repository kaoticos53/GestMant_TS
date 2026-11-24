import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, Loader2, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ErrorMessageWithDetails } from "@/components/ErrorMessageWithDetails";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/convex/_generated/api";
import {
  canCancelJob,
  isActiveJobStatus,
  jobStatusLabel,
} from "@/lib/backgroundJobs";
import { getErrorMessage } from "@/lib/workshop";

/**
 * Indicador global en la cabecera del dashboard para trabajos en segundo plano.
 * Solo se muestra cuando hay trabajos activos o finalizados recientemente.
 */
export function BackgroundJobsIndicator() {
  const jobs = useQuery(api.backgroundJobs.listMine, {}) ?? [];
  const cancelJob = useMutation(api.backgroundJobs.cancel);
  const dismissJob = useMutation(api.backgroundJobs.dismiss);
  const clearFinished = useMutation(api.backgroundJobs.clearFinished);
  const [open, setOpen] = useState(false);

  if (jobs.length === 0) return null;

  const activeJobs = jobs.filter((j) => isActiveJobStatus(j.status));
  const finishedCount = jobs.length - activeJobs.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs"
          aria-label="Trabajos en segundo plano"
          title="Trabajos en segundo plano"
        >
          {activeJobs.length > 0 ? (
            <>
              <Loader2 className="size-3.5 animate-spin text-primary" />
              <span className="tabular-nums">{activeJobs.length}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              <span className="tabular-nums">{jobs.length}</span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold">
            Tareas en segundo plano
          </span>
          {finishedCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => void clearFinished({})}
            >
              Limpiar
            </Button>
          )}
        </div>

        <div className="max-h-72 space-y-2 overflow-y-auto">
          {jobs.map((job) => {
            const active = isActiveJobStatus(job.status);
            const failed = job.status === "failed";
            return (
              <div
                key={job._id}
                className="rounded-md border border-border/70 bg-muted/20 p-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-medium">
                      {active ? (
                        <Loader2 className="size-3 shrink-0 animate-spin text-primary" />
                      ) : failed ? (
                        <XCircle className="size-3 shrink-0 text-destructive" />
                      ) : (
                        <CheckCircle2 className="size-3 shrink-0 text-emerald-600" />
                      )}
                      <span className="truncate">{job.title}</span>
                    </div>
                    {job.error ? (
                      <ErrorMessageWithDetails
                        error={job.error}
                        className="mt-0.5"
                        textClassName="text-[11px]"
                      />
                    ) : (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {job.detail || jobStatusLabel(job.status)}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {jobStatusLabel(job.status)}
                    </Badge>
                    {canCancelJob(job.status) ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        title="Cancelar"
                        onClick={() =>
                          void cancelJob({ jobId: job._id }).catch((e) =>
                            toast.error(getErrorMessage(e)),
                          )
                        }
                      >
                        <X className="size-3" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        title="Ocultar"
                        onClick={() => void dismissJob({ jobId: job._id })}
                      >
                        <X className="size-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
