/**
 * Contratos puros del sistema de IA (DeepSeek Visión + Chat) del taller.
 */

export type AiConfidence = "high" | "medium" | "low";

export type AiKeySource = "guardada" | "entorno" | "ninguna";

export type AiTaskId =
  | "label_scanner"
  | "incident_qa"
  | "workshop_chat"
  | "mail_triage";

export type AiToolModule =
  | "equipment"
  | "incidents"
  | "requests"
  | "purchasing"
  | "parts"
  | "manuals";

export interface AiTaskParamConfig {
  temperature: number;
  maxTokens: number;
  customPrompt?: string;
}

export interface AiTasksEnabledConfig {
  labelScanner: boolean;
  incidentQa: boolean;
  workshopChat: boolean;
}

export interface AiVariableDefinition {
  key: string;
  label: string;
  description: string;
  scope: "prompt" | "chat" | "ambos";
  example: string;
}

export interface AiToolDefinition {
  type: "function";
  module: AiToolModule | "core";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<
        string,
        {
          type: string;
          description: string;
          enum?: string[];
        }
      >;
      required?: string[];
    };
  };
}

export interface AiToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

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
  tasks?: AiTasksEnabledConfig;
  rateLimitPerHour?: number;
  allowedRoles?: string[];
  enabledModules?: AiToolModule[];
  taskParams?: Record<AiTaskId, AiTaskParamConfig>;
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
  technicalDetails?: string[];
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

export interface WorkshopChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface WorkshopContextSnapshot {
  counts: {
    equipment: number;
    incidents: number;
    openIncidents: number;
    spareParts: number;
    lowStockParts: number;
    partRequests: number;
    purchaseOrders: number;
  };
  equipment: Array<{
    code?: string;
    name: string;
    brand?: string;
    model: string;
    serialNumber?: string;
    location?: string;
    decommissioned?: boolean;
  }>;
  incidents: IncidentContextItem[];
  spareParts: Array<{
    code: string;
    name: string;
    category: string;
    stock: number;
    minStock: number;
    unit: string;
    location?: string;
  }>;
  partRequests: Array<{
    reference: string;
    status: string;
    priority: string;
    requesterName: string;
    equipment?: string;
    summary: string;
  }>;
  purchaseOrders: Array<{
    reference: string;
    status: string;
    supplier: string;
    orderedAt: number;
    itemsCount: number;
  }>;
}

export interface AiDebugToolTrace {
  name: string;
  arguments: string;
  resultPreview: string;
}

export interface AiDebugTraceEntry {
  round: number;
  endpoint: string;
  model: string;
  temperature: number;
  maxTokens: number;
  toolNames: string[];
  messages: AiChatMessage[];
  responseStatus: number;
  finishReason: string | null;
  rawContent: string;
  reasoningContent?: string;
  toolCalls?: AiDebugToolTrace[];
  durationMs: number;
}

export interface WorkshopQaAnswer {
  answer: string;
  citedReferences: string[];
  usedTools?: string[];
  debugTrace?: AiDebugTraceEntry[];
}

export type AiMessageContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface AiChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | AiMessageContentPart[] | null;
  tool_calls?: AiToolCall[];
  tool_call_id?: string;
}
