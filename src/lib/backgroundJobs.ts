/**
 * Lógica pura de dominio para trabajos en segundo plano (`backgroundJobs`).
 * Sin dependencias de React ni Convex para cumplir la frontera de `src/lib/`.
 */

export type BackgroundJobType =
  | "mail_auto_tag"
  | "mail_sync"
  | "ai_memory_workshop"
  | "ai_memory_mailbox"
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
