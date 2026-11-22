/**
 * Dominio puro de autoetiquetado de correo (Zimbra): catálogo de etiquetas,
 * reglas rápidas configurables sin regex y parsing seguro de respuestas DeepSeek.
 */

export const MAIL_TAG_IDS = [
  "requests",
  "incidents",
  "equipment",
  "purchasing",
  "external_sat",
  "manuals",
  "informative",
] as const;

export type MailTagId = (typeof MAIL_TAG_IDS)[number];

export type MailTagSource = "rule" | "ai_headers" | "ai_body" | "manual";

export const MAIL_TRIAGE_BODY_THRESHOLD = 0.72;

export interface MailTagMeta {
  id: MailTagId;
  label: string;
  description: string;
  badgeClassName: string;
}

export const MAIL_TAG_META: Record<MailTagId, MailTagMeta> = {
  requests: {
    id: "requests",
    label: "Peticiones",
    description:
      "Posibles peticiones de material, repuestos, consumibles o referencias.",
    badgeClassName:
      "border-sky-600/25 bg-sky-600/10 text-sky-700 dark:text-sky-300",
  },
  incidents: {
    id: "incidents",
    label: "Incidencias",
    description:
      "Avisos de avería, fallos de equipos, paradas o revisiones urgentes.",
    badgeClassName:
      "border-destructive/30 bg-destructive/10 text-destructive",
  },
  equipment: {
    id: "equipment",
    label: "Equipos",
    description:
      "Referencias a equipos y números de serie (S/N) susceptibles de añadir al inventario.",
    badgeClassName:
      "border-violet-600/25 bg-violet-600/10 text-violet-700 dark:text-violet-300",
  },
  purchasing: {
    id: "purchasing",
    label: "Compras",
    description:
      "Presupuestos de proveedores, pedidos (OC), envíos o albaranes.",
    badgeClassName:
      "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  external_sat: {
    id: "external_sat",
    label: "SAT externo",
    description:
      "Comunicaciones con servicios técnicos externos, RMAs o reparaciones fuera del taller.",
    badgeClassName:
      "border-indigo-600/25 bg-indigo-600/10 text-indigo-700 dark:text-indigo-300",
  },
  manuals: {
    id: "manuals",
    label: "Manuales",
    description:
      "Documentación técnica adjunta: manuales PDF, esquemas o firmware.",
    badgeClassName:
      "border-emerald-600/25 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300",
  },
  informative: {
    id: "informative",
    label: "Informativo",
    description:
      "Boletines, avisos generales o notificaciones automáticas sin acción.",
    badgeClassName: "border-border bg-muted text-muted-foreground",
  },
};

export type MailTagConditionField =
  | "from_any"
  | "from_address"
  | "subject"
  | "subject_or_snippet"
  | "has_attachments";

export type MailTagConditionOperator =
  | "contains"
  | "domain_is"
  | "is_true"
  | "is_false";

export interface MailTagCondition {
  field: MailTagConditionField;
  operator: MailTagConditionOperator;
  value: string;
}

export type MailTagMatchMode = "all" | "any";

export interface MailTagRule {
  id?: string;
  name: string;
  enabled: boolean;
  priority: number;
  matchMode: MailTagMatchMode;
  conditions: MailTagCondition[];
  tags: MailTagId[];
}

export interface MailHeaderTagInput {
  messageId: string;
  subject: string;
  fromName: string;
  fromAddress: string;
  snippet: string;
  hasAttachments: boolean;
}

export const MAIL_TAG_FIELD_LABELS: Record<MailTagConditionField, string> = {
  from_any: "El remitente (nombre o correo)",
  from_address: "La dirección del remitente",
  subject: "El asunto",
  subject_or_snippet: "El asunto o el extracto",
  has_attachments: "Tiene archivos adjuntos",
};

export const MAIL_TAG_OPERATOR_LABELS: Record<MailTagConditionOperator, string> = {
  contains: "contiene",
  domain_is: "pertenece al dominio",
  is_true: "sí",
  is_false: "no",
};

export const MAIL_TAG_RULE_PRESETS: Array<Omit<MailTagRule, "id" | "priority">> = [
  {
    name: "Notificaciones automáticas (noreply)",
    enabled: true,
    matchMode: "any",
    conditions: [
      { field: "from_address", operator: "contains", value: "noreply" },
      { field: "from_address", operator: "contains", value: "no-reply" },
    ],
    tags: ["informative"],
  },
  {
    name: "Averías e incidencias de equipos",
    enabled: true,
    matchMode: "any",
    conditions: [
      { field: "subject_or_snippet", operator: "contains", value: "avería" },
      { field: "subject_or_snippet", operator: "contains", value: "fallo" },
      { field: "subject_or_snippet", operator: "contains", value: "incidencia" },
    ],
    tags: ["incidents"],
  },
  {
    name: "Equipos con número de serie (S/N)",
    enabled: true,
    matchMode: "any",
    conditions: [
      { field: "subject_or_snippet", operator: "contains", value: "S/N" },
      { field: "subject_or_snippet", operator: "contains", value: "nº serie" },
      { field: "subject_or_snippet", operator: "contains", value: "número de serie" },
    ],
    tags: ["equipment"],
  },
  {
    name: "Albaranes, facturas y pedidos de compra",
    enabled: true,
    matchMode: "any",
    conditions: [
      { field: "subject_or_snippet", operator: "contains", value: "albarán" },
      { field: "subject_or_snippet", operator: "contains", value: "factura" },
      { field: "subject_or_snippet", operator: "contains", value: "presupuesto" },
    ],
    tags: ["purchasing"],
  },
];

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Permite escribir palabras clave separadas por comas en una sola condición
 * (p. ej. "avería, fallo, roto") para mayor comodidad del usuario.
 */
