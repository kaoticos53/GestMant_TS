/**
 * Diferencias entre dos textos, palabra a palabra: lo que se añadió, lo que se
 * quitó y lo que sigue igual.
 *
 * Vive aquí, fuera del componente, para poder probarlo sin navegador; lo usa el
 * historial de cambios de una nota del cuaderno. La comparación es la
 * subsecuencia común más larga sobre palabras, que en textos de cuaderno es
 * rápida y estable: el mismo par de textos da siempre las mismas marcas, sin
 * depender del orden en que se recorran.
 *
 * Las palabras, los signos y los huecos (espacios, saltos de línea, sangrías)
 * son piezas distintas: así añadir una palabra al final de una frase no marca
 * la anterior como cambiada —ni arrastra su punto final—, y las partes
 * reconstruyen el texto tal cual, sin perder ni un salto de línea.
 */

/** Cada trozo del texto comparado: igual, añadido o quitado. */
export type DiffKind = "same" | "added" | "removed";

export interface DiffPart {
  kind: DiffKind;
  text: string;
}

/** Lo que cambió, contado en palabras. */
export interface DiffStats {
  added: number;
  removed: number;
}

/**
 * Trocea un texto en palabras, signos y huecos (espacios, saltos de línea,
 * sangrías). Todo va pieza a pieza —incluida la puntuación— para que añadir una
 * palabra al final de una frase no marque la anterior como cambiada; la unión
 * de todas las piezas sigue siendo el texto original.
 */
export function diffTokens(text: string): string[] {
  return text.match(/\s+|[\p{L}\p{N}]+|./gu) ?? [];
}

/**
 * Tope de la tabla de comparación (`palabras × palabras`). Una nota es un
 * párrafo escrito a mano: por encima de esto no se afina palabra a palabra, se
 * marca el cambio entero, que además es lo que se lee mejor en un texto enorme.
 */
const MAX_TABLE = 250_000;

/**
 * Compara dos textos y devuelve sus trozos en orden: lo que se mantiene, lo que
 * se quitó y lo que se añadió, pegados y sin trozos vacíos. Cambiar una palabra
 * por otra se lee como la vieja tachada y la nueva a continuación.
 */
export function diffWords(before: string, after: string): DiffPart[] {
  const parts: DiffPart[] = [];
  const push = (kind: DiffKind, text: string) => {
    if (text === "") return;
    const last = parts[parts.length - 1];
    if (last && last.kind === kind) last.text += text;
    else parts.push({ kind, text });
  };

  const a = diffTokens(before);
  const b = diffTokens(after);
  if (a.length === 0 && b.length === 0) return [];

  if (a.length * b.length > MAX_TABLE) {
    push("removed", before);
    push("added", after);
    return parts;
  }

  // common[i][j] = palabras que siguen iguales alineando a[i:] con b[j:].
  const common: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      common[i][j] =
        a[i] === b[j]
          ? common[i + 1][j + 1] + 1
          : Math.max(common[i + 1][j], common[i][j + 1]);
    }
  }

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("same", a[i]);
      i += 1;
      j += 1;
      continue;
    }
    // Empate: primero lo que ya estaba (tachado) y después lo nuevo, que es
    // como se lee una corrección.
    if (common[i + 1][j] >= common[i][j + 1]) {
      push("removed", a[i]);
      i += 1;
    } else {
      push("added", b[j]);
      j += 1;
    }
  }
  while (i < a.length) {
    push("removed", a[i]);
    i += 1;
  }
  while (j < b.length) {
    push("added", b[j]);
    j += 1;
  }
  return parts;
}

/**
 * Palabras de un trozo, para contarlas en el resumen. Los huecos sueltos no
 * cuentan; un signo suelto sí, porque un cambio de puntuación es un cambio y el
 * resumen no puede decir «sin cambios» cuando la nota se tocó.
 */
function wordCount(text: string): number {
  return text.match(/\S+/g)?.length ?? 0;
}

/** Cuántas palabras se añadieron y cuántas se quitaron. */
export function diffStats(parts: readonly DiffPart[]): DiffStats {
  let added = 0;
  let removed = 0;
  for (const part of parts) {
    if (part.kind === "added") added += wordCount(part.text);
    else if (part.kind === "removed") removed += wordCount(part.text);
  }
  return { added, removed };
}

/** «3 palabras añadidas · 1 quitada» / «sin cambios», para resumir el diff. */
export function describeDiff(stats: DiffStats): string {
  const pieces: string[] = [];
  if (stats.added > 0) {
    pieces.push(
      `${stats.added} ${stats.added === 1 ? "palabra añadida" : "palabras añadidas"}`,
    );
  }
  if (stats.removed > 0) {
    pieces.push(
      `${stats.removed} ${stats.removed === 1 ? "quitada" : "quitadas"}`,
    );
  }
  return pieces.length === 0 ? "sin cambios" : pieces.join(" · ");
}
