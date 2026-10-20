/**
 * Densidad de una cola: cuánta información enseña cada ficha.
 *
 * Va aquí, y no en los componentes, porque es una preferencia que se recuerda
 * entre visitas y hay dos colas que la comparten (incidencias y peticiones):
 * quien trabaja en el taller no quiere elegirla otra vez cada mañana. La
 * aritmética y el almacenamiento son los mismos que los del ancho del menú
 * (`lib/sidebar`), sin React ni Convex, para poder probarlo en memoria.
 */

/** Las dos formas de una ficha: con todo el texto o solo lo justo. */
export type Density = "comfortable" | "compact";

/**
 * Con lo que abre una cola la primera vez: **compacta**. La cola es una lista de
 * trabajo —qué hay, de qué equipo, quién lo lleva— y con la vista cómoda caben
 * dos fichas por pantalla, así que encontrar algo obligaba a pasar páginas.
 * Quien quiera el detalle largo lo tiene a un clic, y la preferencia se recuerda.
 */
export const DEFAULT_QUEUE_DENSITY: Density = "compact";

const STORAGE_KEY = "pulso:queue-density";

/** Tipo mínimo de almacenamiento: sirve `localStorage` y un doble en los tests. */
export interface DensityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** La densidad guardada, o `null` si no hay ninguna o no se entiende. */
export function readDensity(storage: DensityStorage | null): Density | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === "compact" || raw === "comfortable") return raw;
    return null;
  } catch {
    return null;
  }
}

/** Guarda la densidad elegida; si el navegador no deja, se sigue usando igual. */
export function writeDensity(
  storage: DensityStorage | null,
  density: Density,
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, density);
  } catch {
    // Modo privado o almacenamiento lleno: la preferencia no persiste.
  }
}

/** La densidad con la que abre una cola: la guardada o la de partida. */
export function initialQueueDensity(storage: DensityStorage | null): Density {
  return readDensity(storage) ?? DEFAULT_QUEUE_DENSITY;
}

/** La otra densidad: la que se pone al pulsar el conmutador. */
export function otherDensity(density: Density): Density {
  return density === "compact" ? "comfortable" : "compact";
}