function splitTerms(value: string): string[] {
  return value
    .split(",")
    .map((part) => normalizeText(part))
    .filter((part) => part !== "");
}

function matchesCondition(
  header: MailHeaderTagInput,
  condition: MailTagCondition,
): boolean {
  if (condition.field === "has_attachments") {
    return condition.operator === "is_false"
      ? !header.hasAttachments
      : header.hasAttachments;
  }

  const terms = splitTerms(condition.value);
  if (terms.length === 0) return false;

  if (condition.operator === "domain_is") {
    const email = normalizeText(header.fromAddress);
    const domainPart = email.includes("@") ? email.split("@")[1] ?? "" : email;
    return terms.some((term) => {
      const clean = term.startsWith("@") ? term.slice(1) : term;
      return domainPart === clean || domainPart.endsWith(`.${clean}`);
    });
  }

  let haystack = "";
  if (condition.field === "from_address") {
    haystack = normalizeText(header.fromAddress);
  } else if (condition.field === "from_any") {
    haystack = normalizeText(`${header.fromName} ${header.fromAddress}`);
  } else if (condition.field === "subject") {
    haystack = normalizeText(header.subject);
  } else if (condition.field === "subject_or_snippet") {
    haystack = normalizeText(`${header.subject} ${header.snippet}`);
  }

  return terms.some((term) => haystack.includes(term));
}

export function ruleMatchesHeader(
  header: MailHeaderTagInput,
  rule: MailTagRule,
): boolean {
  if (rule.conditions.length === 0 || rule.tags.length === 0) return false;
  if (rule.matchMode === "all") {
    return rule.conditions.every((cond) => matchesCondition(header, cond));
  }
  return rule.conditions.some((cond) => matchesCondition(header, cond));
}

export interface RuleMatchResult {
  tags: MailTagId[];
  matchedRuleName: string;
  reason: string;
}

/**
 * Evalúa las reglas rápidas activas en orden de prioridad.
 * Devuelve la primera regla coincidente o null si ninguna aplica.
 */
export function evaluateMailTagRules(
  header: MailHeaderTagInput,
  rules: readonly MailTagRule[],
): RuleMatchResult | null {
  const ordered = [...rules]
    .filter((rule) => rule.enabled && rule.tags.length > 0)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of ordered) {
    if (ruleMatchesHeader(header, rule)) {
      const validTags = sanitizeMailTags(rule.tags);
      if (validTags.length === 0) continue;
      return {
        tags: validTags,
        matchedRuleName: rule.name,
        reason: `Regla rápida: ${rule.name}`,
      };
    }
  }
  return null;
}

export function sanitizeMailTags(raw: readonly string[]): MailTagId[] {
  const allowed = new Set<string>(MAIL_TAG_IDS);
  const unique: MailTagId[] = [];
  for (const item of raw) {
    const clean = item.trim() as MailTagId;
    if (allowed.has(clean) && !unique.includes(clean)) {
      unique.push(clean);
    }
  }
  return unique.slice(0, 3);
}

export interface MailTriagePrediction {
  messageId: string;
  tags: MailTagId[];
  confidence: number;
  needsBody: boolean;
  reason: string;
}

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.5;
  return Math.min(1, Math.max(0, Math.round(value * 100) / 100));
}

function normalizePredictionItem(raw: unknown): MailTriagePrediction | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.messageId !== "string" || obj.messageId.trim() === "") {
    return null;
  }
  const rawTags = Array.isArray(obj.tags)
    ? obj.tags.filter((t): t is string => typeof t === "string")
    : [];
  const tags = sanitizeMailTags(rawTags);
  const confidence = clampConfidence(obj.confidence);
  const needsBody =
    typeof obj.needsBody === "boolean"
      ? obj.needsBody
      : confidence < MAIL_TRIAGE_BODY_THRESHOLD || tags.length === 0;
  const reason =
    typeof obj.reason === "string" && obj.reason.trim() !== ""
      ? obj.reason.trim().slice(0, 180)
      : "Clasificación automática por IA";

  return {
    messageId: obj.messageId.trim(),
    tags,
    confidence,
    needsBody,
    reason,
  };
}

export function parseMailTriageBatchResponse(
  rawJson: string,
  validIds: ReadonlySet<string>,
): MailTriagePrediction[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return [];
  }
  const list =
    parsed && typeof parsed === "object" && Array.isArray((parsed as { items?: unknown }).items)
      ? (parsed as { items: unknown[] }).items
      : Array.isArray(parsed)
        ? parsed
        : [];

  const results: MailTriagePrediction[] = [];
  for (const entry of list) {
    const item = normalizePredictionItem(entry);
    if (item && validIds.has(item.messageId)) {
      results.push(item);
    }
  }
  return results;
}

export function parseMailTriageSingleResponse(
  rawJson: string,
  fallbackMessageId: string,
): MailTriagePrediction | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  return normalizePredictionItem({
    ...obj,
    messageId:
      typeof obj.messageId === "string" && obj.messageId.trim() !== ""
        ? obj.messageId
        : fallbackMessageId,
  });
}
