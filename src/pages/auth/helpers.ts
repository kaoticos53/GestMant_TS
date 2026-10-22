/**
 * Resuelve de forma segura la URL de redirección tras autenticarse,
 * previniendo vulnerabilidades de Open Redirect (CWE-601).
 * Solo permite rutas relativas seguras (que comiencen con '/' y no con '//').
 */
export function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
): string {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}
