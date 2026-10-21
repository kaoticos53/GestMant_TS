/**
 * Lógica pura de normalización, cálculo de distancias y concordancia de cadenas
 * para el sistema de autocompletado y prevención de erratas ortográficas.
 *
 * NOTA DE ARQUITECTURA:
 * Este archivo pertenece a `src/lib/`. Está terminantemente prohibido importar
 * React o Convex aquí. Se valida automáticamente en `tests/arquitectura.test.ts`.
 */

export type CatalogKind =
  | "brand"
  | "equipmentLocation"
  | "partLocation"
  | "supplier"
  | "position"
  | "partCategory"
  | "externalWorkshop";

export interface CatalogItemLike {
  name: string;
  normalized?: string;
}

export interface SimilarityMatch<T extends CatalogItemLike = CatalogItemLike> {
  item: T;
  distance: number;
  similarity: number; // 0.0 a 1.0 (1.0 = idéntico)
}

/** Metadatos descriptivos de cada catálogo en castellano. */
export const CATALOG_KIND_LABELS: Record<
  CatalogKind,
  { label: string; singular: string; placeholder: string }
> = {
  brand: {
    label: "Marcas",
    singular: "Marca",
    placeholder: "ej. Sony, Panasonic, Canon...",
  },
  equipmentLocation: {
    label: "Ubicaciones de equipos",
    singular: "Ubicación de equipo",
    placeholder: "ej. Plató 1, Control Central, Unidad Móvil...",
  },
  partLocation: {
    label: "Ubicaciones de repuestos (Almacén)",
    singular: "Ubicación en almacén",
    placeholder: "ej. Estantería A-01, Cajón B-03, Armario 2...",
  },
  supplier: {
    label: "Proveedores",
    singular: "Proveedor",
    placeholder: "ej. Farnell, RS Components, Moncada...",
  },
  position: {
    label: "Puestos de trabajo",
    singular: "Puesto",
    placeholder: "ej. Realización, Audio, Cámaras, Iluminación...",
  },
  partCategory: {
    label: "Categorías de repuestos",
    singular: "Categoría",
    placeholder: "ej. Electrónica, Mecánica, Conectividad...",
  },
  externalWorkshop: {
    label: "Empresas externas y SAT",
    singular: "Empresa externa / SAT",
    placeholder: "ej. Servicio Técnico Oficial Sony, Talleres AudioPro...",
  },
};

/**
 * Normaliza una cadena para comparaciones insensibles a mayúsculas, acentos,
 * signos de puntuación periféricos y espacios superfluos.
 *
 * Ejemplos:
 * - "   Panasónic   " -> "panasonic"
 * - "Plató 1" -> "plato 1"
 * - "Hewlett-Packard" -> "hewlett-packard"
 */
