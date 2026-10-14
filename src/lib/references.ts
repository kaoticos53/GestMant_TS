/**
 * La referencia con la que el taller sigue cada caso: la incidencia que alguien
 * notifica, la petición de repuestos, la petición de compra que sale de ella y la
 * orden que se manda al proveedor. Es lo que se apunta, se copia en un correo, se
 * teclea para consultarlo y lo que queda escrito en un papel que se archiva, así
 * que las cuatro series comparten una sola regla y vive aquí, sin Convex: el
 * prefijo, las cifras del número y —lo que de verdad importa— cuál es el
 * siguiente.
 *
 * El siguiente es **el número más alto ya repartido, más uno**: nunca cuántas
 * filas hay. La diferencia se ve el día que la papelera borra de verdad una
 * petición retirada. Contando filas, la siguiente petición heredaría el número que
 * quedó libre —un número ya usado, que sigue citado en las órdenes de compra que
 * salieron de ella y que cualquiera puede tener apuntado—, y con dos fichas
 * detrás del mismo número la referencia deja de servir para saber de qué se está
 * hablando. Por eso el número no se cuenta: se mira el más alto y se avanza.
 *
 * Y como las filas también desaparecen cuando se borra la serie entera, quien
 * reparte apunta por dónde va: el contador de cada serie (`referenceCounters`)
 * recuerda el último número dado, así que un número gastado no vuelve ni con la
 * tabla vacía. Lo que se lleva la cuenta no son las filas que quedan, son los
 * números que ya se han repartido.
 *
 * Módulo puro: no sabe en qué tabla viven las filas ni de `ctx.db`. Quien las lee
 * —`convex/references.ts`, que sí pregunta a la base— le pasa las referencias que
 * hay y le pregunta lo que toca; aquí solo se decide.
 */

/** Las cuatro series que el taller numera. */
export type ReferenceKind =
  "incident" | "partRequest" | "purchaseRequest" | "purchaseOrder";

/**
 * El prefijo de cada serie, que es como se lee («PET-0007»). Va tipado con las
 * cuatro claves para que añadir una serie sin decidir su prefijo no compile.
 */
export const REFERENCE_PREFIX: Record<ReferenceKind, string> = {
  incident: "INC",
  partRequest: "PET",
  purchaseRequest: "PC",
  purchaseOrder: "OC",
};

/** Las cifras del número: los ceros de delante son del formato, no del número. */
const DIGITS = 4;

/** Una referencia de una serie, ya escrita: «PET-0007». */
export function formatReference(kind: ReferenceKind, sequence: number): string {
  return `${REFERENCE_PREFIX[kind]}-${String(sequence).padStart(DIGITS, "0")}`;
}

/**
 * Lo que dice una referencia ya escrita: de qué serie es y qué número lleva.
 * Devuelve `null` si no es de ninguna de las cuatro —un texto con guion y cifras
 * que no repartimos nosotros no cuenta para numerar nada—, y también si le falta
 * el número («PET-»).
 */
export function parseReference(
  reference: string,
): { kind: ReferenceKind; sequence: number } | null {
  const match = /^([A-Z]+)-(\d+)$/.exec(reference);
  if (match === null) return null;
  const sequence = Number(match[2]);
  switch (match[1]) {
    case REFERENCE_PREFIX.incident:
      return { kind: "incident", sequence };
    case REFERENCE_PREFIX.partRequest:
      return { kind: "partRequest", sequence };
    case REFERENCE_PREFIX.purchaseRequest:
      return { kind: "purchaseRequest", sequence };
    case REFERENCE_PREFIX.purchaseOrder:
      return { kind: "purchaseOrder", sequence };
    default:
      return null;
  }
}

/** El número de una referencia, si es de esta serie; `null` si no lo es. */
function sequenceOf(
  kind: ReferenceKind,
  reference: string | undefined,
): number | null {
  if (reference === undefined) return null;
  const parsed = parseReference(reference);
  return parsed !== null && parsed.kind === kind ? parsed.sequence : null;
}

/** El número más alto ya repartido de la serie, según las referencias que hay. */
function highestSequence(
  kind: ReferenceKind,
  issued: Iterable<string | undefined>,
): number {
  let highest = 0;
  for (const reference of issued) {
    const sequence = sequenceOf(kind, reference);
    if (sequence !== null && sequence > highest) highest = sequence;
  }
  return highest;
}

/**
 * El número que toca repartir cuando no hay contador que lo recuerde: el más alto
 * que ya está en uso, más uno. Sin ninguna referencia repartida todavía, el
 * primero de la serie.
 *
 * Las referencias de las otras series no mueven este número, y tampoco las que no
 * son nuestras: lo que se mira es la serie que se está numerando.
 */
export function nextSequence(
  kind: ReferenceKind,
  issued: Iterable<string | undefined>,
): number {
  return highestSequence(kind, issued) + 1;
}

/**
 * El número que toca cuando ya hay contador: el más alto entre lo que el contador
 * recuerda y lo que está en uso, más uno.
 *
 * Son las dos cosas a la vez, y cada una cubre a la otra. El contador es lo que
 * hace que un número gastado no vuelva a repartirse **ni aunque la papelera borre
 * todas las filas de la serie**: lo que se cuenta no son las filas que quedan, son
 * los números que ya se han dado. Y las referencias en uso son el arranque y el
 * seguro: la primera vez que se reparte un número no hay contador todavía —la
 * serie continúa desde la más alta que ya esté puesta, con los datos de antes, la
 * muestra o una copia restaurada—, y si el contador se quedara atrás, manda lo que
 * hay en la tabla.
 */
export function resumeSequence(
  kind: ReferenceKind,
  issued: Iterable<string | undefined>,
  counted: number | undefined,
): number {
  return Math.max(highestSequence(kind, issued), counted ?? 0) + 1;
}

/**
 * Lo que alguien teclea → la referencia de la serie que se está buscando: «inc-4»,
 * «INC-4» y «4» dan «INC-0004». Devuelve `null` si no hay ningún número que
 * sacar: entonces no hay nada que buscar, y quien pregunta lo dice en vez de
 * buscar a ciegas.
 *
 * Se queda con el primer número del texto —un correo con la referencia dentro trae
 * el número delante— y no mira el prefijo que se haya escrito: lo que cuenta es el
 * número, que es lo que la gente teclea y lo que se copia y se pega. Por eso quien
 * busca tiene que decir de qué serie pregunta: el mismo «4» es la incidencia
 * INC-0004 y la petición PET-0004.
 */
export function normalizeReference(
  kind: ReferenceKind,
  input: string | null | undefined,
): string | null {
  const digits = /(\d+)/.exec(String(input ?? ""));
  return digits === null ? null : formatReference(kind, Number(digits[1]));
}
