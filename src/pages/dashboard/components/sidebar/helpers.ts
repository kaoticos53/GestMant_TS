import { cn } from "@/lib/utils";

/**
 * Devuelve las clases CSS del botón de navegación en la barra lateral según si está activo.
 */
export function getNavButtonClass(active: boolean): string {
  return cn(
    "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors",
    active
      ? "border-signal/30 bg-signal/10 text-signal"
      : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

/**
 * Devuelve las clases CSS de la insignia/píldora con el conteo de elementos para un botón de navegación.
 */
export function getNavPillClass(active: boolean): string {
  return cn(
    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
    active
      ? "bg-signal text-primary-foreground"
      : "bg-muted text-muted-foreground",
  );
}
