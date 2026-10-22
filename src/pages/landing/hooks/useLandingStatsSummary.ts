import { api } from "@/convex/_generated/api";
import { formatRelativeTime } from "@/lib/workshop";
import {
  MEAN_WINDOW_DAYS,
  MIN_CLOSED_FOR_MEAN,
  formatCount,
  formatMinutes,
} from "@/lib/workshopStats";
import { useQuery } from "convex/react";
import { useMemo } from "react";

export interface PublicStatsDoc {
  equipment: number;
  spareParts: number;
  openIncidents: number;
  closedLastMonth: number;
  meanResolutionMinutes: number | null;
  computedAt: number;
}

export interface MetricFigure {
  valor: string;
  label: string;
}

export interface LandingStatsSummary {
  cifras: PublicStatsDoc | null | undefined;
  figuras: MetricFigure[];
  updateSubtitle: string;
  showMinSampleNotice: boolean;
  minClosedForMean: number;
}

/**
 * Mapea la foto pública del backend a las cuatro casillas cuantitativas.
 * Si la foto aún no está cargada o no existe, devuelve "—" de forma honesta.
 */
export function buildLandingFigures(
  cifras: PublicStatsDoc | null | undefined,
): MetricFigure[] {
  return [
    {
      valor: cifras ? formatCount(cifras.equipment) : "—",
      label: "Equipos en servicio",
    },
    {
      valor: cifras ? formatCount(cifras.spareParts) : "—",
      label: "Repuestos en catálogo",
    },
    {
      valor: cifras ? formatCount(cifras.openIncidents) : "—",
      label: "Incidencias abiertas",
    },
    {
      valor:
        cifras?.meanResolutionMinutes == null
          ? "—"
          : formatMinutes(cifras.meanResolutionMinutes),
      label: "Tiempo medio de resolución",
    },
  ];
}

/**
 * Hook para consultar y formatear las estadísticas públicas del taller
 * que se exhiben en la portada.
 */
export function useLandingStatsSummary(): LandingStatsSummary {
  const cifras = useQuery(api.publicStats.summary) as
    | PublicStatsDoc
    | null
    | undefined;

  const figuras = useMemo(() => buildLandingFigures(cifras), [cifras]);

  const updateSubtitle = useMemo(() => {
    if (!cifras) {
      return "Consultando las cifras del taller…";
    }
    return `Actualizado ${formatRelativeTime(cifras.computedAt)} · ${formatCount(cifras.closedLastMonth)} incidencias cerradas en ${MEAN_WINDOW_DAYS} días.`;
  }, [cifras]);

  const showMinSampleNotice = cifras?.meanResolutionMinutes === null;

  return {
    cifras,
    figuras,
    updateSubtitle,
    showMinSampleNotice,
    minClosedForMean: MIN_CLOSED_FOR_MEAN,
  };
}
