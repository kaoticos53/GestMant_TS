import { weekdayLabel } from "@/lib/weeklyReport";
import { formatDateTime } from "@/lib/workshop";

/**
 * Filtra las claves de rol manteniendo únicamente aquellas válidas y conocidas.
 */
export function filterKnownRoleKeys(
  roleKeys: string[],
  knownKeys: string[],
): string[] {
  return roleKeys.filter((key) => knownKeys.includes(key));
}

/**
 * Añade o elimina una clave de rol de una lista garantizando que no haya duplicados.
 */
export function toggleRoleInList(
  keys: string[],
  key: string,
  checked: boolean,
): string[] {
  if (checked) {
    return keys.includes(key) ? keys : [...keys, key];
  }
  return keys.filter((item) => item !== key);
}

/**
 * Genera el texto explicativo de la periodicidad y estado del cron de envío.
 */
export function formatScheduleNotice(enabled: boolean, weekday: number): string {
  if (!enabled) {
    return "Mientras esté apagado no se envía nada; el botón de enviar ahora sigue disponible.";
  }
  const dia = weekdayLabel(weekday).toLowerCase();
  return `Se envía los ${dia} por la mañana (07:00 UTC).`;
}

/**
 * Genera el texto explicativo con los destinatarios actuales y la fecha del último envío.
 */
export function formatRecipientsSummary(
  recipients: string[],
  lastSentAt?: number | null,
): string {
  let text = "";
  if (recipients.length === 0) {
    text =
      "Ninguna persona en activo de esos roles tiene correo: así no saldría el resumen.";
  } else {
    const personaText =
      recipients.length === 1 ? "persona recibe" : "personas reciben";
    text = `${recipients.length} ${personaText} el resumen: ${recipients.join(", ")}.`;
  }

  if (lastSentAt) {
    text += ` Último envío: ${formatDateTime(lastSentAt)}.`;
  }
  return text;
}

/**
 * Genera el mensaje de éxito tras disparar el envío inmediato.
 */
export function formatSendSuccessMessage(recipientsCount: number): string {
  const personaText = recipientsCount === 1 ? "persona" : "personas";
  return `Resumen enviado a ${recipientsCount} ${personaText}`;
}

/**
 * Formatea el estado de envío para una entrada del historial.
 */
export function formatHistoryStatus(
  status: string,
  recipientsCount: number,
  sentAt?: number | null,
): string {
  const main =
    status === "sent" ? `Enviado a ${recipientsCount}` : "No salió";
  const dateStr = sentAt ? ` · ${formatDateTime(sentAt)}` : "";
  return `${main}${dateStr}`;
}
