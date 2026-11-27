/**
 * Utilidades de texto seguras para Unicode.
 *
 * Las cadenas de JavaScript son UTF-16: un emoji o un carácter fuera del plano
 * básico ocupa dos unidades (un par sustituto). Recortar con `slice(0, n)`
 * puede partir ese par y dejar medio carácter suelto. Convex serializa los
 * argumentos y documentos como JSON y rechaza esa mitad suelta con «Received
 * invalid json: unexpected end of hex escape». Por eso todo texto de usuario
 * (asuntos y extractos de correo, descripciones…) que se recorta antes de
 * guardarse o enviarse pasa por aquí.
 *
 * Puro: no sabe de React ni de Convex.
 */

/** Medio par sustituto suelto (alto sin bajo detrás o bajo sin alto delante). */
const LONE_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Sustituye cualquier medio par suelto por «�» para que el texto sea UTF-16 válido. */
export function toWellFormedText(value: string): string {
  return value.replace(LONE_SURROGATE, "\uFFFD");
}

/**
 * Recorta a como mucho `max` unidades UTF-16 sin partir un par sustituto y
 * devuelve siempre texto bien formado.
 */
export function safeSlice(value: string, max: number): string {
  const limit = Math.max(0, Math.trunc(max));
  let cut = value.length > limit ? value.slice(0, limit) : value;
  if (cut.length > 0 && cut.length < value.length) {
    const last = cut.charCodeAt(cut.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1);
  }
  return toWellFormedText(cut);
}

/** Como `safeSlice`, pero añade «…» cuando ha recortado. */
export function truncateWithEllipsis(value: string, max: number): string {
  if (value.length <= max) return toWellFormedText(value);
  return `${safeSlice(value, Math.max(0, max - 1))}…`;
}
