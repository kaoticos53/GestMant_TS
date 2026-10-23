import type { Doc, Id } from "@/convex/_generated/dataModel";

export interface SendToExternalFormValues {
  companyName: string;
  contactName: string;
  contactPhone: string;
  includedAccessories: string;
  defectNotes: string;
  dispatchNotes: string;
}

export interface SendToExternalMutationArgs {
  incidentId: Id<"incidents">;
  companyName: string;
  contactName?: string;
  contactPhone?: string;
  includedAccessories?: string;
  defectNotes: string;
  dispatchNotes?: string;
}

export interface ExternalCompanyFieldsProps {
  companyName: string;
  setCompanyName: (value: string) => void;
  contactName: string;
  setContactName: (value: string) => void;
  contactPhone: string;
  setContactPhone: (value: string) => void;
  catalogWorkshops: Doc<"catalogs">[];
  disabled?: boolean;
}

export interface ExternalDefectFieldsProps {
  includedAccessories: string;
  setIncludedAccessories: (value: string) => void;
  defectNotes: string;
  setDefectNotes: (value: string) => void;
  dispatchNotes: string;
  setDispatchNotes: (value: string) => void;
  disabled?: boolean;
}
