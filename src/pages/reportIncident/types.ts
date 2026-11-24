/**
 * Tipos y contratos para el formulario y flujo público de ReportIncident.
 */

import type { IncidentPriority } from "@/lib/workshop";

export interface ReportIncidentFormValues {
  name: string;
  email: string;
  role: string;
  location: string;
  reportedAt: string;
  priority?: IncidentPriority;
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
  priority?: IncidentPriority;
}

export interface ReportIncidentValidationResult {
  isValid: boolean;
  error: string | null;
  payload?: ReportIncidentMutationPayload;
}
