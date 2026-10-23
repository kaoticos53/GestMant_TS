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
  if (!canArchiveIncidents && !canArchiveRequests) {
    return null;
  }

  const detailText = formatPendingDetail(pending, canArchiveSomething);

  return (
    <>
      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <BulkArchiveHeader
          cutoffMonths={cutoffMonths}
          onCutoffChange={setCutoffMonths}
        />

        <p className="mt-3 text-xs text-muted-foreground">
          Corte: anterior al <strong>{formatDate(cutoff)}</strong> · {detailText}
        </p>

        <BulkArchiveActions
          canArchiveIncidents={canArchiveIncidents}
          canArchiveRequests={canArchiveRequests}
          pending={pending}
          onSelectTarget={setBulkTarget}
          onOpenSettings={onOpenSettings}
        />
      </div>

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
