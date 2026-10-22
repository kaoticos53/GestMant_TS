import type { AuditFilters, AuditPresetId } from "@/lib/audit";
import type { AuditAuthor } from "../../types";

export interface AuditFiltersGridProps {
  filters: AuditFilters;
  authors: AuditAuthor[];
  onApplyFilters: (
    next: AuditFilters | ((current: AuditFilters) => AuditFilters),
  ) => void;
}

export interface AuditPresetsBarProps {
  activePreset: string;
  filterCount: number;
  search: string;
  sortedCount: number;
  onApplyPreset: (presetId: Exclude<AuditPresetId, "custom">) => void;
  onResetFilters: () => void;
  onExport: () => void;
}

export interface AuditSummaryFooterProps {
  summary: {
    total: number;
    people: number;
    incidents: number;
  };
  breakdown: string[];
}
