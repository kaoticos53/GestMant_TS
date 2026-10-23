export interface AutoOption {
  months: number;
  label: string;
}

export interface AutomaticArchiveHeaderProps {
  enabled: boolean;
  isLoading: boolean;
  disabled: boolean;
  onToggle: (checked: boolean) => void;
}

export interface AutomaticArchiveControlsProps {
  autoMonths: number;
  autoOptions: readonly AutoOption[];
  disabled: boolean;
  running: boolean;
  pendingTotal: number;
  onChangeMonths: (months: number) => void;
  onRunNow: () => void;
}
