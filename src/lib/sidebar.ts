/**
 * Panel lateral del panel de control (escritorio): ancho ajustable arrastrando
 * su borde o con las flechas del teclado, recordado entre sesiones. La
 * aritmética vive aquí, fuera del componente, para poder probarla sin navegador
 * (mismo criterio que `chatPanel.ts`).
 */

/** Ancho con el que se abre el panel la primera vez. */
export const SIDEBAR_WIDTH_DEFAULT = 296;
/** Por debajo de esto el menú deja de caber; por encima del máximo, el contenido se ahoga. */
export const SIDEBAR_WIDTH_MIN = 208;
export const SIDEBAR_WIDTH_MAX = 520;
/** Cuánto cambia cada pulsación de flecha. */
export const SIDEBAR_WIDTH_STEP = 16;
/** En ventanas estrechas el panel nunca ocupa más de esta proporción. */
const VIEWPORT_RATIO_MAX = 0.4;

const STORAGE_KEY = "pulso:sidebar-width";
const COLLAPSED_KEY = "pulso:sidebar-collapsed";

/** Tipo mínimo de almacenamiento: sirve `localStorage` y un doble en los tests. */
export interface WidthStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** `localStorage` del navegador, o `null` si el navegador lo bloquea. */
export function safeLocalStorage(): WidthStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Ancho máximo admitido en una ventana dada (nunca por debajo del mínimo). */
export function maxSidebarWidth(viewportWidth: number): number {
  const fromViewport = Number.isFinite(viewportWidth)
    ? Math.floor(viewportWidth * VIEWPORT_RATIO_MAX)
    : SIDEBAR_WIDTH_MAX;
  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, fromViewport));
}

/** Ajusta el ancho pedido a los límites vigentes en esta ventana. */
export function clampSidebarWidth(width: number, viewportWidth: number): number {
  if (!Number.isFinite(width)) return SIDEBAR_WIDTH_DEFAULT;
  return Math.min(
    Math.max(Math.round(width), SIDEBAR_WIDTH_MIN),
    maxSidebarWidth(viewportWidth),
  );
}

/** Ancho guardado en el navegador (`null` si no hay ninguno o no es un número). */
export function readSidebarWidth(storage: WidthStorage | null): number | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Guarda el ancho elegido; si el navegador no deja, se sigue usando igual. */
export function writeSidebarWidth(
  storage: WidthStorage | null,
  width: number,
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, String(Math.round(width)));
  } catch {
    // Modo privado o almacenamiento lleno: la preferencia no persiste.
  }
}

/** ¿El menú quedó plegado en la última visita? */
export function readSidebarCollapsed(storage: WidthStorage | null): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Recuerda si el menú está plegado (se guarda junto al ancho, sin borrarlo). */
export function writeSidebarCollapsed(
  storage: WidthStorage | null,
  collapsed: boolean,
): void {
  if (!storage) return;
  try {
    storage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    // Modo privado o almacenamiento lleno: la preferencia no persiste.
  }
}
