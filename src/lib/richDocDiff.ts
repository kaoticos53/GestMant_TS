/**
 * Diferencias entre dos versiones de una nota, bloque a bloque.
 *
 * El texto de una nota va y viene por bloques (párrafos, listas, citas,
 * imágenes), así que la comparación se hace en dos pasos: primero se emparejan
 * los bloques de las dos versiones —lo que se mantiene, lo que se fue y lo que
 * llegó— y después, dentro de la pareja que cambió, se comparan las palabras
 * como siempre. Así una frase retocada se sigue leyendo palabra a palabra,
 * pero un párrafo que se añadió entero se lee como el bloque que es, y no como
 * un montón de palabras sueltas mezcladas con las del párrafo de al lado.
 *
 * Vive aquí, fuera de los componentes, porque lo usan la ficha, el informe y
 * las pruebas sin navegador. Los trozos que salen son los de siempre
 * (`DiffPart`), así que quien los pinta no cambia.
 */

import { richBlockText, type RichBlock } from "./richDoc";
import { diffStats, diffWords, type DiffKind, type DiffPart } from "./textDiff";

/** Lo que cambió al pasar de una versión a la siguiente. */
export interface RichDocChanges {
  /** Los trozos del texto, en orden: lo igual, lo añadido y lo quitado. */
  parts: DiffPart[];
  /** Palabras añadidas y quitadas. */
  added: number;
  removed: number;
  /** Bloques que solo están en una de las dos versiones (párrafos, listas...). */
  blocksAdded: number;
  blocksRemoved: number;
}

/** Un bloque tal y como entra en la comparación. */
type Op =
  | { kind: "same"; before: RichBlock; after: RichBlock }
  | { kind: "gone"; block: RichBlock }
  | { kind: "arrived"; block: RichBlock };

/**
 * El texto con el que un bloque entra en la comparación. Una imagen no dice
 * nada, pero se ve: si se añade o se quita, el cambio tiene que notarse, así
 * que aquí se nombra.
 */
function blockDiffText(block: RichBlock): string {
  if (block.type !== "image") return richBlockText(block);
  return block.alt ? `[imagen: ${block.alt}]` : "[imagen]";
}

/** Lo que identifica a un bloque: dos bloques iguales son el mismo bloque. */
function blockKey(block: RichBlock): string {
  return `${block.type}|${blockDiffText(block)}`;
}

/**
 * Tope de la tabla de emparejamiento (`bloques × bloques`). Una nota tiene
 * pocos bloques; por encima de esto no se afina, se marca todo lo de una
 * versión como quitado y todo lo de la otra como añadido, que es lo que se lee
 * mejor en un texto enorme.
 */
const MAX_TABLE = 250_000;

/** Empareja los bloques de las dos versiones: la subsecuencia común más larga. */
function align(
  before: readonly RichBlock[],
  after: readonly RichBlock[],
): Op[] {
  const ops: Op[] = [];
  const a = before.map(blockKey);
  const b = after.map(blockKey);
  if (a.length * b.length > MAX_TABLE) {
    for (const block of before) ops.push({ kind: "gone", block });
    for (const block of after) ops.push({ kind: "arrived", block });
    return ops;
  }

  // common[i][j] = bloques que siguen iguales alineando before[i:] con after[j:].
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
      ops.push({ kind: "same", before: before[i], after: after[j] });
      i += 1;
      j += 1;
      continue;
    }
    // Empate: primero lo que ya estaba (quitado) y después lo que llegó.
    if (common[i + 1][j] >= common[i][j + 1]) {
      ops.push({ kind: "gone", block: before[i] });
      i += 1;
    } else {
      ops.push({ kind: "arrived", block: after[j] });
      j += 1;
    }
  }
  while (i < a.length) {
    ops.push({ kind: "gone", block: before[i] });
    i += 1;
  }
  while (j < b.length) {
    ops.push({ kind: "arrived", block: after[j] });
    j += 1;
  }
  return ops;
}

/**
 * Compara dos documentos bloque a bloque y devuelve lo que cambió, con el texto
 * ya troceado para pintarlo (o para marcarlo en el informe).
 */
export function diffRichDoc(
  before: readonly RichBlock[],
  after: readonly RichBlock[],
): RichDocChanges {
  const parts: DiffPart[] = [];
  let blocksAdded = 0;
  let blocksRemoved = 0;

  const push = (kind: DiffKind, text: string) => {
    if (text === "") return;
    const last = parts[parts.length - 1];
    if (last && last.kind === kind) last.text += text;
    else parts.push({ kind, text });
  };
  // Cada bloque empieza en su propia línea: sin esto, el párrafo que se fue y
  // el que llegó se leerían pegados, como si fueran el mismo.
  const separate = () => {
    if (parts.length > 0) push("same", "\n");
  };
  const removed = (block: RichBlock) => {
    separate();
    push("removed", blockDiffText(block));
    blocksRemoved += 1;
  };
  const added = (block: RichBlock) => {
    separate();
    push("added", blockDiffText(block));
    blocksAdded += 1;
  };
  const changed = (from: RichBlock, to: RichBlock) => {
    separate();
    for (const part of diffWords(blockDiffText(from), blockDiffText(to))) {
      push(part.kind, part.text);
    }
  };

  const ops = align(before, after);
  let index = 0;
  while (index < ops.length) {
    const op = ops[index];
    if (op.kind === "same") {
      separate();
      push("same", blockDiffText(op.before));
      index += 1;
      continue;
    }
    // Un tramo sin nada en común: se emparejan los bloques que se fueron con
    // los que llegaron, del mismo tipo, para compararlos palabra a palabra.
    const gone: RichBlock[] = [];
    const arrived: RichBlock[] = [];
    while (index < ops.length) {
      const current = ops[index];
      if (current.kind === "same") break;
      if (current.kind === "gone") gone.push(current.block);
      else arrived.push(current.block);
      index += 1;
    }
    const paired = Math.min(gone.length, arrived.length);
    for (let at = 0; at < paired; at += 1) {
      if (gone[at].type === arrived[at].type) changed(gone[at], arrived[at]);
      else {
        removed(gone[at]);
        added(arrived[at]);
      }
    }
    for (let at = paired; at < gone.length; at += 1) removed(gone[at]);
    for (let at = paired; at < arrived.length; at += 1) added(arrived[at]);
  }

  return { parts, blocksAdded, blocksRemoved, ...diffStats(parts) };
}

/**
 * «2 bloques añadidos · 1 bloque quitado», para acompañar al resumen de
 * palabras. `null` si no apareció ni desapareció ningún bloque entero: un
 * párrafo retocado no es un bloque nuevo.
 */
export function describeBlockCounts(change: {
  blocksAdded: number;
  blocksRemoved: number;
}): string | null {
  const pieces: string[] = [];
  if (change.blocksAdded > 0) {
    pieces.push(
      `${change.blocksAdded} ${change.blocksAdded === 1 ? "bloque añadido" : "bloques añadidos"}`,
    );
  }
  if (change.blocksRemoved > 0) {
    pieces.push(
      `${change.blocksRemoved} ${change.blocksRemoved === 1 ? "bloque quitado" : "bloques quitados"}`,
    );
  }
  return pieces.length === 0 ? null : pieces.join(" · ");
}
