/**
 * Reglas de cuota, tamaños y constantes por defecto para llamadas a DeepSeek.
 */

export const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
export const DEFAULT_DEEPSEEK_VISION_MODEL = "deepseek-flash";
export const DEFAULT_DEEPSEEK_CHAT_MODEL = "deepseek-chat";

/** Ventana de cuota por usuario autenticado: 1 hora. */
export const AI_WINDOW_MS = 60 * 60 * 1000;

/** Máximo de llamadas IA por usuario y hora para contener costes. */
export const AI_MAX_CALLS_PER_USER_HOUR = 40;

/** Tamaño máximo del Data URL de imagen comprimida enviada a visión (~2 MB). */
export const AI_MAX_IMAGE_DATA_URL_BYTES = 2 * 1024 * 1024;

/** Máximo de códigos de barras locales pasados como pistas. */
export const AI_MAX_BARCODE_HINTS = 8;

/** Máximo de caracteres de una pregunta en el asistente de incidencias. */
export const AI_MAX_QUESTION_LENGTH = 500;

export function admitAiUsage(
  recentCount: number,
  limit: number = AI_MAX_CALLS_PER_USER_HOUR,
): { allowed: boolean; error?: string } {
  if (recentCount >= limit) {
    return {
      allowed: false,
      error: `Has alcanzado el límite de ${limit} consultas de IA por hora. Inténtalo de nuevo más tarde.`,
    };
  }
  return { allowed: true };
}

export function isValidAiBaseUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed === "") return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
