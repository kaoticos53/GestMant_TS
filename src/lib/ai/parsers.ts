import type {
  AiConfidence,
  CatalogModelHint,
  EquipmentLabelExtraction,
  IncidentQaAnswer,
} from "./types";

const LABEL_PREFIX_RE =
  /^(?:model(?:\s*name|\s*no\.?)?|ref|serial(?:\s*no\.?)?|s\/n|sn)\s*(?:\([^)]*\))?\s*[:#-]?\s*/i;

function stripFieldNoise(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value
    .replace(/\s+/g, " ")
    .trim()
    .replace(LABEL_PREFIX_RE, "")
    .trim();
  return cleaned === "" ? undefined : cleaned;
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.replace(/\s+/g, " ").trim();
    if (trimmed === "" || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1]!.trim() : trimmed;
  try {
    const parsed: unknown = JSON.parse(candidate);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fallback si el modelo antepuso texto antes del JSON.
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const sliced: unknown = JSON.parse(candidate.slice(start, end + 1));
        if (
          sliced !== null &&
          typeof sliced === "object" &&
          !Array.isArray(sliced)
        ) {
          return sliced as Record<string, unknown>;
        }
      } catch {
        return null;
      }
    }
  }
  return null;
}

function isConfidence(value: unknown): value is AiConfidence {
  return value === "high" || value === "medium" || value === "low";
}

/** Valida y normaliza la respuesta JSON de extracción de etiqueta. */
export function parseEquipmentLabelResponse(
  raw: string,
): { ok: true; value: EquipmentLabelExtraction } | { ok: false; error: string } {
  const obj = extractJsonObject(raw);
  if (obj === null) {
    return {
      ok: false,
      error: "La respuesta de DeepSeek no devolvió un JSON válido.",
    };
  }

  if (obj.confidence !== undefined && !isConfidence(obj.confidence)) {
    return {
      ok: false,
      error: "El nivel de confianza devuelto por la IA no es válido.",
    };
  }

  const brand = stripFieldNoise(obj.brand);
  const model = stripFieldNoise(obj.model);
  const serialNumber = stripFieldNoise(obj.serialNumber);
  const equipmentKind = stripFieldNoise(obj.equipmentKind);
  const evidence =
    typeof obj.evidence === "string" && obj.evidence.trim() !== ""
      ? obj.evidence.trim()
      : undefined;

  const alternatives = cleanStringArray(obj.alternatives).filter(
    (alt) => alt.toLowerCase() !== (model ?? "").toLowerCase(),
  );
  const warnings = cleanStringArray(obj.warnings);

  const confidence: AiConfidence = isConfidence(obj.confidence)
    ? obj.confidence
    : model && serialNumber
      ? "medium"
      : "low";

  return {
    ok: true,
    value: {
      ...(brand !== undefined ? { brand } : {}),
      ...(model !== undefined ? { model } : {}),
      ...(serialNumber !== undefined ? { serialNumber } : {}),
      ...(equipmentKind !== undefined ? { equipmentKind } : {}),
      confidence,
      ...(evidence !== undefined ? { evidence } : {}),
      alternatives,
      warnings,
    },
  };
}

/** Busca coincidencia normalizada entre el modelo extraído/alternativas y el catálogo del taller. */
export function matchCatalogEquipmentModel(
  extracted: { model?: string; alternatives: readonly string[] },
  catalog: readonly CatalogModelHint[],
): CatalogModelHint | undefined {
  const candidates = [extracted.model, ...extracted.alternatives]
    .filter((v): v is string => Boolean(v && v.trim() !== ""))
    .map((v) => v.trim().toLowerCase());

  if (candidates.length === 0) return undefined;

  for (const candidate of candidates) {
    const match = catalog.find(
      (item) => item.model.trim().toLowerCase() === candidate,
    );
    if (match) return match;
  }
  return undefined;
}

/** Valida la respuesta del asistente de incidencias filtrando referencias existentes. */
export function parseIncidentQaResponse(
  raw: string,
  validReferences: ReadonlySet<string>,
): { ok: true; value: IncidentQaAnswer } | { ok: false; error: string } {
  const obj = extractJsonObject(raw);
  if (obj === null || typeof obj.answer !== "string") {
    return {
      ok: false,
      error: "No se pudo interpretar la respuesta del asistente de incidencias.",
    };
  }
  const answer = obj.answer.trim();
  if (answer === "") {
    return { ok: false, error: "El asistente devolvió una respuesta vacía." };
  }
  const citedReferences = cleanStringArray(obj.citedReferences).filter((ref) =>
    validReferences.has(ref),
  );
  return { ok: true, value: { answer, citedReferences } };
}
