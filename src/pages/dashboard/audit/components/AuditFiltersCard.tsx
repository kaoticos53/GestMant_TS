import type { AuditFiltersCardProps } from "../types";
import {
  AuditFiltersGrid,
  AuditPresetsBar,
  AuditSummaryFooter,
} from "./filters";

/** Panel de filtros por persona, tipo de movimiento, fechas y presets de auditoría. */
export function AuditFiltersCard({
  filters,
  authors,
  activePreset,
  filterCount,
  search,
  sortedCount,
  summary,
  breakdown,
  onApplyFilters,
  onApplyPreset,
  onResetFilters,
  onExport,
}: AuditFiltersCardProps) {
  return (
    <section className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <AuditFiltersGrid
        filters={filters}
        authors={authors}
        onApplyFilters={onApplyFilters}
      />

      <AuditPresetsBar
        activePreset={activePreset}
        filterCount={filterCount}
        search={search}
        sortedCount={sortedCount}
        onApplyPreset={onApplyPreset}
        onResetFilters={onResetFilters}
        onExport={onExport}
      />

      <AuditSummaryFooter
        summary={summary}
        breakdown={breakdown}
      />
    </section>
  );
}
