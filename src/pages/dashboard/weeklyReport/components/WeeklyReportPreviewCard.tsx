import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { WeeklyReportPreviewCardProps } from "../types";

export function WeeklyReportPreviewCard({
  preview,
}: WeeklyReportPreviewCardProps) {
  return (
    <div className="grid gap-2">
      <Label className="text-sm">El correo que saldría ahora</Label>
      {preview === undefined ? (
        <Skeleton className="h-40 rounded-lg" />
      ) : (
        <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
          <p className="text-sm font-medium">{preview.subject}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Semana del {preview.windowLabel} · {preview.counts.touched}{" "}
            incidencias con movimiento · {preview.counts.withoutTrace} sin
            constancia · {preview.counts.archived} al archivo
          </p>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-muted-foreground">
            {preview.text}
          </pre>
        </div>
      )}
      <p className="text-xs leading-5 text-muted-foreground">
        La vista previa usa los ajustes ya guardados.
      </p>
    </div>
  );
}
