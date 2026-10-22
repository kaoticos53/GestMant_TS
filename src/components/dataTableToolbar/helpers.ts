import { LayoutList, Rows3 } from "lucide-react";
import type { Density } from "@/lib/density";
import type { DensityOption } from "./types";

export const DENSITY_OPTIONS: readonly DensityOption[] = [
  {
    id: "comfortable",
    label: "Cómoda",
    icon: LayoutList,
    compactValue: false,
    description: "Fichas o filas cómodas con espaciado amplio",
  },
  {
    id: "compact",
    label: "Compacta",
    icon: Rows3,
    compactValue: true,
    description: "Fichas o filas más compactas",
  },
] as const;

/**
 * Normaliza el estado de densidad soportando tanto la prop booleana `compact`
 * como la prop tipada `density: "comfortable" | "compact"`.
 */
export function resolveIsCompact(
  compact?: boolean,
  density?: Density,
): boolean | undefined {
  if (compact !== undefined) {
    return compact;
  }
  if (density !== undefined) {
    return density === "compact";
  }
  return undefined;
}

/**
 * Determina si el control de densidad debe mostrarse en la barra de herramientas.
 */
export function shouldShowDensity(
  isCompact: boolean | undefined,
  hasDensityCallback: boolean,
): boolean {
  return isCompact !== undefined && hasDensityCallback;
}
