/**
 * Dominio puro de memoria unificada para el chat IA:
 * - Constructores de chunks compactos (1-2 líneas, mínimo consumo de tokens)
 * - Expansión de sinónimos técnicos del taller
 * - Ranking léxico BM25 simplificado y fusión RRF (Reciprocal Rank Fusion)
 * - Compresión de historial de conversación
 */

import { toWellFormedText, truncateWithEllipsis } from "../text";
import type { WorkshopChatTurn } from "./types";

export type AiMemoryScope = "shared" | "mailbox";

export type AiMemoryModule =
  | "incidents"
  | "equipment"
  | "parts"
  | "requests"
  | "purchasing"
  | "manuals"
  | "movements"
  | "mailbox";

export interface MemoryChunkDraft {
  scope: AiMemoryScope;
  module: AiMemoryModule;
  entityId: string;
  reference: string;
  title: string;
  compactText: string;
  tags: string[];
}

function cleanText(value: string | undefined | null, maxLen = 140): string {
  if (!value) return "";
  const flat = value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  // Recorte seguro: partir un emoji deja medio carácter que Convex rechaza.
  return truncateWithEllipsis(flat, maxLen);
}

export function formatIncidentChunk(inc: {
  id: string;
  reference: string;
  status: string;
  severity?: string;
  equipmentKind?: string;
  model?: string;
  serialNumber?: string;
  description?: string;
  resolution?: string;
}): MemoryChunkDraft {
  const equip = [inc.equipmentKind, inc.model, inc.serialNumber ? `SN:${inc.serialNumber}` : ""]
    .filter(Boolean)
    .join(" ");
  const desc = cleanText(inc.description, 120);
  const res = cleanText(inc.resolution, 100);
  const parts = [
    `[${inc.reference} | ${inc.status}${inc.severity ? ` | ${inc.severity}` : ""}]`,
    equip,
    desc,
    res ? `Resolución: ${res}` : "",
  ].filter(Boolean);

  return {
    scope: "shared",
    module: "incidents",
    entityId: inc.id,
    reference: inc.reference,
    title: equip || inc.reference,
    compactText: parts.join(" · "),
    tags: [inc.status, inc.severity ?? ""].filter(Boolean),
  };
}

export function formatEquipmentChunk(eq: {
  id: string;
  code: string;
  name: string;
  kind?: string;
  brand?: string;
  model: string;
  serialNumber?: string;
  location?: string;
  decommissionDate?: number;
}): MemoryChunkDraft {
  const state = eq.decommissionDate ? "Baja" : "Activo";
  const detail = [
    `[${eq.code} | ${state}]`,
    eq.name,
    [eq.kind, eq.brand, eq.model].filter(Boolean).join(" "),
    eq.serialNumber ? `S/N:${eq.serialNumber}` : "",
    eq.location ? `Ubic:${eq.location}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    scope: "shared",
    module: "equipment",
    entityId: eq.id,
    reference: eq.code,
    title: `${eq.name} (${eq.model})`,
    compactText: detail,
    tags: [state, eq.brand ?? "", eq.kind ?? ""].filter(Boolean),
  };
}

export function formatPartChunk(part: {
  id: string;
  code: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  unit: string;
  location?: string;
  supplier?: string;
  partNumber?: string;
}): MemoryChunkDraft {
  const stockFlag =
    part.stock <= 0 ? "Agotado" : part.stock <= part.minStock ? "Stock bajo" : "OK";
  const detail = [
    `[${part.code} | ${stockFlag}: ${part.stock}/${part.minStock} ${part.unit}]`,
    part.name,
    part.category,
    part.partNumber ? `PN:${part.partNumber}` : "",
    part.location ? `Ubic:${part.location}` : "",
    part.supplier ? `Prov:${part.supplier}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    scope: "shared",
    module: "parts",
    entityId: part.id,
    reference: part.code,
    title: part.name,
    compactText: detail,
    tags: [part.category, stockFlag],
  };
}

