/** Pestañas del panel exentas del aviso de taller sin datos. */
export const EXEMPT_EMPTY_NOTICE_TABS: readonly string[] = [
  "profile",
  "permissions",
  "settings",
  "archive",
  "audit",
];

/**
 * Determina si una pestaña activa está exenta de mostrar la pantalla de bienvenida / taller vacío.
 */
export function isTabExemptFromEmptyNotice(tab: string): boolean {
  return EXEMPT_EMPTY_NOTICE_TABS.includes(tab);
}
