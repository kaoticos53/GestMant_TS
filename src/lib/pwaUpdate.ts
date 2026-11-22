/**
 * El aviso de «hay una versión nueva».
 *
 * La aplicación no se recarga sola. Cuando el service worker deja lista la
 * compilación nueva se avisa —con el número de build que sirve la pestaña a la
 * vista— y recarga quien quiere. Recargar por detrás a media tarea perdía lo que
 * se estaba escribiendo; y, sobre todo, dejaba depurar una interfaz que no
 * cambiaba porque el navegador servía otra compilación sin decirlo.
 *
 * Vive fuera de React para que el registro del service worker (`main.tsx`) no
 * tenga que estar dentro de un componente; el aviso se suscribe con
 * `useSyncExternalStore`.
 */

let ready = false;
let applyUpdate: (() => void) | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** ¿Hay una compilación nueva esperando a que alguien recargue? */
export function isUpdateReady(): boolean {
  return ready;
}

/** Suscribe el aviso a los cambios de estado; devuelve cómo darse de baja. */
export function subscribeUpdateReady(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** El service worker ya tiene la compilación nueva y sabe cómo activarla. */
export function offerUpdate(apply: () => void): void {
  applyUpdate = apply;
  ready = true;
  emit();
}

/** «Luego»: el aviso se va; la compilación nueva entra en la próxima apertura. */
export function dismissUpdate(): void {
  ready = false;
  emit();
}

/** Activa la compilación nueva, que recarga la pestaña. */
export function applyOfferedUpdate(): void {
  applyUpdate?.();
}