export function formatMailChunk(mail: {
  messageId: string;
  subject: string;
  fromName: string;
  fromAddress: string;
  snippet: string;
  tags?: string[];
}): MemoryChunkDraft {
  const sender = mail.fromName ? `${mail.fromName} <${mail.fromAddress}>` : mail.fromAddress;
  const tagText = mail.tags && mail.tags.length > 0 ? ` [${mail.tags.join(", ")}]` : "";
  return {
    scope: "mailbox",
    module: "mailbox",
    entityId: mail.messageId,
    reference: mail.messageId,
    title: toWellFormedText(mail.subject || "(Sin asunto)"),
    compactText: `Correo de ${sender}${tagText}: ${cleanText(mail.subject, 90)} — ${cleanText(mail.snippet, 120)}`,
    tags: mail.tags ?? [],
  };
}

export function formatRequestChunk(req: {
  id: string;
  reference: string;
  status: string;
  priority: string;
  requesterName: string;
  equipment?: string;
  linesSummary?: string;
}): MemoryChunkDraft {
  const detail = [
    `[${req.reference} | ${req.status} | ${req.priority}]`,
    req.requesterName,
    req.equipment ? `Equipo:${req.equipment}` : "",
    cleanText(req.linesSummary, 120),
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    scope: "shared",
    module: "requests",
    entityId: req.id,
    reference: req.reference,
    title: req.equipment || req.requesterName || req.reference,
    compactText: detail,
    tags: [req.status, req.priority],
  };
}

export function formatPurchaseOrderChunk(po: {
  id: string;
  reference: string;
  status: string;
  supplier: string;
  linesSummary?: string;
}): MemoryChunkDraft {
  const detail = [
    `[${po.reference} | ${po.status}]`,
    `Prov:${po.supplier}`,
    cleanText(po.linesSummary, 120),
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    scope: "shared",
    module: "purchasing",
    entityId: po.id,
    reference: po.reference,
    title: `${po.reference} (${po.supplier})`,
    compactText: detail,
    tags: [po.status, po.supplier],
  };
}

export function formatStockMovementChunk(mov: {
  id: string;
  partCode: string;
  partName: string;
  kind: string;
  delta: number;
  actorName: string;
  reason?: string;
}): MemoryChunkDraft {
  const signed = mov.delta > 0 ? `+${mov.delta}` : String(mov.delta);
  return {
    scope: "shared",
    module: "movements",
    entityId: mov.id,
    reference: mov.partCode,
    title: `${mov.partCode} ${mov.partName}`,
    compactText: `[Mov. stock | ${mov.kind}] ${mov.partCode} ${mov.partName} (${signed}) por ${mov.actorName}${mov.reason ? ` · ${cleanText(mov.reason, 80)}` : ""}`,
    tags: ["stock", mov.kind],
  };
}

export function formatEquipmentMovementChunk(mov: {
  id: string;
  equipmentCode?: string;
  equipmentName: string;
  kind: string;
  fromLocation?: string;
  toLocation?: string;
  actorName: string;
  note?: string;
}): MemoryChunkDraft {
  const code = mov.equipmentCode || mov.id;
  const route =
    mov.fromLocation || mov.toLocation
      ? `${mov.fromLocation ?? "—"} → ${mov.toLocation ?? "—"}`
      : "";
  return {
    scope: "shared",
    module: "movements",
    entityId: mov.id,
    reference: code,
    title: mov.equipmentName,
    compactText: `[Mov. equipo | ${mov.kind}] ${code} ${mov.equipmentName}${route ? ` (${route})` : ""} por ${mov.actorName}${mov.note ? ` · ${cleanText(mov.note, 80)}` : ""}`,
    tags: ["equipment", mov.kind],
  };
}

