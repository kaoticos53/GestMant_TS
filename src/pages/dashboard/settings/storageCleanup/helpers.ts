import {
  CLEANUP_PASS_META,
  cleanupCount,
  cleanupTicketsLabel,
  cleanupUnreadableLabel,
} from "@/lib/cleanupLog";
import {
  formatDateTime,
  formatFileSize,
  formatRelativeTime,
} from "@/lib/workshop";
import type { ManualCleanupSummary, StorageCleanupRun } from "./types";

/**
 * Compone el mensaje del toast para la acción de limpieza inmediata.
 */
export function formatStorageCleanupResultToast(
  result: ManualCleanupSummary,
): string {
  const removed = [
    result.reportUploads.files > 0
      ? cleanupCount("reportUploads", result.reportUploads.files)
      : null,
    result.reportUploads.tickets > 0
      ? cleanupTicketsLabel(result.reportUploads.tickets)
      : null,
    result.orphanFiles.files > 0
      ? cleanupCount("orphanFiles", result.orphanFiles.files)
      : null,
  ].filter((part): part is string => part !== null);

  const freed =
    result.trash.files > 0
      ? `${formatFileSize(result.trash.bytes)} liberados (${cleanupCount(
          "trash",
          result.trash.files,
        )})`
      : null;

  const unreadable = [
    result.reportUploads.unreadable > 0
      ? `${cleanupUnreadableLabel(
          result.reportUploads.unreadable,
        )}, sin nada que guardar`
      : null,
    result.orphanFiles.unreadable > 0
      ? `${cleanupUnreadableLabel(result.orphanFiles.unreadable)}, sin retirar`
      : null,
  ].filter((part): part is string => part !== null);

  const parts = [
    removed.length > 0 ? `${removed.join(" y ")} a la papelera` : null,
    freed,
    ...unreadable,
  ].filter((part): part is string => part !== null);

  return parts.length === 0
    ? "La limpieza no tenía nada que hacer"
    : `Limpieza hecha: ${parts.join(" · ")}`;
}

/**
 * Formatea el texto de la fecha de ejecución (relativa y absoluta) o indica que no ha corrido.
 */
export function formatRunTimestamp(ranAt: number | null): string {
  if (ranAt === null) {
    return "todavía no ha corrido";
  }
  return `${formatRelativeTime(ranAt)} · ${formatDateTime(ranAt)}`;
}

/**
 * Formatea los detalles de archivos, vales y errores de una pasada.
 */
export function formatRunDetail(
  run: Pick<
    StorageCleanupRun,
    "pass" | "ranAt" | "files" | "bytes" | "tickets" | "unreadable"
  >,
): string {
  const detail = [
    run.ranAt === null
      ? null
      : run.files === 0
        ? "no retiró nada"
        : `${cleanupCount(run.pass, run.files)} · ${formatFileSize(run.bytes)}`,
    run.tickets > 0 ? cleanupTicketsLabel(run.tickets) : null,
    run.unreadable > 0
      ? `${cleanupUnreadableLabel(run.unreadable)}${
          run.pass === "orphanFiles"
            ? ", sin retirar"
            : ", sin nada que guardar"
        }`
      : null,
  ].filter((part): part is string => part !== null);

  return detail.length > 0 ? detail.join(" · ") : "Nunca ha retirado nada.";
}

/**
 * Devuelve la descripción de quién o qué disparó la pasada si ha llegado a ejecutarse.
 */
export function formatRunTrigger(
  run: Pick<StorageCleanupRun, "ranAt" | "automatic" | "runBy">,
): string | null {
  if (run.ranAt === null) {
    return null;
  }
  return run.automatic
    ? "la lanzó la limpieza automática"
    : `a mano, ${run.runBy ?? "Coordinación"}`;
}

/**
 * Reexporta metadatos de pasadas para uso en componentes UI.
 */
export { CLEANUP_PASS_META };
