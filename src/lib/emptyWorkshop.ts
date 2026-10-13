import { safeLocalStorage, type WidthStorage } from "./sidebar";

/**
 * «Empezar con el taller vacío»: la elección de no cargar la muestra de ejemplo
 * cuando la base está recién instalada.
 *
 * Al abrir un taller sin datos, el panel ofrece cargar la muestra para recorrer
 * el flujo completo. Un taller de verdad —sobre todo el que se despliega en
 * producción— no la quiere: quiere la base vacía y meter sus datos a mano. Sin
 * recordar esa elección, el aviso volvería a salir en cada visita mientras el
 * taller no tuviera nada, tapando los módulos justo cuando se estaba empezando.
 *
 * Se guarda en el navegador, no en el servidor: es una preferencia de quien
 * está mirando el panel, del mismo tipo que el ancho del menú, y en cuanto el
 * taller tenga una sola ficha deja de hacer falta.
 */

const STORAGE_KEY = "pulso:empezar-vacio";

/** ¿Se pidió empezar con el taller vacío en la última visita? */
export function readStartedEmpty(storage: WidthStorage | null): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Recuerda que se quiere el taller vacío (o lo olvida al volver a pedir la muestra). */
export function writeStartedEmpty(
  storage: WidthStorage | null,
  started: boolean,
): void {
  if (!storage) return;
  try {
    // "0" en vez de borrar la clave: el tipo mínimo de almacenamiento que usa
    // el panel (el mismo del menú lateral) no tiene `removeItem`.
    storage.setItem(STORAGE_KEY, started ? "1" : "0");
  } catch {
    // Modo privado o almacenamiento lleno: la preferencia no persiste.
  }
}

/** Atajo con el `localStorage` del navegador (o `null` si está bloqueado). */
export function readStartedEmptyFromBrowser(): boolean {
  return readStartedEmpty(safeLocalStorage());
}
