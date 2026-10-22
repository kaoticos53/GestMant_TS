/**
 * Tipos y contratos para el formulario y flujo público de ReportIncident.
 */

export interface ReportIncidentFormValues {
  name: string;
  email: string;
  role: string;
  location: string;
  reportedAt: string;
  equipmentKind: string;
  model: string;
  serialNumber: string;
  description: string;
}

export interface ReportIncidentMutationPayload {
  reporterName: string;
  reporterEmail?: string;
  reporterRole?: string;
  location?: string;
  equipmentKind?: string;
  model?: string;
  serialNumber?: string;
  description: string;
  reportedAt: number;
}

export interface ReportIncidentValidationResult {
  isValid: boolean;
  error: string | null;
  payload?: ReportIncidentMutationPayload;
}
