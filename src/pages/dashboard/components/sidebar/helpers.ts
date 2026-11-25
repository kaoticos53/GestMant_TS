import { cn } from "@/lib/utils";
import type { NavBadgeKind } from "../../types";

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
export function getNavPillClass(
  active: boolean,
  kind: NavBadgeKind = "count",
): string {
  return cn(
    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums",
    active
      ? "bg-signal text-signal-foreground"
      : kind === "queue"
        ? "bg-signal/15 text-signal"
        : "bg-muted text-muted-foreground",
  );
}
