/**
 * Lógica pura de dominio para trabajos en segundo plano (`backgroundJobs`).
 * Sin dependencias de React ni Convex para cumplir la frontera de `src/lib/`.
 */

export type BackgroundJobType =
  | "mail_auto_tag"
  | "mail_sync"
  | "ai_memory_workshop"
  | "ai_memory_mailbox"
  | "ai_memory_vectors"
  | "workshop_backup_export"
  | "workshop_backup_restore"
  | "storage_cleanup";

export type BackgroundJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export const JOB_STATUS = {
  QUEUED: "queued",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export const BACKGROUND_JOB_STATUSES: readonly BackgroundJobStatus[] = [
  JOB_STATUS.QUEUED,
  JOB_STATUS.RUNNING,
  JOB_STATUS.COMPLETED,
  JOB_STATUS.FAILED,
  JOB_STATUS.CANCELLED,
] as const;

const ACTIVE_STATUSES = new Set<BackgroundJobStatus>([
  JOB_STATUS.QUEUED,
  JOB_STATUS.RUNNING,
]);

const JOB_TRANSITIONS: Record<BackgroundJobStatus, readonly BackgroundJobStatus[]> = {
  queued: ["running", "completed", "failed", "cancelled"],
  running: ["running", "completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

const JOB_TYPE_LABELS: Record<BackgroundJobType, string> = {
  mail_auto_tag: "Autoetiquetado IA de correo",
  mail_sync: "Sincronización de correo",
  ai_memory_workshop: "Indexación de memoria IA",
  ai_memory_mailbox: "Indexación de correos en IA",
  ai_memory_vectors: "Vectorización semántica de memoria IA",
  workshop_backup_export: "Exportación de copia de seguridad",
  workshop_backup_restore: "Restauración de copia de seguridad",
  storage_cleanup: "Limpieza de almacenamiento",
};

const JOB_STATUS_LABELS: Record<BackgroundJobStatus, string> = {
  queued: "En cola",
  running: "En curso",
  completed: "Completado",
  failed: "Error",
  cancelled: "Cancelado",
};

export function isActiveJobStatus(status: string): boolean {
  return ACTIVE_STATUSES.has(status as BackgroundJobStatus);
}

export function isCancelledJobStatus(status: string): boolean {
  return status === JOB_STATUS.CANCELLED;
}

export function canCancelJob(status: string): boolean {
  return ACTIVE_STATUSES.has(status as BackgroundJobStatus);
}

export function canTransitionJob(
  from: BackgroundJobStatus,
  to: BackgroundJobStatus,
): boolean {
  return JOB_TRANSITIONS[from]?.includes(to) ?? false;
}

export function jobTypeLabel(type: string): string {
  return JOB_TYPE_LABELS[type as BackgroundJobType] ?? type;
}

export function jobStatusLabel(status: string): string {
  return JOB_STATUS_LABELS[status as BackgroundJobStatus] ?? status;
}

/** Días de historial que se conservan y se consultan (coincide con la purga). */
export const JOB_LOG_WINDOW_DAYS = 7;

/** Filtro del registro de ejecuciones. */
export type JobLogFilter = "all" | "failed" | "active" | "completed";

export const JOB_LOG_FILTERS: { id: JobLogFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "failed", label: "Con error" },
  { id: "active", label: "En curso" },
  { id: "completed", label: "Completados" },
];

/** ¿El trabajo entra en el filtro elegido? Los cancelados solo salen en «Todos». */
export function matchesJobLogFilter(status: string, filter: JobLogFilter): boolean {
  switch (filter) {
    case "failed":
      return status === JOB_STATUS.FAILED;
    case "active":
      return isActiveJobStatus(status);
    case "completed":
      return status === JOB_STATUS.COMPLETED;
    default:
      return true;
  }
}

/** Recuento por filtro, para las pestañas del registro. */
export function countJobsByFilter(
  statuses: readonly string[],
): Record<JobLogFilter, number> {
  const counts: Record<JobLogFilter, number> = {
    all: statuses.length,
    failed: 0,
    active: 0,
    completed: 0,
  };
  for (const status of statuses) {
    if (status === JOB_STATUS.FAILED) counts.failed += 1;
    else if (status === JOB_STATUS.COMPLETED) counts.completed += 1;
    else if (isActiveJobStatus(status)) counts.active += 1;
  }
  return counts;
}

/**
 * Duración legible de una ejecución: hasta que terminó o, si sigue en curso,
 * hasta `now`. «—» si los tiempos no tienen sentido.
 */
export function formatJobDuration(
  createdAt: number,
  finishedAt: number | undefined,
  now: number,
): string {
  const end = finishedAt ?? now;
  const ms = end - createdAt;
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ${seconds % 60} s`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min`;
}

/** Progreso legible: «120 de 300» o «120 procesados» si no hay total. */
export function formatJobProgress(processed: number, total?: number): string {
  if (total !== undefined && total > 0) return `${processed} de ${total}`;
  return processed > 0 ? `${processed} procesados` : "—";
}
