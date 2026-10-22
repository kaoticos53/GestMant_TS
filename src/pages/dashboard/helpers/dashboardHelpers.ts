export interface DashboardUserLike {
  name?: string | null;
  email?: string | null;
  isAnonymous?: boolean;
  active?: boolean;
}

/**
 * Determina el nombre a mostrar para el usuario actual o el fallback según su sesión.
 */
export function getDisplayName(user: DashboardUserLike | null | undefined): string {
  if (user?.name && user.name.trim() !== "") {
    return user.name;
  }
  if (user?.email && user.email.trim() !== "") {
    return user.email;
  }
  return user?.isAnonymous ? "Invitado" : "Responsable de repuestos";
}

/**
 * Obtiene la inicial en mayúscula para el avatar del usuario.
 */
export function getDisplayNameInitial(displayName: string): string {
  return displayName.trim().charAt(0).toUpperCase() || "R";
}

/**
 * Comprueba si la cuenta del usuario está explícitamente desactivada por un administrador.
 */
export function isAccountDeactivated(
  user: DashboardUserLike | null | undefined,
): boolean {
  return Boolean(user && user.active === false);
}

/**
 * Formatea el título del documento para la pestaña activa en el navegador.
 */
export function formatDocumentTitle(pageTitle: string): string {
  return `${pageTitle} · Pulso Taller`;
}
