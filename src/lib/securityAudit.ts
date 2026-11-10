/**
 * Utilidades puras para la presentación y exportación CSV de las trazas de
 * auditoría de seguridad (`securityAuditLog`).
 */

import type { CsvCell } from "./export";
import { formatDateTime } from "./workshop";

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
      const parts = Object.entries(parsed as Record<string, unknown>)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) =>
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
export function securityAuditCsvTable(
  entries: readonly SecurityAuditEntry[],
): { header: string[]; rows: CsvCell[][] } {
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