export function normalizeCatalogString(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Calcula la distancia Damerau-Levenshtein óptima entre dos cadenas.
 * Contempla inserción, eliminación, sustitución y transposición adyacente de caracteres
 * (muy frecuente en errores de tipeo mecánicos, ej. "Sney" -> "Sony", "Canno" -> "Canon").
 */
export function damerauLevenshteinDistance(source: string, target: string): number {
  const s = normalizeCatalogString(source);
  const t = normalizeCatalogString(target);

  if (s === t) return 0;
  if (s.length === 0) return t.length;
  if (t.length === 0) return s.length;

  const sLen = s.length;
  const tLen = t.length;

  // Matriz de distancia (sLen + 2) x (tLen + 2)
  const maxDist = sLen + tLen;
  const da: Record<string, number> = {};
  const d: number[][] = Array.from({ length: sLen + 2 }, () =>
    new Array<number>(tLen + 2).fill(0),
  );

  d[0][0] = maxDist;
  for (let i = 0; i <= sLen; i++) {
    d[i + 1][0] = maxDist;
    d[i + 1][1] = i;
  }
  for (let j = 0; j <= tLen; j++) {
    d[0][j + 1] = maxDist;
    d[1][j + 1] = j;
  }

  for (let i = 1; i <= sLen; i++) {
    let db = 0;
    for (let j = 1; j <= tLen; j++) {
      const i1 = da[t[j - 1]] || 0;
      const j1 = db;
      let cost = 1;
      if (s[i - 1] === t[j - 1]) {
        cost = 0;
        db = j;
      }

      d[i + 1][j + 1] = Math.min(
        d[i][j + 1] + 1, // eliminación
        d[i + 1][j] + 1, // inserción
        d[i][j] + cost, // sustitución
        d[i1][j1] + (i - i1 - 1) + 1 + (j - j1 - 1), // transposición
      );
    }
    da[s[i - 1]] = i;
  }

  return d[sLen + 1][tLen + 1];
}

/**
 * Coeficiente de similitud entre 0.0 y 1.0 basado en la distancia de edición normalizada.
 * 1.0 = idéntico (tras normalización de acentos/mayúsculas).
 */
export function calculateSimilarity(source: string, target: string): number {
  const s = normalizeCatalogString(source);
  const t = normalizeCatalogString(target);
  if (s === t) return 1.0;
  const maxLen = Math.max(s.length, t.length);
  if (maxLen === 0) return 1.0;
  const dist = damerauLevenshteinDistance(s, t);
  return Math.max(0, 1 - dist / maxLen);
}

export interface MatchAnalysisResult<T extends CatalogItemLike> {
  exactMatch: T | null;
  /** Mejor sugerencia si es una posible errata / muy parecido pero no idéntico. */
  bestTypoSuggestion: SimilarityMatch<T> | null;
  /** Lista ordenada de sugerencias que contienen o se asemejan al texto ingresado. */
  suggestions: SimilarityMatch<T>[];
}

/**
 * Analiza un valor de entrada respecto a un catálogo existente:
 * - Detecta coincidencias exactas (insensible a acentos/mayúsculas).
 * - Identifica si el usuario cometió una errata cercana (ej. "Panasnic" frente a "Panasonic")
 *   y sugiere el término canónico.
 * - Filtra y ordena las mejores opciones para el desplegable de autocompletado.
 */
export function analyzeInputMatches<T extends CatalogItemLike>(
  input: string,
  catalog: readonly T[],
  options: {
    minTypoSimilarity?: number; // Por defecto 0.70
    maxResults?: number; // Por defecto 8
  } = {},
): MatchAnalysisResult<T> {
  const normInput = normalizeCatalogString(input);
  if (!normInput) {
    return {
      exactMatch: null,
      bestTypoSuggestion: null,
      suggestions: catalog.slice(0, options.maxResults ?? 8).map((item) => ({
        item,
        distance: 0,
        similarity: 1,
      })),
    };
  }

  const minTypoSimilarity = options.minTypoSimilarity ?? 0.7;
  const maxResults = options.maxResults ?? 8;

  let exactMatch: T | null = null;
  const scoredMatches: SimilarityMatch<T>[] = [];

  for (const item of catalog) {
    const itemNorm = item.normalized || normalizeCatalogString(item.name);
    if (!exactMatch && itemNorm === normInput) {
      exactMatch = item;
    }

    const dist = damerauLevenshteinDistance(normInput, itemNorm);
    const sim = calculateSimilarity(normInput, itemNorm);

    // Consideramos coincidencia si contiene la subcadena o si la similitud es alta
    const containsSubstr = itemNorm.includes(normInput) || normInput.includes(itemNorm);
    if (containsSubstr || sim >= 0.5 || dist <= 2) {
      // Si contiene como prefijo o subcadena, bonificamos la relevancia en la lista
      const bonus = itemNorm.startsWith(normInput)
        ? 0.3
        : containsSubstr
          ? 0.15
          : 0;
      const combinedScore = Math.min(1.0, sim + bonus);

      scoredMatches.push({
        item,
        distance: dist,
        similarity: combinedScore,
      });
    }
  }

  // Ordenar de mayor similitud a menor
  scoredMatches.sort((a, b) => b.similarity - a.similarity);

  // Buscar si existe un candidato destacado para "¿Quisiste decir...?"
  // Condición: No hay exact match, pero hay un elemento con similitud >= minTypoSimilarity
  let bestTypoSuggestion: SimilarityMatch<T> | null = null;
  if (!exactMatch && scoredMatches.length > 0) {
    const top = scoredMatches[0];
    const topNorm = top.item.normalized || normalizeCatalogString(top.item.name);
    if (topNorm !== normInput && (top.similarity >= minTypoSimilarity || top.distance <= 2)) {
      bestTypoSuggestion = top;
    }
  }

  return {
    exactMatch,
    bestTypoSuggestion,
    suggestions: scoredMatches.slice(0, maxResults),
  };
}
