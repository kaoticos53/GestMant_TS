import type { Priority } from "@/lib/workshop";
import type { EquipmentDoc, PartDoc } from "../../types";

export interface NewRequestDialogProps {
  parts: PartDoc[];
  equipment: EquipmentDoc[];
  onClose: () => void;
}

export interface RequestHeaderFieldsProps {
  requesterName: string;
  onRequesterNameChange: (value: string) => void;
  requesterTeam: string;
  onRequesterTeamChange: (value: string) => void;
  catalogPositions: Array<{ _id: string; name: string }>;
  priority: Priority;
  onPriorityChange: (value: Priority) => void;
  disabled?: boolean;
}

export interface RequestDescriptionFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export interface RequestNotesFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export interface RequestDialogFooterProps {
  busy: boolean;
  isUploading: boolean;
  onClose: () => void;
  onSubmit: () => void;
}
