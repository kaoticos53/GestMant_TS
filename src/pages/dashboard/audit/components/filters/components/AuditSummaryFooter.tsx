import { formatSummaryDetails, formatTotalMovements } from "../helpers";
import type { AuditSummaryFooterProps } from "../types";

export function AuditSummaryFooter({
  summary,
  breakdown,
}: AuditSummaryFooterProps) {
  if (summary.total === 0) {
    return (
      <p className="mt-3 border-t border-border/60 pt-3 text-xs leading-5 text-muted-foreground">
        Ningún movimiento con estos filtros.
      </p>
    );
  }

  const totalText = formatTotalMovements(summary.total);
  const detailsText = formatSummaryDetails(
    summary.people,
    summary.incidents,
    breakdown,
  );

  return (
    <p className="mt-3 border-t border-border/60 pt-3 text-xs leading-5 text-muted-foreground">
      <span className="font-medium text-foreground">{totalText}</span>
      {detailsText}
    </p>
  );
}
