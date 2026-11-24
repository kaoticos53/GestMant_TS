/**
 * Lógica pura de clasificación de errores y política de reintentos para correos
 * salientes del taller (`mailOutbox`).
 *
 * Sin dependencias de React ni Convex: compartido entre el backend y la UI.
 */

export type MailOutboxStatus = "retrying" | "failed" | "sent" | "discarded";

/** Retardos entre reintentos automáticos: 1 min, 5 min y 30 min. */
export const MAIL_RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000] as const;

/** Número máximo de intentos totales (1 inicial + 3 reintentos automáticos). */
export const MAX_MAIL_ATTEMPTS = 1 + MAIL_RETRY_DELAYS_MS.length;

export const OUTBOX_STATUS_META: Record<
  MailOutboxStatus,
  { label: string; badgeClassName: string }
> = {
  retrying: {
    label: "Reintentando",
    badgeClassName:
      "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  failed: {
    label: "Fallido",
    badgeClassName: "border-destructive/40 bg-destructive/10 text-destructive",
  },
  sent: {
    label: "Enviado",
    badgeClassName:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  discarded: {
    label: "Descartado",
    badgeClassName: "border-border bg-muted text-muted-foreground",
  },
};

export interface MailFailureClassification {
  retryable: boolean;
  reason: "transient" | "permanent";
}

const PERMANENT_TEXT_PATTERNS = [
  /apagado en los ajustes/i,
  /VLY_INTEGRATION_KEY/i,
  /no parece una dirección/i,
  /no puede llevar saltos/i,
  /testigo del relevo/i,
  /rechazó el destinatario/i,
];

/**
 * Clasifica un mensaje de error de entrega para decidir si conviene programar
 * reintentos automáticos (fallo transitorio) o marcarlo como fallido directo
 * (fallo de configuración, credenciales o dirección).
 */
export function classifyMailFailure(error?: string): MailFailureClassification {
  const msg = (error ?? "").trim();
  if (!msg) return { retryable: true, reason: "transient" };

  for (const pattern of PERMANENT_TEXT_PATTERNS) {
    if (pattern.test(msg)) {
      return { retryable: false, reason: "permanent" };
    }
  }

  const httpMatch = /\bHTTP\s+(\d{3})\b/i.exec(msg);
  if (httpMatch) {
    const code = Number(httpMatch[1]);
    if (code === 408 || code === 429 || code >= 500) {
      return { retryable: true, reason: "transient" };
    }
    if (code >= 400 && code < 500) {
      return { retryable: false, reason: "permanent" };
    }
  }

  // Códigos SMTP permanentes (5xx) como 535 (auth) o 550 (buzón inexistente)
  if (/\b5[0-5]\d\b/.test(msg) && !/\b50[0-4]\b/.test(msg)) {
    return { retryable: false, reason: "permanent" };
  }

  return { retryable: true, reason: "transient" };
}

/**
 * Devuelve los milisegundos de espera hasta el siguiente reintento dado el
 * número de intentos ya realizados (`attempts >= 1`), o `null` si se agotaron.
 */
export function nextRetryDelayMs(attemptsSoFar: number): number | null {
  if (!Number.isFinite(attemptsSoFar) || attemptsSoFar < 1) {
    return MAIL_RETRY_DELAYS_MS[0];
  }
  const index = Math.floor(attemptsSoFar) - 1;
  return MAIL_RETRY_DELAYS_MS[index] ?? null;
}
