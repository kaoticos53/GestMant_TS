import { useState } from "react";
import { useQuery } from "convex/react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Loader2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import {
  JOB_LOG_FILTERS,
  JOB_LOG_WINDOW_DAYS,
  JOB_STATUS,
  countJobsByFilter,
  formatJobDuration,
  formatJobProgress,
  isActiveJobStatus,
  jobStatusLabel,
  jobTypeLabel,
  matchesJobLogFilter,
  type JobLogFilter,
} from "@/lib/backgroundJobs";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/workshop";

export interface BackgroundJobsLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Filtro con el que se abre (desde el aviso de fallidos, «Con error»). */
  initialFilter?: JobLogFilter;
}

/**
 * Registro de ejecuciones de los trabajos en segundo plano de todo el taller:
 * qué se lanzó, quién, cuánto tardó, cómo terminó y, si falló, con qué error.
 */
export function BackgroundJobsLogDialog({
  open,
  onOpenChange,
  initialFilter = "all",
}: BackgroundJobsLogDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-3 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Trabajos en segundo plano</DialogTitle>
          <DialogDescription>
            Ejecuciones de los últimos {JOB_LOG_WINDOW_DAYS} días de todos los
            usuarios: sincronización y etiquetado de correo, indexación de la
            IA, copias de seguridad y limpieza del almacén.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <BackgroundJobsLogBody key={initialFilter} initialFilter={initialFilter} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BackgroundJobsLogBody({
  initialFilter,
}: {
  initialFilter: JobLogFilter;
}) {
  const jobs = useQuery(api.backgroundJobs.listForAdmin, {});
  const [filter, setFilter] = useState<JobLogFilter>(initialFilter);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  if (jobs === undefined) {
    return (
      <div
        role="status"
        className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"
      >
        <Loader2 className="size-4 animate-spin" />
        Cargando el registro…
      </div>
    );
  }

  const counts = countJobsByFilter(jobs.map((job) => job.status));
  const visible = jobs.filter((job) => matchesJobLogFilter(job.status, filter));

  return (
    <>
      <div
        role="tablist"
        aria-label="Filtrar trabajos"
        className="inline-flex flex-wrap gap-1 self-start rounded-lg border border-border/70 bg-card p-1"
      >
        {JOB_LOG_FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={filter === option.id}
            onClick={() => setFilter(option.id)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              filter === option.id
                ? option.id === "failed"
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
            <span className="ml-1.5 tabular-nums opacity-75">
              {counts[option.id]}
            </span>
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border/70">
        {visible.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {filter === "failed"
              ? "Ningún trabajo ha terminado con error en este periodo."
              : "No hay trabajos que mostrar con este filtro."}
          </p>
        ) : (
          <ul className="divide-y divide-border/70">
            {visible.map((job) => {
              const failed = job.status === JOB_STATUS.FAILED;
              const active = isActiveJobStatus(job.status);
              const expanded = expandedId === job._id || failed;
              const hasDetail = Boolean(job.error || job.detail);
              return (
                <li key={job._id} className="px-3 py-2.5 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-start gap-2 text-left disabled:cursor-default"
                      disabled={!hasDetail || failed}
                      aria-expanded={hasDetail ? expanded : undefined}
                      onClick={() =>
                        setExpandedId((prev) => (prev === job._id ? null : job._id))
                      }
                    >
                      {failed ? (
                        <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                      ) : active ? (
                        <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-signal" />
                      ) : job.status === JOB_STATUS.COMPLETED ? (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0">
                        <span className="block font-medium">
                          {jobTypeLabel(job.type)}
                        </span>
                        {job.title !== jobTypeLabel(job.type) && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {job.title}
                          </span>
                        )}
                        <span className="block text-xs text-muted-foreground">
                          {job.ownerName} · {formatDateTime(job.createdAt)} ·{" "}
                          {formatJobDuration(job.createdAt, job.finishedAt, now)} ·{" "}
                          {formatJobProgress(job.processed, job.total)}
                        </span>
                      </span>
                      {hasDetail && !failed && (
                        expanded ? (
                          <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        )
                      )}
                    </button>
                    <Badge
                      variant={failed ? "destructive" : "outline"}
                      className="shrink-0"
                    >
                      {jobStatusLabel(job.status)}
                    </Badge>
                  </div>

                  {expanded && hasDetail && (
                    <div className="mt-2 space-y-1.5 pl-6">
                      {job.detail && (
                        <p className="text-xs text-muted-foreground">
                          {job.detail}
                        </p>
                      )}
                      {job.error && (
                        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2">
                          <pre className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-destructive">
                            {job.error}
                          </pre>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0"
                            aria-label="Copiar el error"
                            onClick={() => {
                              void navigator.clipboard
                                ?.writeText(job.error ?? "")
                                .then(() => toast.success("Error copiado"));
                            }}
                          >
                            <Copy className="size-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
