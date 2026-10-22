import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { MaintenanceKind } from "@/lib/workshop";
import type { EquipmentDoc, RecordDoc } from "@/pages/dashboard/equipment/types";

export interface MaintenanceFormFieldsProps {
  kind: MaintenanceKind;
  onKindChange: (kind: MaintenanceKind) => void;
  date: string;
  onDateChange: (date: string) => void;
  title: string;
  onTitleChange: (title: string) => void;
  technician: string;
  onTechnicianChange: (technician: string) => void;
  requestId: Id<"partRequests"> | "";
  onRequestIdChange: (id: Id<"partRequests"> | "") => void;
  description: string;
  onDescriptionChange: (description: string) => void;
  requests: Doc<"partRequests">[];
  disabled?: boolean;
}

export interface MaintenanceDialogFooterProps {
  busy: boolean;
  isEdit: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

export interface UseMaintenanceFormParams {
  item: EquipmentDoc;
  record: RecordDoc | null;
  onClose: () => void;
}

export interface UseMaintenanceFormReturn {
  kind: MaintenanceKind;
  setKind: (kind: MaintenanceKind) => void;
  title: string;
  setTitle: (title: string) => void;
  date: string;
  setDate: (date: string) => void;
  technician: string;
  setTechnician: (technician: string) => void;
  description: string;
  setDescription: (description: string) => void;
  requestId: Id<"partRequests"> | "";
  setRequestId: (id: Id<"partRequests"> | "") => void;
  busy: boolean;
  error: string | null;
  isEdit: boolean;
  handleSubmit: () => Promise<void>;
}
