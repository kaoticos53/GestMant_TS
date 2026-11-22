/**
 * Utilidades puras para la presentación y exportación CSV de las trazas de
 * auditoría de seguridad (`securityAuditLog`).
 */

import type { CsvCell } from "./export";
import { formatDateTime } from "./workshop";

/** Versión del sobre de metadatos que escriben los eventos nuevos. */
export const SECURITY_METADATA_VERSION = 1 as const;

export interface SecurityAuditEntry {
  _id: string;
  actorId?: string;
  actorEmail?: string;
  action: string;
  target: string;
  metadata?: string;
  at: number;
}

export const SECURITY_ACTION_LABELS: Record<string, string> = {
  role_change: "Cambio de rol",
  account_status_change: "Alta o baja de cuenta",
  session_revoked: "Revocación de sesiones",
  role_permissions_change: "Cambio de permisos de rol",
  role_definition_change: "Gestión de rol personalizado",
  mail_settings_change: "Configuración de correo",
  manual_purge: "Purga manual de almacén",
  label_print: "Impresión de etiquetas",
  workshop_reset: "Vaciado del taller",
  global_rate_limit_reached: "Umbral global anti-abuso",
  unauthorized_access: "Acceso no autorizado",
  workshop_backup_prune: "Limpieza de fotos de restauración",
  workshop_backup_recovery_failure: "Fallo de la pasada de recuperación",
};

export const SECURITY_ACTION_OPTIONS: { value: string; label: string }[] =
  Object.entries(SECURITY_ACTION_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

/** Etiqueta legible en español de una acción de seguridad. */
export function securityActionLabel(action: string): string {
  return SECURITY_ACTION_LABELS[action] ?? action;
}

/** Forma normalizada de la traza que deja la limpieza de fotos huérfanas. */
export interface SnapshotPruneMetadata {
  /** 0 = fila anterior al sobre versionado; 1 = `photos`/`chunks`. */
  version: number;
  keptBatch: string | null;
  photos: string[];
  chunks: number;
}

/**
 * Lee la traza de `workshop_backup_prune` sin depender de la época en que se
 * escribió. Las filas anteriores al cambio de nombre guardaban `batches` y
 * `rows`; las nuevas guardan `photos`, `chunks` y `metadataVersion`. La versión
 * ausente se interpreta como 0, anterior al sobre versionado.
 */
export function readSnapshotPruneMetadata(
  metadata?: string,
): SnapshotPruneMetadata | null {
  if (!metadata) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(metadata) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const value = parsed as Record<string, unknown>;
  const version =
    typeof value.metadataVersion === "number" ? value.metadataVersion : 0;
  const rawPhotos = Array.isArray(value.photos)
    ? value.photos
    : Array.isArray(value.batches)
      ? value.batches
      : [];
  const photos = rawPhotos.filter(
    (photo): photo is string => typeof photo === "string",
  );
  const chunks =
    typeof value.chunks === "number"
      ? value.chunks
      : typeof value.rows === "number"
        ? value.rows
        : 0;
  const keptBatch =
    typeof value.keptBatch === "string" ? value.keptBatch : null;
  return {
    version,
    keptBatch,
    photos,
    chunks,
  };
}

/** Resume `metadata` JSON en pares legibles (`clave: valor`) sin lanzar si es texto plano. */
export function formatSecurityMetadata(metadata?: string): string {
  if (!metadata) return "—";
  const trimmed = metadata.trim();
  if (trimmed === "") return "—";
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      const value = parsed as Record<string, unknown>;
      const prune = readSnapshotPruneMetadata(trimmed);
      if (
        prune &&
        (Array.isArray(value.photos) || Array.isArray(value.batches))
      ) {
        const photos =
          prune.photos.length > 0 ? prune.photos.join(", ") : "ninguna";
        const kept = prune.keptBatch ? ` · conservada: ${prune.keptBatch}` : "";
        return `fotos: ${photos} · documentos: ${prune.chunks}${kept}`;
      }
      const parts = Object.entries(parsed as Record<string, unknown>)
        .filter(
          ([key, value]) =>
            key !== "metadataVersion" && value !== undefined && value !== null,
        )
        .map(
          ([key, value]) =>
            `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`,
        );
      return parts.length > 0 ? parts.join(" · ") : "—";
    }
  } catch {
    // Texto no JSON: se muestra tal cual.
  }
  return trimmed;
}

/** Construye cabecera y filas para exportar trazas de seguridad a CSV. */
export function securityAuditCsvTable(entries: readonly SecurityAuditEntry[]): {
  header: string[];
  rows: CsvCell[][];
} {
  const header = ["Fecha", "Acción", "Actor", "Objetivo", "Detalles"];
  const rows: CsvCell[][] = entries.map((entry) => [
    formatDateTime(entry.at),
    securityActionLabel(entry.action),
    entry.actorEmail ?? entry.actorId ?? "Sistema / Público",
    entry.target,
    formatSecurityMetadata(entry.metadata),
  ]);
  return { header, rows };
}