const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ["averia", "fallo", "roto", "error", "incidencia", "problema"],
  ["fuga", "perdida", "escape", "goteo"],
  ["sn", "serie", "serial"],
  ["repuesto", "pieza", "recambio", "componente", "material"],
  ["albaran", "entrega", "recepcion", "pedido", "compra", "factura"],
  ["equipo", "maquina", "aparato", "dispositivo"],
  ["manual", "esquema", "documentacion", "pdf", "guia"],
  ["traslado", "movimiento", "ubicacion", "cambio"],
];

export function normalizeMemoryToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9:/-]+/g, " ")
    .trim();
}

export function tokenizeMemoryText(value: string): string[] {
  const norm = normalizeMemoryToken(value);
  if (!norm) return [];
  return norm.split(/\s+/).filter((t) => t.length >= 2);
}

/**
 * Expande los términos de búsqueda con sinónimos técnicos del taller para
 * mejorar la recuperación léxica sin gastar llamadas externas de embeddings.
 */
export function expandWorkshopQuery(query: string): string[] {
  const baseTokens = tokenizeMemoryText(query);
  const expanded = new Set<string>(baseTokens);
  for (const token of baseTokens) {
    for (const group of SYNONYM_GROUPS) {
      if (group.includes(token)) {
        for (const syn of group) expanded.add(syn);
      }
    }
  }
  return [...expanded];
}

export interface RankableChunk {
  entityId: string;
  compactText: string;
  tags?: string[];
  updatedAt?: number;
}

/**
 * Ranking BM25 ligero sobre fragmentos compactos con soporte de sinónimos.
 */
export function rankMemoryChunks<T extends RankableChunk>(
  chunks: readonly T[],
  query: string,
  limit = 8,
): Array<T & { score: number }> {
  const queryTerms = expandWorkshopQuery(query);
  const baseTerms = new Set(tokenizeMemoryText(query));
  if (queryTerms.length === 0 || chunks.length === 0) return [];

  const avgLen =
    chunks.reduce((sum, c) => sum + Math.max(1, tokenizeMemoryText(c.compactText).length), 0) /
    chunks.length;
  const k1 = 1.2;
  const b = 0.75;

  const docFreq = new Map<string, number>();
  const tokenizedDocs = chunks.map((chunk) => {
    const tokens = tokenizeMemoryText(
      `${chunk.compactText} ${(chunk.tags ?? []).join(" ")}`,
    );
    const unique = new Set(tokens);
    for (const t of unique) {
      docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
    }
    return tokens;
  });

  const N = chunks.length;
  const scored: Array<T & { score: number }> = [];

  for (let i = 0; i < chunks.length; i += 1) {
    const tokens = tokenizedDocs[i]!;
    const docLen = Math.max(1, tokens.length);
    const tfMap = new Map<string, number>();
    for (const t of tokens) {
      tfMap.set(t, (tfMap.get(t) ?? 0) + 1);
    }

    let score = 0;
    for (const term of queryTerms) {
      const tf = tfMap.get(term) ?? 0;
      if (tf === 0) continue;
      const df = docFreq.get(term) ?? 1;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * docLen) / avgLen));
      const weight = baseTerms.has(term) ? 1.0 : 0.6;
      score += idf * tfNorm * weight;
    }

    if (score > 0) {
      scored.push({ ...chunks[i]!, score });
    }
  }

  scored.sort(
    (a, b) =>
      b.score - a.score || (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
  );
  return scored.slice(0, Math.max(1, limit));
}

/**
 * Reciprocal Rank Fusion (RRF) para combinar ranking léxico y vectorial.
 */
export function reciprocalRankFusion<T extends { entityId: string }>(
  lists: ReadonlyArray<readonly T[]>,
  limit = 8,
  k = 60,
): T[] {
  const scores = new Map<string, { item: T; rrf: number }>();
  for (const list of lists) {
    for (let rank = 0; rank < list.length; rank += 1) {
      const item = list[rank]!;
      const add = 1 / (k + rank + 1);
      const existing = scores.get(item.entityId);
      if (existing) {
        existing.rrf += add;
      } else {
        scores.set(item.entityId, { item, rrf: add });
      }
    }
  }
  return [...scores.values()]
    .sort((a, b) => b.rrf - a.rrf)
    .slice(0, Math.max(1, limit))
    .map((entry) => entry.item);
}

