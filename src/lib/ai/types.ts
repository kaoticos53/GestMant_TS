/**
 * Contratos puros del sistema de IA (DeepSeek Visión + Chat) del taller.
 */

export type AiConfidence = "high" | "medium" | "low";

export type AiKeySource = "guardada" | "entorno" | "ninguna";

export interface AiSettingsPublicView {
  enabled: boolean;
  baseUrl: string;
  visionModel: string;
  chatModel: string;
  hasKey: boolean;
  keyHint: string;
  keySource: AiKeySource;
  envConfigured: boolean;
  updatedAt: number | null;
  updatedBy: string | null;
  lastTestAt: number | null;
  lastTestOk: boolean | null;
  lastTestError: string | null;
}

export interface CatalogModelHint {
  model: string;
  brand?: string;
  equipmentKind?: string;
}

export interface EquipmentLabelExtraction {
  brand?: string;
  model?: string;
  serialNumber?: string;
  equipmentKind?: string;
  confidence: AiConfidence;
  evidence?: string;
  alternatives: string[];
  warnings: string[];
  catalogMatch?: CatalogModelHint;
}

export interface IncidentContextItem {
  reference: string;
  status: string;
  equipmentKind?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  description: string;
  reportedAt: number;
  resolutionNote?: string;
}

export interface IncidentQaAnswer {
  answer: string;
  citedReferences: string[];
}

export type AiMessageContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface AiChatMessage {
  role: "system" | "user" | "assistant";
  content: string | AiMessageContentPart[];
}
