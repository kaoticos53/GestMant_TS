export interface RoleOption {
  key: string;
  label: string;
  description: string;
}

export interface WorkAlertSettingsData {
  days: number;
  roleKeys: string[];
  updatedAt: number | null;
  updatedBy: string | null;
}

export interface WorkAlertDaysValidation {
  isValid: boolean;
  value: number;
}

export interface WorkAlertDaysFieldProps {
  days: string;
  daysValid: boolean;
  value: number;
  disabled: boolean;
  onChangeDays: (days: string) => void;
}

export interface WorkAlertRolesListProps {
  roleOptions: RoleOption[] | undefined;
  selectedRoleKeys: string[];
  audience: string[];
  saving: boolean;
  onToggleRole: (key: string, checked: boolean) => void;
}