/**
 * Compresión de historial de chat para ahorrar tokens:
 * conserva intactos los últimos `keepRecent` turnos y compacta los anteriores
 * en un único mensaje de resumen breve.
 */
export function compactChatTurns(
  history: readonly WorkshopChatTurn[],
  keepRecent = 4,
): WorkshopChatTurn[] {
  if (history.length <= keepRecent) {
    return [...history];
  }
  const older = history.slice(0, history.length - keepRecent);
  const recent = history.slice(history.length - keepRecent);

  const summaryLines = older
    .map((turn) => {
      const roleLabel = turn.role === "user" ? "Usuario" : "IA";
      return `${roleLabel}: ${cleanText(turn.content, 110)}`;
    })
    .slice(-6);

  return [
    {
      role: "assistant",
      content: `[Resumen de turnos previos]\n${summaryLines.join("\n")}`,
    },
    ...recent,
  ];
}

export interface ExistingMemoryChunk<TId = string> {
  _id: TId;
  scope: AiMemoryScope;
  ownerUserId?: string;
  module: AiMemoryModule;
  entityId: string;
  reference: string;
  title: string;
  compactText: string;
  tags: readonly string[];
  embedding?: readonly number[];
}

export interface MemoryChunkDiffPlan<TId = string> {
  toInsert: MemoryChunkDraft[];
  toPatch: Array<{
    id: TId;
    draft: MemoryChunkDraft;
    /** `true` si cambió `compactText` y el embedding previo quedó obsoleto. */
    clearEmbedding: boolean;
  }>;
  toDelete: TId[];
  unchanged: number;
}

export function memoryChunkKey(chunk: {
  module: AiMemoryModule;
  entityId: string;
}): string {
  return `${chunk.module}:${chunk.entityId}`;
}

function sameStringList(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Calcula las operaciones mínimas (altas, actualizaciones y bajas) para
 * sincronizar fragmentos de memoria IA preservando los embeddings vigentes.
 */
export function planMemoryChunkDiff<TId = string>(
  existing: readonly ExistingMemoryChunk<TId>[],
  desired: readonly MemoryChunkDraft[],
): MemoryChunkDiffPlan<TId> {
  const existingByKey = new Map<string, ExistingMemoryChunk<TId>>();
  const toDelete: TId[] = [];

  for (const chunk of existing) {
    const key = memoryChunkKey(chunk);
    if (existingByKey.has(key)) {
      toDelete.push(chunk._id);
    } else {
      existingByKey.set(key, chunk);
    }
  }

  const desiredByKey = new Map<string, MemoryChunkDraft>();
  for (const draft of desired) {
    desiredByKey.set(memoryChunkKey(draft), draft);
  }

  const toInsert: MemoryChunkDraft[] = [];
  const toPatch: MemoryChunkDiffPlan<TId>["toPatch"] = [];
  let unchanged = 0;

  for (const [key, draft] of desiredByKey) {
    const prev = existingByKey.get(key);
    if (!prev) {
      toInsert.push(draft);
      continue;
    }
    existingByKey.delete(key);

    const isSame =
      prev.scope === draft.scope &&
      prev.reference === draft.reference &&
      prev.title === draft.title &&
      prev.compactText === draft.compactText &&
      sameStringList(prev.tags, draft.tags);

    if (isSame) {
      unchanged += 1;
    } else {
      toPatch.push({
        id: prev._id,
        draft,
        clearEmbedding: prev.compactText !== draft.compactText,
      });
    }
  }

  for (const prev of existingByKey.values()) {
    toDelete.push(prev._id);
  }

  return { toInsert, toPatch, toDelete, unchanged };
}
