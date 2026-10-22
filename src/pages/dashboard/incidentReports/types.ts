import type { Doc } from "@/convex/_generated/dataModel";
import type { REPORT_PERIODS, ReportPeriodBasis } from "@/lib/report";

export type IncidentDoc = Doc<"incidents">;
export type EquipmentDoc = Doc<"equipment">;
export type PartRequestDoc = Doc<"partRequests">;

export interface IncidentReportsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment?: EquipmentDoc[];
  requests?: PartRequestDoc[];
  canReadTrails?: boolean;
  currentUserName: string;
}

export interface IncidentReportsPeriodPresetsProps {
  activePreset: (typeof REPORT_PERIODS)[number]["id"] | null;
  onSelectPreset: (presetId: (typeof REPORT_PERIODS)[number]["id"]) => void;
}

export interface IncidentReportsDateRangeFieldsProps {
  from: string;
  to: string;
  basis: ReportPeriodBasis;
  onChangeFrom: (value: string) => void;
  onChangeTo: (value: string) => void;
  onChangeBasis: (value: ReportPeriodBasis) => void;
}

export interface IncidentReportsSummaryCardProps {
  loading: boolean;
  range: { from: number | null; to: number | null };
  count: number;
  breakdown: string[];
  references: string[];
  canReadTrails: boolean;
}

export interface IncidentReportsFooterProps {
  loading: boolean;
  count: number;
  trailsPending: boolean;
  onCancel: () => void;
  onExport: () => void;
}
