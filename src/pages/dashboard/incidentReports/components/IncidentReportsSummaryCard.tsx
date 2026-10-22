import { CalendarDays } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { describeAuditRange } from "@/lib/audit";
import { incidentsReportFilename, reportPeriodTitle } from "@/lib/report";
import { buildReferencePreview, buildReportsCountLabel } from "../helpers";
import type { IncidentReportsSummaryCardProps } from "../types";

export function IncidentReportsSummaryCard({
  loading,
  range,
  count,
  breakdown,
  references,
  canReadTrails,
}: IncidentReportsSummaryCardProps) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
      {loading ? (
        <Skeleton className="h-16 rounded-lg" />
      ) : (
        <>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{describeAuditRange(range)}</span>
          </p>
          <p className="mt-1.5 text-sm">
            <span className="font-medium text-foreground">
              {buildReportsCountLabel(count, breakdown)}
            </span>
          </p>
          {count > 0 && (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {buildReferencePreview(references)}
            </p>
          )}
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            {`El archivo se titula «Informes de incidencias · ${reportPeriodTitle(
              range,
            )}» y se llama `}
            <span className="font-mono">{incidentsReportFilename(range)}</span>
            . Incluye las incidencias archivadas
            {canReadTrails
              ? " y, con cada informe, el rastro de documentos de su expediente."
              : ", sin el rastro de documentos del expediente, que lee quien coordina la incidencia."}
          </p>
        </>
      )}
    </div>
  );
}
