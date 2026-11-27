import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/workshop";
import {
  BulkArchiveActions,
  BulkArchiveConfirmDialog,
  BulkArchiveHeader,
  formatPendingDetail,
  type BulkArchiveCardProps,
} from "./bulkArchive";

export function BulkArchiveCard({
  canArchiveIncidents,
  canArchiveRequests,
  cutoffMonths,
  setCutoffMonths,
  cutoff,
  pending,
  canArchiveSomething,
  bulkTarget,
  setBulkTarget,
  bulkBusy,
  onBulkArchive,
  onOpenSettings,
}: BulkArchiveCardProps) {
  const [expandedOverride, setExpandedOverride] = useState<boolean | null>(
    null,
  );

  if (!canArchiveIncidents && !canArchiveRequests) {
    return null;
  }

  const detailText = formatPendingDetail(pending, canArchiveSomething);
  const isExpanded = expandedOverride ?? canArchiveSomething;

  return (
    <>
      {!isExpanded ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-card px-4 py-2.5 shadow-sm">
          <p className="text-xs text-muted-foreground">
            Limpieza manual · Corte anterior al{" "}
            <strong>{formatDate(cutoff)}</strong> · {detailText}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => setExpandedOverride(true)}
          >
            Configurar corte
            <ChevronDown className="size-3.5" />
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <BulkArchiveHeader
                cutoffMonths={cutoffMonths}
                onCutoffChange={setCutoffMonths}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 gap-1 px-2 text-xs text-muted-foreground"
              onClick={() => setExpandedOverride(false)}
            >
              Ocultar
              <ChevronUp className="size-3.5" />
            </Button>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Corte: anterior al <strong>{formatDate(cutoff)}</strong> ·{" "}
            {detailText}
          </p>

          <BulkArchiveActions
            canArchiveIncidents={canArchiveIncidents}
            canArchiveRequests={canArchiveRequests}
            pending={pending}
            onSelectTarget={setBulkTarget}
            onOpenSettings={onOpenSettings}
          />
        </div>
      )}

      <BulkArchiveConfirmDialog
        target={bulkTarget}
        pending={pending}
        cutoff={cutoff}
        busy={bulkBusy}
        onClose={() => setBulkTarget(null)}
        onConfirm={() => void onBulkArchive()}
      />
    </>
  );
}

export type { BulkArchiveCardProps };
