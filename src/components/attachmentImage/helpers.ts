/**
 * Helpers y utilidades puras para la gestión y reintento de imágenes adjuntas.
 */

/**
 * La misma dirección con el número del intento detrás. Sin eso, «Reintentar»
 * pediría lo mismo que ya falló y el navegador podría contestar con lo que tiene
 * guardado; con eso, la petición es nueva.
 */
export function withAttempt(url: string, attempt: number): string {
  if (attempt === 0) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("reintento", String(attempt));
    return parsed.toString();
  } catch {
    return url;
  }
}
