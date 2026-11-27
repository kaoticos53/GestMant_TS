/**
 * Coincidencia exacta de un código leído (QR, pistola o buscador global) con
 * un equipo o un repuesto. Si el texto identifica a un único elemento, la
 * vista puede abrir su ficha directamente en vez de dejar una lista de un
 * solo resultado.
 *
 * Puro: no sabe de React ni de Convex.
 */

function normalizeCode(value: string | undefined | null): string {
  return (value ?? "").trim().toLocaleLowerCase("es");
}

/**
 * Devuelve el único elemento cuyo código (o alguno de sus códigos
 * alternativos) coincide exactamente con `term`, sin distinguir mayúsculas.
 * Si no hay ninguno o hay varios, devuelve `null`.
 */
export function findExactCodeMatch<T>(
  items: readonly T[],
  term: string,
  codesOf: (item: T) => readonly (string | undefined | null)[],
): T | null {
  const wanted = normalizeCode(term);
  if (wanted === "") return null;
  let found: T | null = null;
  for (const item of items) {
    const matches = codesOf(item).some(
      (code) => normalizeCode(code) === wanted,
    );
    if (!matches) continue;
    if (found !== null) return null;
    found = item;
  }
  return found;
}
