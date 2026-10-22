import { PART_CATEGORIES } from "@/lib/workshop";

/**
 * Combina las categorías predefinidas de repuestos con las creadas por el taller,
 * deduplicando nombres para evitar repeticiones en el desplegable de autocompletado.
 */
export function buildPartCategoryOptions(
  catalogCategories: Array<{ name: string }>,
): Array<{ name: string }> {
  const seen = new Set<string>();
  const options: Array<{ name: string }> = [];

  for (const cat of PART_CATEGORIES) {
    const key = cat.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      options.push({ name: cat });
    }
  }

  for (const cat of catalogCategories) {
    const trimmed = cat.name.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      options.push({ name: trimmed });
    }
  }

  return options;
}
