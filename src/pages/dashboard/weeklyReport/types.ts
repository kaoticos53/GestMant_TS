export interface RoleOption {
  key: string;
  label: string;
  description: string;
}

export interface WeeklyReportPreview {
  subject: string;
  windowLabel: string;
  counts: {
    touched: number;
    withoutTrace: number;
    archived: number;
  };
  text: string;
  recipients: string[];
}

export interface WeeklyReportHistoryItem {
  key: string;
  subject: string;
  status: string;
  recipients: string[];
  sentAt?: number | null;
  error?: string | null;
}

export interface WeeklyReportScheduleFieldsProps {
  enabled: boolean;
  weekday: string;
  disabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onWeekdayChange: (weekday: string) => void;
}

export interface WeeklyReportRoleAudienceProps {
  roleOptions: RoleOption[] | undefined;
  roleKeys: string[];
  recipients: string[];
  lastSentAt?: number | null;
  saving: boolean;
  onToggleRole: (key: string, checked: boolean) => void;
}

export interface WeeklyReportPreviewCardProps {
  preview: WeeklyReportPreview | undefined;
}

export interface WeeklyReportHistoryListProps {
  history: WeeklyReportHistoryItem[];
}

export interface WeeklyReportDialogFooterProps {
  sending: boolean;
  saving: boolean;
  settingsLoaded: boolean;
  rolesLoaded: boolean;
  onClose: () => void;
  onSendNow: () => void;
  onSave: () => void;
}
